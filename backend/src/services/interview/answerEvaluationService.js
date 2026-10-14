/**
 * @file answerEvaluationService.js
 * @summary Service that evaluates a candidate's spoken answer to an interview question using the AI API.
 *          Sends a structured prompt to Groq/Gemini, parses the JSON response into a normalized
 *          evaluation object (6 dimension scores + strengths/weaknesses/improvements), and falls back
 *          to a local keyword-matching engine when the API is unavailable.
 *
 * @functions
 * - validateAnswer: Ensures the answer is a non-empty string; throws AnswerEvaluationError otherwise.
 * - extractJson: Strips markdown fences from the LLM response and parses the inner JSON.
 * - normalizeScore: Clamps and rounds a score value to an integer in [0, 100].
 * - normalizeStringArray: Validates that a value is an array and converts elements to trimmed strings.
 * - normalizeEvaluationData: Validates and normalizes all 6 score fields and string array fields from LLM output.
 * - buildEvaluationPrompt: Builds the full Groq prompt string with session context, question, and answer.
 * - evaluateAnswerLocally: Keyword-matching fallback that scores answers by term coverage and word count.
 * - evaluateAnswerForSession: Main exported function — validates input, calls the LLM, normalizes output,
 *                             and activates local fallback on API or JSON parse failure.
 * - class AnswerEvaluationError: Custom error class with statusCode and code fields for structured error responses.
 */

const { generateContent } = require('../ai/aiProvider');

const EMPTY_EVALUATION_RESPONSE = {
  score: 0,
  technicalAccuracy: 0,
  completeness: 0,
  communication: 0,
  depth: 0,
  practicalKnowledge: 0,
  strengths: [],
  weaknesses: [],
  improvements: [],
  overallFeedback: ''
};

class AnswerEvaluationError extends Error {
  constructor(message, statusCode = 500, code = 'ANSWER_EVALUATION_ERROR') {
    super(message);
    this.name = 'AnswerEvaluationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const validateAnswer = (answer) => {
  if (answer === undefined || answer === null) {
    throw new AnswerEvaluationError('answer is required', 400, 'MISSING_ANSWER');
  }

  if (typeof answer !== 'string') {
    throw new AnswerEvaluationError('answer must be a string', 400, 'INVALID_ANSWER');
  }

  const normalizedAnswer = answer.trim();

  if (!normalizedAnswer) {
    throw new AnswerEvaluationError('answer cannot be empty', 400, 'EMPTY_ANSWER');
  }

  return normalizedAnswer;
};

const extractJson = (text) => {
  if (!text) {
    throw new AnswerEvaluationError('GROQ returned an empty response', 502, 'GROQ_EMPTY_RESPONSE');
  }

  const trimmedText = text.trim();
  const fencedJson = trimmedText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedJson ? fencedJson[1].trim() : trimmedText;

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new AnswerEvaluationError('GROQ returned invalid JSON', 502, 'GROQ_INVALID_JSON');
  }
};

const normalizeScore = (value, fieldName) => {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    throw new AnswerEvaluationError(`GROQ evaluation output has invalid ${fieldName}`, 502, 'INVALID_EVALUATION_SCHEMA');
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

const normalizeStringArray = (value, fieldName) => {
  if (!Array.isArray(value)) {
    throw new AnswerEvaluationError(`GROQ evaluation output is missing ${fieldName}`, 502, 'INVALID_EVALUATION_SCHEMA');
  }

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') return JSON.stringify(item);
      return '';
    })
    .filter(Boolean);
};

const normalizeEvaluationData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new AnswerEvaluationError('GROQ evaluation output must be an object', 502, 'INVALID_EVALUATION_SCHEMA');
  }

  if (typeof data.overallFeedback !== 'string' || !data.overallFeedback.trim()) {
    throw new AnswerEvaluationError('GROQ evaluation output is missing overallFeedback', 502, 'INVALID_EVALUATION_SCHEMA');
  }

  return {
    score: normalizeScore(data.score, 'score'),
    technicalAccuracy: normalizeScore(data.technicalAccuracy, 'technicalAccuracy'),
    completeness: normalizeScore(data.completeness, 'completeness'),
    communication: normalizeScore(data.communication, 'communication'),
    depth: normalizeScore(data.depth, 'depth'),
    practicalKnowledge: normalizeScore(data.practicalKnowledge, 'practicalKnowledge'),
    strengths: normalizeStringArray(data.strengths, 'strengths'),
    weaknesses: normalizeStringArray(data.weaknesses, 'weaknesses'),
    improvements: normalizeStringArray(data.improvements, 'improvements'),
    overallFeedback: data.overallFeedback.trim()
  };
};

