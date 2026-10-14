/**
 * @file followUpQuestionService.js
 * @summary Service that generates an AI-driven contextual follow-up question based on the candidate's
 *          last answer and its evaluation score. Calls the Groq/Gemini LLM with a full interview context
 *          prompt and falls back to a built-in rule-based question engine on API failure.
 *
 * @functions
 * - extractJson: Strips markdown fences from the LLM response and parses the inner JSON.
 * - normalizeDifficulty: Validates and lowercases the difficulty field from LLM output.
 * - normalizeFollowUpData: Validates all fields (question, category, difficulty, reason) from LLM output.
 * - buildFollowUpPrompt: Assembles the full Groq prompt from session context, transcript, and evaluation.
 * - generateFollowUpQuestionLocally: Rule-based fallback that generates contextual follow-ups by scanning
 *                                    answer keywords for Frontend, JS, DBMS, or System Design topics.
 * - generateFollowUpQuestionForSession: Main function — validates transcript history, calls LLM,
 *                                       and activates the local fallback on API or parse failure.
 * - class FollowUpQuestionError: Custom error class with statusCode and code fields.
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

class FollowUpQuestionError extends Error {
  constructor(message, statusCode = 500, code = 'FOLLOW_UP_QUESTION_ERROR') {
    super(message);
    this.name = 'FollowUpQuestionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const extractJson = (text) => {
  if (!text) {
    throw new FollowUpQuestionError('GROQ returned an empty response', 502, 'GROQ_EMPTY_RESPONSE');
  }

  const trimmedText = text.trim();
  const fencedJson = trimmedText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedJson ? fencedJson[1].trim() : trimmedText;

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new FollowUpQuestionError('GROQ returned invalid JSON', 502, 'GROQ_INVALID_JSON');
  }
};

const normalizeDifficulty = (value) => {
  if (typeof value !== 'string') {
    throw new FollowUpQuestionError('GROQ follow-up output has invalid difficulty', 502, 'INVALID_FOLLOW_UP_SCHEMA');
  }

  const difficulty = value.toLowerCase().trim();

  if (!ALLOWED_DIFFICULTIES.includes(difficulty)) {
    throw new FollowUpQuestionError('GROQ follow-up output has invalid difficulty', 502, 'INVALID_FOLLOW_UP_SCHEMA');
  }

  return difficulty;
};

const normalizeFollowUpData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new FollowUpQuestionError('GROQ follow-up output must be an object', 502, 'INVALID_FOLLOW_UP_SCHEMA');
  }

  const question = typeof data.question === 'string' ? data.question.trim() : '';
  const category = typeof data.category === 'string' ? data.category.trim() : '';
  const difficulty = normalizeDifficulty(data.difficulty);
  const reason = typeof data.reason === 'string' ? data.reason.trim() : '';

  if (!question) {
    throw new FollowUpQuestionError('GROQ follow-up output is missing question', 502, 'INVALID_FOLLOW_UP_SCHEMA');
  }

  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new FollowUpQuestionError('GROQ follow-up output has invalid category', 502, 'INVALID_FOLLOW_UP_SCHEMA');
  }

  if (!reason) {
    throw new FollowUpQuestionError('GROQ follow-up output is missing reason', 502, 'INVALID_FOLLOW_UP_SCHEMA');
  }

  return {
    question,
    category,
    difficulty,
    reason
  };
};

const buildFollowUpPrompt = ({ session, previousQuestion, candidateAnswer, evaluation }) => `
System Role: You are a Senior Technical Interviewer.

Your objective is to dig deeper into the candidate's previous answer.
Behave like a real interviewer.

Follow-Up Rules:
- If the answer is strong, ask a deeper technical question.
- If the answer is weak, ask a clarification question.
- If a project is mentioned, dive deeper into project architecture.
- If a GenAI topic is mentioned, ask deeper GenAI questions.
- The follow-up must reference the previous answer.
- Be context aware.
- Feel natural.
- Avoid repetition.
- Increase or decrease difficulty intelligently based on the evaluation.
- Do not evaluate the answer again.
- Do not generate a scorecard.
- Do not generate coding round tasks.

Allowed Categories:
${ALLOWED_CATEGORIES.map((category) => `- ${category}`).join('\n')}

Allowed Difficulties:
- easy
- medium
- hard

Return ONLY valid JSON with this exact shape:
{
  "question": "",
  "category": "",
  "difficulty": "",
  "reason": ""
}

Previous Interviewer Question:
${JSON.stringify(previousQuestion)}

Candidate Answer:
${JSON.stringify(candidateAnswer)}

Latest Evaluation:
${JSON.stringify(evaluation)}

Interview Type:
${session.interviewType}

Resume Data:
${JSON.stringify(session.resumeData)}

JD Data:
${JSON.stringify(session.jdData)}

Resume-JD Analysis Data:
${JSON.stringify(session.analysisData)}

Recent Transcript:
${JSON.stringify((session.transcript || []).slice(-10))}
`;

const generateFollowUpQuestionLocally = (previousQuestionText, candidateAnswerText, evaluation) => {
  const normAnswer = (candidateAnswerText || '').toLowerCase();
  const normQuestion = (previousQuestionText || '').toLowerCase();
  const score = evaluation?.score || 60;

  // Let's determine follow-up topics based on candidate answer key terms
  let followUpQuestionText = "";
  let category = "Backend";
  let difficulty = "medium";
  let reason = "Deepening understanding of active technical concepts.";

  if (normQuestion.includes('csr') || normQuestion.includes('ssr') || normAnswer.includes('render') || normAnswer.includes('client-side') || normAnswer.includes('server-side')) {
    category = "Frontend";
    if (score < 65) {
      difficulty = "easy";
      followUpQuestionText = "You explained rendering on the client and server side. Can you clarify how standard search engine crawlers (like Googlebot) read client-side rendered HTML compared to server-rendered pages?";
      reason = "Clarifying SEO impact based on candidate answer.";
    } else {
      difficulty = "hard";
      followUpQuestionText = "That's a good summary of client vs server rendering. Since you mentioned the server retrieving data from the database, how does hydration work on the client side to attach event listeners once the server-rendered HTML is loaded in the browser?";
      reason = "Deep-dive into client-side hydration for server-rendered apps.";
    }
  } else if (normQuestion.includes('javascript') || normQuestion.includes('js') || normAnswer.includes('closure') || normAnswer.includes('loop')) {
    category = "Frontend";
    if (score < 65) {
      difficulty = "easy";
      followUpQuestionText = "You mentioned variables and scope. Can you explain a simple real-world use case for JavaScript closures in state retention or data encapsulation?";
      reason = "Clarifying closure usage in frontend development.";
    } else {
      difficulty = "hard";
      followUpQuestionText = "Since we are talking about execution models, how does the JavaScript Event Loop coordinate the execution of microtasks (like Promise callbacks) compared to macrotasks (like setTimeout) inside the single thread?";
      reason = "Deep-dive into async event loops and call stacks.";
    }
  } else if (normQuestion.includes('database') || normQuestion.includes('schema') || normAnswer.includes('schema') || normAnswer.includes('query')) {
    category = "DBMS";
    if (score < 65) {
      difficulty = "easy";
      followUpQuestionText = "You discussed collections and schemas. Can you explain the primary structural difference between SQL relations and NoSQL collections in terms of scalability?";
      reason = "Testing basic database scaling strategies.";
    } else {
      difficulty = "hard";
      followUpQuestionText = "Since queries and schemas scale, how would you design database indexing strategies in MongoDB to optimize queries for nested arrays and avoid full-collection scans under high-concurrency environments?";
      reason = "Advanced database query performance optimizations.";
    }
  } else {
    // Default general technical follow-up
    category = "System Design";
    if (score < 65) {
      difficulty = "medium";
      followUpQuestionText = `You discussed the concept of scaling services. Could you clarify what specific trade-offs we encounter when migrating a monolith architecture to distributed microservices?`;
      reason = "Investigating basic monolith vs microservice architectures.";
    } else {
      difficulty = "hard";
      followUpQuestionText = `Excellent overview. Given those architectural trade-offs, how would you approach state management and data consistency across distributed database layers in highly-available microservices?`;
      reason = "Advanced distributed data patterns and consistency levels.";
    }
  }

  return {
    question: followUpQuestionText,
    category,
    difficulty,
    reason
  };
};

const generateFollowUpQuestionForSession = async ({
  session,
  previousQuestion,
  candidateAnswer,
  evaluation
}) => {
  if (!previousQuestion?.message) {
    throw new FollowUpQuestionError('Missing question history', 400, 'MISSING_QUESTION_HISTORY');
  }

  if (!candidateAnswer?.message) {
    throw new FollowUpQuestionError('Missing answer history', 400, 'MISSING_ANSWER_HISTORY');
  }

  if (!evaluation || evaluation.role !== 'evaluation') {
    throw new FollowUpQuestionError('Missing evaluation', 400, 'MISSING_EVALUATION');
  }

  try {
    const responseText = await generateContent({
      prompt: buildFollowUpPrompt({
        session,
        previousQuestion,
        candidateAnswer,
        evaluation
      }),
      jsonMode: true
    });
    const parsedData = extractJson(responseText);

    return normalizeFollowUpData(parsedData);
  } catch (error) {
    console.warn("⚠️ GROQ API or JSON parsing failure on Follow-up Question Generation, activating premium local interviewer engine. Reason:", error.message || error);
    
    try {
      return generateFollowUpQuestionLocally(
        previousQuestion.message || '',
        candidateAnswer.message || '',
        evaluation
      );
    } catch (fallbackError) {
      console.error("Local follow-up fallback failed:", fallbackError);
      if (error instanceof FollowUpQuestionError) throw error;
      throw new FollowUpQuestionError('GROQ failed to generate follow-up question', 502, 'GROQ_FAILURE');
    }
  }
};

module.exports = {
  FollowUpQuestionError,
  generateFollowUpQuestionForSession
};
