/**
 * @file questionGenerationService.js
 * @summary Service that generates a single personalized interview question for the active session.
 *          Sends a rich LLM prompt that includes session context (resume, JD, transcript, template type)
 *          and a required difficulty level. Falls back to a built-in curated question bank when the
 *          API is unavailable or returns malformed JSON.
 *
 * @functions
 * - getTemplateFocus: Returns the focus topic list for a given template type (technical, hr, genai, etc.).
 * - validateDifficulty: Normalizes and validates the difficulty string against allowed values.
 * - repairJson: Strips trailing commas and common JSON syntax bugs for fault-tolerant parsing.
 * - extractJson: Strips markdown fences, slices to JSON boundaries, and parses with repair fallback.
 * - normalizeQuestionData: Validates question, category, difficulty, source, and reason fields from LLM output.
 * - generateQuestionLocally: Built-in fallback that selects a question from curated template-specific
 *                            question lists, avoiding questions already seen in the transcript.
 * - buildQuestionPrompt: Assembles the full LLM prompt with session context, priority order, and allowed schemas.
 * - generateQuestionForSession: Main exported function — validates difficulty, calls LLM, normalizes output,
 *                               and activates local fallback on API or JSON failure.
 * - class QuestionGenerationError: Custom error class with statusCode and code fields.
 */

const { generateContent } = require('../ai/aiProvider');

const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard'];
const ALLOWED_CATEGORIES = [
  'Project Discussion',
  'DSA',
  'OOPS',
  'DBMS',
  'OS',
  'CN',
  'Frontend',
  'Backend',
  'System Design',
  'Behavioral',
  'Generative AI',
  'Machine Learning',
  'Deep Learning',
  'NLP'
];

const ALLOWED_SOURCES = [
  'resume_project',
  'resume_skill',
  'jd_requirement',
  'missing_skill',
  'behavioral',
  'session_context'
];

const TEMPLATE_FOCUS = {
  technical: [
    'DSA',
    'OOPS',
    'DBMS',
    'OS',
    'CN',
    'Projects'
  ],
  hr: [
    'Tell me about yourself',
    'Strengths',
    'Weaknesses',
    'Conflict resolution',
    'Leadership',
    'Teamwork'
  ],
  genai: [
    'LLMs',
    'Prompt Engineering',
    'RAG',
    'Embeddings',
    'Vector Databases',
    'LangChain',
    'Agents',
    'Memory'
  ],
  coding: [
    'Coding Interview Round',
    'Problem solving',
    'Algorithmic reasoning'
  ],
  'full-mock': [
    'HR',
    'Technical',
    'Projects',
    'GenAI',
    'Coding'
  ]
};

const getTemplateFocus = (templateType = 'technical') => (
  TEMPLATE_FOCUS[templateType] || TEMPLATE_FOCUS.technical
);