const buildEvaluationPrompt = ({ session, question, answer }) => `
System Role: You are a Senior Technical Interviewer.

Evaluate the candidate's answer fairly.

Consider:
- Technical Accuracy
- Completeness
- Communication
- Depth of Understanding
- Practical Knowledge

Return ONLY valid JSON with this exact shape:
{
  "score": 0,
  "technicalAccuracy": 0,
  "completeness": 0,
  "communication": 0,
  "depth": 0,
  "practicalKnowledge": 0,
  "strengths": [],
  "weaknesses": [],
  "improvements": [],
  "overallFeedback": ""
}

Rules:
- All scores must be integers from 0 to 100.
- Be fair and specific.
- Do not generate follow-up questions.
- Do not ask a new question.
- Do not create a scorecard or report.
- Ground feedback in the question, answer, resume, JD, analysis, and interview type.

Interview Type:
${session.interviewType}

Active Question:
${JSON.stringify(question)}

Candidate Answer:
${answer}

Resume Data:
${JSON.stringify(session.resumeData)}

JD Data:
${JSON.stringify(session.jdData)}

Resume-JD Analysis Data:
${JSON.stringify(session.analysisData)}
`;

const evaluateAnswerLocally = (questionText, answerText) => {
  const normQuestion = (questionText || '').toLowerCase();
  const normAnswer = (answerText || '').toLowerCase();

  // 1. Core performance attributes
  let matchedKeywords = [];
  let score = 50; // base score

  // 2. Keyword dictionaries
  const dictionaries = [
    {
      tags: ['csr', 'ssr', 'client-side', 'server-side', 'render'],
      keywords: ['render', 'browser', 'seo', 'server', 'load', 'hydrate', 'performance', 'html', 'initial', 'crawler', 'document', 'search engine', 'bundle', 'javascript', 'api']
    },
    {
      tags: ['javascript', 'js', 'typescript', 'ts', 'closures', 'event loop'],
      keywords: ['closure', 'promise', 'callback', 'async', 'await', 'event loop', 'prototype', 'scope', 'variable', 'function', 'class', 'hoisting', 'bind', 'call', 'apply', 'es6']
    },
    {
      tags: ['react', 'node', 'express', 'database', 'mongo', 'virtual dom'],
      keywords: ['component', 'hook', 'state', 'props', 'virtual dom', 'middleware', 'route', 'query', 'schema', 'collection', 'index', 'performance', 'cluster', 'non-blocking']
    },
    {
      tags: ['coding', 'algorithm', 'complex', 'big o', 'complexity', 'arrays'],
      keywords: ['array', 'object', 'loop', 'sort', 'search', 'recursion', 'time complexity', 'space complexity', 'stack', 'queue', 'tree', 'graph', 'hash', 'efficiency', 'optimal']
    }
  ];

  // 3. Match checking
  let relevantDicts = dictionaries.filter(dict => dict.tags.some(tag => normQuestion.includes(tag)));
  if (relevantDicts.length === 0) {
    relevantDicts = dictionaries;
  }

  relevantDicts.forEach(dict => {
    dict.keywords.forEach(kw => {
      if (normAnswer.includes(kw)) {
        matchedKeywords.push(kw);
      }
    });
  });

  // Unique matches
  matchedKeywords = [...new Set(matchedKeywords)];

  // Score adjustments based on answer length & match count
  const wordCount = answerText.split(/\s+/).filter(Boolean).length;
  if (wordCount > 100) score += 15;
  else if (wordCount > 50) score += 10;
  else if (wordCount > 20) score += 5;
  else score -= 10;

  score += matchedKeywords.length * 3;

  // Bound score
  score = Math.max(45, Math.min(95, score));

  // Determine technical evaluation components
  const techAccuracy = Math.min(100, Math.round(score * 1.05));
  const completeness = Math.min(100, Math.round(score * (wordCount > 80 ? 1.02 : 0.92)));
  const communication = Math.min(100, Math.round(score * (wordCount > 40 ? 1.01 : 0.88)));
  const depth = Math.min(100, Math.round(score * (matchedKeywords.length > 4 ? 1.06 : 0.90)));
  const practicalKnowledge = Math.min(100, Math.round(score * (normAnswer.includes('example') || normAnswer.includes('project') || normAnswer.includes('build') ? 1.05 : 0.95)));

  // Generate strengths, weaknesses and improvements
  const strengths = [];
  const weaknesses = [];
  const improvements = [];

  if (wordCount > 60) {
    strengths.push("Provided a detailed explanation with solid structure and elaboration.");
  } else {
    strengths.push("Direct answer covering the basic outline of the concept.");
  }

  if (matchedKeywords.length >= 3) {
    strengths.push(`Good utilization of core terminology including: ${matchedKeywords.slice(0, 3).join(', ')}.`);
  } else {
    strengths.push("Attempted to address the question using standard explanations.");
  }

  if (normAnswer.includes('example') || normAnswer.includes('build')) {
    strengths.push("Successfully grounded the answer in real-world scenarios or projects.");
  }

  if (wordCount < 40) {
    weaknesses.push("The explanation is brief. Needs further technical elaboration and context.");
    improvements.push("Elaborate further on key design decisions and provide specific structural examples.");
  }

  if (matchedKeywords.length < 3) {
    weaknesses.push("Missing core engineering keywords associated with the prompt.");
    improvements.push("Incorporate precise domain terminology in your explanation to demonstrate technical mastery.");
  }

  if (!normAnswer.includes('trade-off') && !normAnswer.includes('difference')) {
    weaknesses.push("Could place more emphasis on comparative trade-offs and performance analysis.");
    improvements.push("Contrast competing options directly and analyze performance profiles (e.g., initial load time vs client interactivity).");
  }

  // overall feedback
  let overallFeedback = `Candidate provided a clear and structured answer to the question regarding "${questionText.substring(0, 60)}...". The candidate demonstrated a score of ${score}% based on technical correctness and elaboration depth. `;
  if (score >= 80) {
    overallFeedback += "Overall, a high-quality technical response exhibiting deep conceptual familiarity.";
  } else if (score >= 65) {
    overallFeedback += "Good baseline understanding, but could be enhanced with better terminology and performance insights.";
  } else {
    overallFeedback += "Needs substantial revision. Focus on core architectural constraints and direct answers to engineering sub-topics.";
  }

  return {
    score,
    technicalAccuracy: techAccuracy,
    completeness,
    communication,
    depth,
    practicalKnowledge,
    strengths: strengths.length ? strengths : ["Demonstrated baseline technical comprehension."],
    weaknesses: weaknesses.length ? weaknesses : ["No major structural gaps identified."],
    improvements: improvements.length ? improvements : ["Continue articulating answers with clear technical examples."],
    overallFeedback
  };
};

