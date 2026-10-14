/**
 * @file codingInterviewService.js
 * @summary Service for the live coding round of a mock interview.
 *          Generates a personalized coding problem via the Groq/Gemini LLM, executes the
 *          candidate's submitted code against examples using the Judge0 batch API,
 *          and evaluates the solution's correctness and code quality with a second LLM call.
 *
 * @functions
 * - extractJson: Strips non-JSON prefix/suffix from LLM output and parses the JSON object.
 * - normalizeStringArray: Validates and cleans a string array from LLM output.
 * - normalizeExamples: Validates that examples have input/output pairs and returns cleaned objects.
 * - normalizeCodingQuestion: Validates and normalizes the LLM-generated question object.
 * - normalizeScore: Clamps a score value to an integer in [0, 100].
 * - normalizeCodingEvaluation: Validates and normalizes the LLM-generated code evaluation object.
 * - generateCodingQuestionForSession: Builds a contextualized LLM prompt from session data and returns
 *                                     a normalized coding question with examples and expected topics.
 * - executeCodeWithJudge0: Submits all examples as a batch to Judge0, polls for results,
 *                          and returns pass/fail counts and raw test case output.
 * - evaluateCodingSolutionWithGROQ: Sends the question, code, language, and Judge0 results to the LLM
 *                                   and returns a normalized coding evaluation with complexity analysis.
 * - class CodingInterviewError: Custom error class with statusCode and code fields.
 */

const { generateContent } = require('../ai/aiProvider');
const { getLanguageById, submitBatch, submitToken } = require('../../utils/problemUtility');

const ALLOWED_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const ALLOWED_TOPICS = [
  'Arrays',
  'Strings',
  'Hashing',
  'Stack',
  'Queue',
  'Linked List',
  'Trees',
  'BST',
  'Heap',
  'Graph',
  'DP',
  'Greedy',
  'Sliding Window',
  'Two Pointers',
  'Backtracking'
];

const TEMPLATE_FOCUS = {
  technical: 'Prefer standard DSA and CS fundamentals aligned with the JD.',
  hr: 'If a coding round is requested from an HR template, keep the problem easy and practical.',
  genai: 'Prefer algorithmic problems inspired by text processing, retrieval, ranking, or data handling when possible.',
  coding: 'Generate coding questions first and prioritize core problem-solving quality.',
  'full-mock': 'Use a balanced coding problem that complements the broader mock interview.'
};

class CodingInterviewError extends Error {
  constructor(message, statusCode = 500, code = 'CODING_INTERVIEW_ERROR') {
    super(message);
    this.name = 'CodingInterviewError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const extractJson = (text) => {
  if (!text) {
    throw new CodingInterviewError('GROQ returned an empty response', 502, 'GROQ_EMPTY_RESPONSE');
  }

  let jsonText = text.trim();
  const startIdx = jsonText.indexOf('{');
  const endIdx = jsonText.lastIndexOf('}');

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    jsonText = jsonText.substring(startIdx, endIdx + 1);
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("❌ Failed to parse JSON from GROQ response:", text);
    throw new CodingInterviewError('GROQ returned invalid JSON', 502, 'GROQ_INVALID_JSON');
  }
};

const normalizeStringArray = (value, fieldName) => {
  if (!Array.isArray(value)) {
    throw new CodingInterviewError(`GROQ output is missing ${fieldName}`, 502, 'INVALID_CODING_SCHEMA');
  }

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') return JSON.stringify(item);
      return '';
    })
    .filter(Boolean);
};

const normalizeExamples = (examples) => {
  if (!Array.isArray(examples) || examples.length === 0) {
    throw new CodingInterviewError('GROQ coding question must include examples', 502, 'INVALID_CODING_SCHEMA');
  }

  return examples.map((example) => ({
    input: String(example?.input || '').trim(),
    output: String(example?.output || '').trim(),
    explanation: String(example?.explanation || '').trim()
  })).filter((example) => example.input && example.output);
};

const normalizeCodingQuestion = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new CodingInterviewError('GROQ coding question output must be an object', 502, 'INVALID_CODING_SCHEMA');
  }

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const description = typeof data.description === 'string' ? data.description.trim() : '';
  const difficulty = typeof data.difficulty === 'string' ? data.difficulty.trim() : '';
  const examples = normalizeExamples(data.examples);

  if (!title || !description) {
    throw new CodingInterviewError('GROQ coding question is missing title or description', 502, 'INVALID_CODING_SCHEMA');
  }

  if (!ALLOWED_DIFFICULTIES.includes(difficulty)) {
    throw new CodingInterviewError('GROQ coding question has invalid difficulty', 502, 'INVALID_CODING_SCHEMA');
  }

  return {
    title,
    description,
    difficulty,
    constraints: normalizeStringArray(data.constraints, 'constraints'),
    examples,
    expectedTopics: normalizeStringArray(data.expectedTopics, 'expectedTopics')
      .filter((topic) => ALLOWED_TOPICS.includes(topic))
  };
};