class QuestionGenerationError extends Error {
  constructor(message, statusCode = 500, code = 'QUESTION_GENERATION_ERROR') {
    super(message);
    this.name = 'QuestionGenerationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const validateDifficulty = (difficulty) => {
  if (!difficulty || typeof difficulty !== 'string') {
    throw new QuestionGenerationError('difficulty is required', 400, 'MISSING_DIFFICULTY');
  }

  const normalizedDifficulty = difficulty.toLowerCase().trim();

  if (!ALLOWED_DIFFICULTIES.includes(normalizedDifficulty)) {
    throw new QuestionGenerationError('difficulty must be easy, medium, or hard', 400, 'INVALID_DIFFICULTY');
  }

  return normalizedDifficulty;
};

/**
 * Strips trailing commas and other common JSON formatting bugs.
 */
const repairJson = (text) => {
  let cleaned = text.trim();
  // Strip trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  return cleaned;
};

/**
 * Extracts and cleans JSON from GROQ text output.
 */
const extractJson = (text) => {
  if (!text || typeof text !== 'string') {
    throw new QuestionGenerationError('GROQ returned an empty response', 502, 'GROQ_INVALID_RESPONSE');
  }

  const cleanedText = text.trim();
  console.log('[Question JSON Parsing] Raw text length:', cleanedText.length);

  // Look for markdown code block with or without "json" label
  const fencedRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const match = cleanedText.match(fencedRegex);
  let jsonText = match ? match[1].trim() : cleanedText;

  // If JSON is not wrapped in backticks but has text before/after, slice to boundaries
  if (!jsonText.startsWith('{') && jsonText.includes('{')) {
    jsonText = jsonText.slice(jsonText.indexOf('{'));
  }
  if (!jsonText.endsWith('}') && jsonText.includes('}')) {
    jsonText = jsonText.slice(0, jsonText.lastIndexOf('}') + 1);
  }

  console.log('[Question JSON Parsing] Extracted JSON text length:', jsonText.length);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.warn('[Question JSON Parsing] Initial JSON.parse failed. Attempting repair...', error.message);
    try {
      const repairedText = repairJson(jsonText);
      const parsed = JSON.parse(repairedText);
      console.log('[Question JSON Parsing] JSON parsed successfully after repair.');
      return parsed;
    } catch (repairError) {
      console.error('[Question JSON Parsing] JSON repair failed:', repairError.message);
      throw new QuestionGenerationError(
        `JSON parse failure: Failed to parse JSON response from GROQ. ${error.message}`,
        502,
        'JSON_PARSE_FAILURE'
      );
    }
  }
};

const normalizeQuestionData = (data, requestedDifficulty) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new QuestionGenerationError('Schema validation failure: GROQ question output must be an object matching the question schema', 502, 'SCHEMA_VALIDATION_FAILURE');
  }

  const question = typeof data.question === 'string' ? data.question.trim() : '';
  const category = typeof data.category === 'string' ? data.category.trim() : '';
  const difficulty = typeof data.difficulty === 'string' ? data.difficulty.toLowerCase().trim() : '';
  const source = typeof data.source === 'string' ? data.source.trim() : '';
  const reason = typeof data.reason === 'string' ? data.reason.trim() : '';

  if (!question) {
    throw new QuestionGenerationError('Schema validation failure: GROQ question output is missing question text', 502, 'SCHEMA_VALIDATION_FAILURE');
  }

  // Supply safe default if category, source, or reason is missing/invalid
  const validatedCategory = ALLOWED_CATEGORIES.includes(category) ? category : 'Technical';
  const validatedDifficulty = difficulty === requestedDifficulty ? difficulty : requestedDifficulty;
  const validatedSource = ALLOWED_SOURCES.includes(source) ? source : 'session_context';
  const validatedReason = reason ? reason : 'Standard session progression matching template focus.';

  return {
    question,
    category: validatedCategory,
    difficulty: validatedDifficulty,
    source: validatedSource,
    reason: validatedReason
  };
};

/**
 * Premium local question generator (for offline / 429 quota failures).
 */