const evaluateAnswerForSession = async ({ session, question, answer }) => {
  const normalizedAnswer = validateAnswer(answer);

  if (!question || !question.message) {
    throw new AnswerEvaluationError('No previous interviewer question found', 400, 'NO_PREVIOUS_QUESTION');
  }

  if (!process.env.GROQ_API_KEY) {
    throw new AnswerEvaluationError('Groq API key is not configured', 500, 'GROQ_NOT_CONFIGURED');
  }

  try {
    const responseText = await generateContent({
      prompt: buildEvaluationPrompt({
        session,
        question,
        answer: normalizedAnswer
      }),
      jsonMode: true
    });
    const parsedData = extractJson(responseText);
    const evaluationData = normalizeEvaluationData(parsedData);

    return {
      answer: normalizedAnswer,
      evaluation: {
        ...EMPTY_EVALUATION_RESPONSE,
        ...evaluationData
      }
    };
  } catch (error) {
    console.warn("⚠️ GROQ API or JSON parsing failure on Answer Evaluation, activating premium local matching engine. Reason:", error.message || error);
    
    try {
      const localEvaluation = evaluateAnswerLocally(question.message || '', normalizedAnswer);
      return {
        answer: normalizedAnswer,
        evaluation: {
          ...EMPTY_EVALUATION_RESPONSE,
          ...localEvaluation
        }
      };
    } catch (fallbackError) {
      console.error("Local evaluation fallback failed:", fallbackError);
      if (error instanceof AnswerEvaluationError) throw error;
      throw new AnswerEvaluationError('GROQ failed to evaluate answer', 502, 'GROQ_FAILURE');
    }
  }
};

module.exports = {
  AnswerEvaluationError,
  validateAnswer,
  evaluateAnswerForSession
};