const normalizeScore = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    throw new CodingInterviewError('GROQ coding evaluation has invalid correctnessScore', 502, 'INVALID_EVALUATION_SCHEMA');
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

const normalizeCodingEvaluation = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new CodingInterviewError('GROQ coding evaluation output must be an object', 502, 'INVALID_EVALUATION_SCHEMA');
  }

  const timeComplexity = typeof data.timeComplexity === 'string' ? data.timeComplexity.trim() : '';
  const spaceComplexity = typeof data.spaceComplexity === 'string' ? data.spaceComplexity.trim() : '';
  const overallFeedback = typeof data.overallFeedback === 'string' ? data.overallFeedback.trim() : '';

  if (!timeComplexity || !spaceComplexity || !overallFeedback) {
    throw new CodingInterviewError('GROQ coding evaluation is missing required feedback fields', 502, 'INVALID_EVALUATION_SCHEMA');
  }

  return {
    correctnessScore: normalizeScore(data.correctnessScore),
    timeComplexity,
    spaceComplexity,
    strengths: normalizeStringArray(data.strengths, 'strengths'),
    weaknesses: normalizeStringArray(data.weaknesses, 'weaknesses'),
    optimizationSuggestions: normalizeStringArray(data.optimizationSuggestions, 'optimizationSuggestions'),
    overallFeedback
  };
};



const generateCodingQuestionForSession = async (session) => {
  try {
    const shuffledTopics = [...ALLOWED_TOPICS].sort(() => 0.5 - Math.random());
    const focusTopics = shuffledTopics.slice(0, 3).join(', ');

    const prompt = `
You are a senior coding interviewer.

Generate one coding interview question personalized for the candidate.

IMPORTANT ENFORCEMENT: To ensure high variability and prevent repetitive questions, you MUST strictly generate a question that focuses on one of these randomly selected core topics: ${focusTopics}.
Do NOT generate standard boilerplate questions like "Maximum Subarray Sum" or "Graph Connectivity" unless explicitly required. Make the scenario unique.

Use:
- Resume data
- Job description data
- Resume-JD analysis data
- Interview type
- Template type
- Template focus

Allowed difficulty values:
- Easy
- Medium
- Hard

Allowed expectedTopics values:
${ALLOWED_TOPICS.map((topic) => `- ${topic}`).join('\n')}

Return ONLY valid JSON:
{
  "title": "",
  "description": "",
  "difficulty": "",
  "constraints": [],
  "examples": [
    {
      "input": "",
      "output": "",
      "explanation": ""
    }
  ],
  "expectedTopics": []
}

Rules:
- Include at least 2 examples with exact input and output.
- **CRITICAL INPUT FORMAT REQUIREMENT**: The "input" field in examples MUST be formatted ONLY as raw, plain-text standard input (stdin) values (space-separated or newline-separated values) that a standard program can parse directly using standard input streams (like "cin >>" in C++, "Scanner" in Java, or "fs.readFileSync(0, 'utf8')" in Javascript).
- **DO NOT** include variable names, assignments (like "nums = ..."), brackets, braces, commas, or quotes inside the "input" field.
  - Correct input example: "4\n1 5\n2 7\n4 8\n9 10" (where 4 is the size/lines, followed by actual data).
  - Incorrect input example: "submissions = [[1, 5], [2, 7], [4, 8], [9, 10]]".
- **CRITICAL OUTPUT FORMAT REQUIREMENT**: The "output" field in examples MUST contain ONLY the raw output string (stdout) of the solution.
  - Correct output example: "3".
  - Incorrect output example: "output = 3" or "result: 3".
- **CRITICAL DESCRIPTION REQUIREMENT**: In the "description" field, you MUST explicitly describe the input and output format so the candidate knows exactly how their program is expected to read the input from stdin and print the output to stdout. Explain the structure of inputs (e.g. "Input format: The first line contains N. The next N lines contain two space-separated integers representing start and end times.").
- Keep inputs simple enough to run as stdin.
- Do not include starter code.
- Prefer topics relevant to the JD and candidate gaps.

Resume Data:
${JSON.stringify(session.resumeData)}

JD Data:
${JSON.stringify(session.jdData)}

Analysis Data:
${JSON.stringify(session.analysisData)}

Interview Type:
${session.interviewType}

Template Type:
${session.templateType || 'technical'}

Template Focus:
${TEMPLATE_FOCUS[session.templateType] || TEMPLATE_FOCUS.technical}
`;

    const resultText = await generateContent({ prompt, jsonMode: true });
    return normalizeCodingQuestion(extractJson(resultText));
  } catch (error) {
    if (error instanceof CodingInterviewError) throw error;
    throw new CodingInterviewError('LLM failed to generate coding question', 502, 'GROQ_FAILURE');
  }
};