const generateQuestionLocally = ({ session, difficulty }) => {
  console.log('[Local Question Generator] Activating fallback interviewer engine...');

  const templateType = session.templateType || 'technical';
  const skills = session.resumeData?.skills || [];
  const projects = session.resumeData?.projects || [];
  const requiredSkills = session.jdData?.requiredSkills || [];

  // Pick some primary skills for custom template insertion
  const primarySkill = skills[0] || requiredSkills[0] || 'Software Engineering';
  const secondarySkill = skills[1] || requiredSkills[1] || 'System Design';
  const primaryProject = projects[0] ? String(projects[0]).replace(/^[-\s*]+/, '') : 'CodeSangram Workspace';

  const hrQuestions = [
    {
      question: `Could you walk me through a challenging problem you faced while building "${primaryProject}", and how you went about resolving it?`,
      category: 'Behavioral',
      source: 'resume_project',
      reason: 'Discussing candidate experience and problem-solving through their resume projects.'
    },
    {
      question: `Since you are interested in this position, why do you believe your experience in ${primarySkill} makes you a strong match for our requirements?`,
      category: 'Behavioral',
      source: 'jd_requirement',
      reason: 'Evaluating role interest and skill alignment.'
    },
    {
      question: "Can you describe a situation where you had to quickly adapt to a new technology or tool? How did you approach the learning curve?",
      category: 'Behavioral',
      source: 'behavioral',
      reason: 'Assessing adaptiveness and self-learning capabilities.'
    }
  ];

  const genaiQuestions = [
    {
      question: "In standard Retrieval-Augmented Generation (RAG) systems, what strategies do you employ to improve chunking precision and reduce LLM hallucinations?",
      category: 'Generative AI',
      source: 'jd_requirement',
      reason: 'Evaluating technical depth in generative AI architecture.'
    },
    {
      question: "What are the core differences between fine-tuning a pre-trained large language model (LLM) versus utilizing in-context learning or Prompt Engineering?",
      category: 'Generative AI',
      source: 'session_context',
      reason: 'Assessing model customization knowledge.'
    },
    {
      question: "How do vector databases handle index structures like HNSW (Hierarchical Navigable Small World) to achieve high-performance similarity search?",
      category: 'Generative AI',
      source: 'jd_requirement',
      reason: 'Testing vector search indexing mechanics.'
    }
  ];

  const codingQuestions = [
    {
      question: "How do you evaluate the time and space complexity of a complex recursive algorithm, such as depth-first search on a large graph? What measures prevent stack overflows?",
      category: 'DSA',
      source: 'session_context',
      reason: 'Testing algorithm optimization and complexity analysis.'
    },
    {
      question: "Can you explain how a hash table handles key collisions in memory under the hood? What does the worst-case lookup time become in such cases?",
      category: 'DSA',
      source: 'session_context',
      reason: 'Testing standard data structure internals.'
    }
  ];

  const technicalQuestions = [
    {
      question: `Since your resume highlights ${primarySkill}, can you explain the critical architectural differences between client-side rendering (CSR) and server-side rendering (SSR) for that stack?`,
      category: 'Backend',
      source: 'resume_skill',
      reason: 'Testing depth of core engineering skills.'
    },
    {
      question: `How do you optimize slow read queries inside a database like ${secondarySkill || 'MongoDB'}? Can you explain the role of compound indexes and explain-plans?`,
      category: 'Backend',
      source: 'resume_skill',
      reason: 'Evaluating data layer optimization capabilities.'
    },
    {
      question: "Explain the concepts of database normalization and denormalization. Under what practical scenarios would you choose one over the other?",
      category: 'DBMS',
      source: 'session_context',
      reason: 'Testing database design principles.'
    }
  ];

  // Combine and pick the list based on template focus
  let selectedList = technicalQuestions;
  if (templateType === 'hr') selectedList = hrQuestions;
  else if (templateType === 'genai') selectedList = genaiQuestions;
  else if (templateType === 'coding') selectedList = codingQuestions;
  else if (templateType === 'full-mock') {
    selectedList = [...hrQuestions, ...technicalQuestions, ...genaiQuestions];
  }

  // To prevent asking the same question, check the transcript
  const transcriptText = (session.transcript || []).map(t => String(t.content || t.text || t.message || '').toLowerCase()).join(' ');
  
  let chosen = selectedList[0];
  for (const item of selectedList) {
    if (!transcriptText.includes(item.question.toLowerCase().slice(0, 15))) {
      chosen = item;
      break;
    }
  }

  return {
    question: chosen.question,
    category: chosen.category,
    difficulty: difficulty,
    source: chosen.source,
    reason: chosen.reason
  };
};

const buildQuestionPrompt = ({ session, difficulty }) => `
System Role: You are a Senior Technical Interviewer.

Generate exactly one personalized interview question for the candidate.

Question Generation Rules:
- Adapt to Resume Projects, Resume Skills, JD Requirements, Analysis Data, Interview Type, and Session Context.
- Use the selected interview template as a focus guide, without ignoring strong resume evidence.
- If templateType is coding, prefer question intent that points the user toward the coding round.
- If templateType is full-mock, rotate naturally across HR, technical, projects, GenAI, and coding readiness.
- Project-based questions have highest priority.
- If a project belongs to Generative AI, Machine Learning, Deep Learning, NLP, or Audio Processing, generate relevant domain-specific questions.
- Do not restrict the interviewer to only SDE topics.
- Identify the candidate's strongest technical domain and generate a question accordingly.
- Do not generate follow-up questions.
- Do not evaluate answers.
- Do not generate coding round tasks.

Priority Order:
1. Resume Projects
2. Resume Skills
3. JD Requirements
4. Missing Skills
5. Behavioral Questions

Allowed Categories:
${ALLOWED_CATEGORIES.map((category) => `- ${category}`).join('\n')}

Allowed Sources:
- resume_project
- resume_skill
- jd_requirement
- missing_skill
- behavioral
- session_context

Return ONLY valid JSON with this exact shape:
{
  "question": "",
  "category": "",
  "difficulty": "",
  "source": "",
  "reason": ""
}

Required difficulty: ${difficulty}

Interview Type:
${session.interviewType}

Template Type:
${session.templateType || 'technical'}

Template Focus:
${JSON.stringify(getTemplateFocus(session.templateType))}

Resume Data:
${JSON.stringify(session.resumeData)}

JD Data:
${JSON.stringify(session.jdData)}

Resume-JD Analysis Data:
${JSON.stringify(session.analysisData)}

Session Context Transcript:
${JSON.stringify(session.transcript || [])}
`;

const generateQuestionForSession = async ({ session, difficulty }) => {
  const normalizedDifficulty = validateDifficulty(difficulty);

  if (!process.env.GROQ_API_KEY) {
    throw new QuestionGenerationError('Groq API key is not configured', 500, 'GROQ_NOT_CONFIGURED');
  }

  console.log('[Question GROQ Request] API Key exists: true');
  console.log('[Question GROQ Request] Model name: GROQ-2.5-flash');

  try {
    const responseText = await generateContent({
      prompt: buildQuestionPrompt({
        session,
        difficulty: normalizedDifficulty
      }),
      jsonMode: true
    });

    // Log response details
    console.log('[Question GROQ Response] Request status: SUCCESS');
    console.log('[Question GROQ Response] Raw output:', responseText);

    if (!responseText) {
      throw new QuestionGenerationError('Invalid GROQ response: GROQ returned empty content', 502, 'GROQ_INVALID_RESPONSE');
    }

    const parsedData = extractJson(responseText);
    return normalizeQuestionData(parsedData, normalizedDifficulty);
  } catch (error) {
    // If it's a known schema validation or difficulty error, propagate it
    if (error instanceof QuestionGenerationError && error.code !== 'JSON_PARSE_FAILURE') {
      console.warn(`⚠️ Question generator error occurred: [${error.code}] ${error.message}`);
      throw error;
    }

    // For GROQ API errors (rate limits, 429s, network failures, etc.) or JSON parse failure, trigger premium local fallback
    console.warn("⚠️ GROQ API or JSON parsing failure on Question Generation, activating premium local interviewer engine. Reason:", error.message);
    
    // Log details of the fallback trigger
    if (error instanceof QuestionGenerationError && error.code === 'JSON_PARSE_FAILURE') {
      console.warn('Question fallback activated due to: JSON_PARSE_FAILURE');
    } else {
      console.warn('Question fallback activated due to: GROQ_API_FAILURE');
    }

    return generateQuestionLocally({ session, difficulty: normalizedDifficulty });
  }
};

module.exports = {
  QuestionGenerationError,
  validateDifficulty,
  generateQuestionForSession
};