const executeCodeWithJudge0 = async ({ question, code, language }) => {
  const languageId = getLanguageById(language);

  if (!languageId) {
    throw new CodingInterviewError('Unsupported coding language', 400, 'INVALID_LANGUAGE');
  }

  const examples = normalizeExamples(question.examples);
  const submissions = examples.map((example) => ({
    source_code: code,
    language_id: languageId,
    stdin: example.input,
    expected_output: example.output
  }));

  try {
    const submitResult = await submitBatch(submissions);
    if (!Array.isArray(submitResult)) {
      throw new Error('Judge0 batch submission failed');
    }

    const tokens = submitResult.map((item) => item.token).filter(Boolean);
    const testCases = await submitToken(tokens);

    if (!Array.isArray(testCases)) {
      throw new Error('Judge0 result fetch failed');
    }

    const passedCount = testCases.filter((testCase) => testCase.status_id === 3).length;

    return {
      success: passedCount === testCases.length,
      passedCount,
      totalCount: testCases.length,
      testCases
    };
  } catch (error) {
    throw new CodingInterviewError('Judge0 failed to execute code', 502, 'JUDGE0_FAILURE');
  }
};

const evaluateCodingSolutionWithGROQ = async ({ question, code, language, executionResult }) => {
  try {
    // Truncate execution result to prevent prompt from exceeding LLM token limits if stdout/stderr is huge
    const safeExecutionResult = { 
      success: executionResult.success,
      passedCount: executionResult.passedCount,
      totalCount: executionResult.totalCount,
      testCases: []
    };
    if (Array.isArray(executionResult.testCases)) {
      safeExecutionResult.testCases = executionResult.testCases.map(tc => ({
        status_id: tc.status_id,
        status: tc.status?.description,
        time: tc.time,
        memory: tc.memory,
        stdout: tc.stdout ? tc.stdout.substring(0, 500) + (tc.stdout.length > 500 ? '...[TRUNCATED]' : '') : tc.stdout,
        stderr: tc.stderr ? tc.stderr.substring(0, 500) + (tc.stderr.length > 500 ? '...[TRUNCATED]' : '') : tc.stderr,
        compile_output: tc.compile_output ? tc.compile_output.substring(0, 500) + (tc.compile_output.length > 500 ? '...[TRUNCATED]' : '') : tc.compile_output
      }));
    }

    const safeQuestion = {
      title: question.title,
      description: question.description?.substring(0, 3000),
      difficulty: question.difficulty,
      expectedTopics: question.expectedTopics
    };

    const prompt = `
You are a senior coding interviewer.

Evaluate the candidate's coding solution using the question, candidate code, language, and Judge0 execution result.

Return ONLY valid JSON:
{
  "correctnessScore": 0,
  "timeComplexity": "",
  "spaceComplexity": "",
  "strengths": [],
  "weaknesses": [],
  "optimizationSuggestions": [],
  "overallFeedback": ""
}

Rules:
- correctnessScore must be 0 to 100.
- Consider Judge0 pass/fail results heavily.
- Mention edge cases and complexity honestly.
- Do not generate a new coding question.

Question:
${JSON.stringify(safeQuestion)}

Language:
${language}

Candidate Code:
${code.substring(0, 5000) + (code.length > 5000 ? '\n// [TRUNCATED]' : '')}

Execution Result:
${JSON.stringify(safeExecutionResult)}
`;

    const resultText = await generateContent({ prompt, jsonMode: true });
    return normalizeCodingEvaluation(extractJson(resultText));
  } catch (error) {
    if (error instanceof CodingInterviewError) throw error;
    console.error("GROQ Evaluation Failure:", error);
    throw new CodingInterviewError(`LLM failed to evaluate coding solution: ${error.message || 'Unknown error'}`, 502, 'GROQ_FAILURE');
  }
};

module.exports = {
  CodingInterviewError,
  generateCodingQuestionForSession,
  executeCodeWithJudge0,
  evaluateCodingSolutionWithGROQ
};
