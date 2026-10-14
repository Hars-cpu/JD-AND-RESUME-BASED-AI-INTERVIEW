/**
 * @file scorecardGenerationService.js
 * @summary Service that generates the final AI interview scorecard from the full session transcript.
 *          Sends the complete session context (transcript, resume, JD, analysis) to the Groq/Gemini LLM
 *          and returns a normalized scorecard with 5 dimension scores, strengths/weaknesses/recommendations,
 *          an interview summary, and a hire recommendation. Falls back to a local scoring engine when the
 *          API is unavailable.
 *
 * @functions
 * - extractJson: Strips markdown fences from the LLM response and parses the inner JSON.
 * - normalizeScore: Clamps and rounds a score value to an integer in [0, 100].
 * - normalizeStringArray: Validates and cleans a string array field from LLM output.
 * - normalizeScorecardData: Validates all 5 score fields, string arrays, and the hireRecommendation enum.
 * - buildScorecardPrompt: Assembles the full LLM prompt with session context and the expected JSON schema.
 * - average: Computes the rounded mean of a numeric array, with a fallback for empty arrays.
 * - clampScore: Clamps a raw number to [0, 100].
 * - getText: Extracts a display string from a transcript turn (message, feedback, or title).
 * - collectUniqueItems: Gathers unique items from a named array field across all evaluation turns.
 * - getHireRecommendation: Maps an overall score to a Strong Hire/Hire/Borderline/No Hire label.
 * - generateLocalScorecard: Local fallback — aggregates per-turn evaluation scores, computes dimension
 *                           scores, collects strengths/weaknesses from evaluation turns, and generates
 *                           a plain-text interview summary without calling the LLM.
 * - generateScorecardForSession: Main exported function — validates transcript, calls LLM, normalizes output,
 *                                and activates local fallback on any API or schema failure.
 * - class ScorecardGenerationError: Custom error class with statusCode and code fields.
 */

const { generateContent } = require('../ai/aiProvider');

const ALLOWED_HIRE_RECOMMENDATIONS = ['Strong Hire', 'Hire', 'Borderline', 'No Hire'];

const EMPTY_SCORECARD_RESPONSE = {
  overallScore: 0,
  technicalScore: 0,
  communicationScore: 0,
  problemSolvingScore: 0,
  projectDiscussionScore: 0,
  strengths: [],
  weaknesses: [],
  recommendations: [],
  interviewSummary: '',
  hireRecommendation: ''
};

class ScorecardGenerationError extends Error {
  constructor(message, statusCode = 500, code = 'SCORECARD_GENERATION_ERROR') {
    super(message);
    this.name = 'ScorecardGenerationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const extractJson = (text) => {
  if (!text) {
    throw new ScorecardGenerationError('GROQ returned an empty response', 502, 'GROQ_EMPTY_RESPONSE');
  }

  const trimmedText = text.trim();
  const fencedJson = trimmedText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedJson ? fencedJson[1].trim() : trimmedText;

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new ScorecardGenerationError('GROQ returned invalid JSON', 502, 'GROQ_INVALID_JSON');
  }
};

const normalizeScore = (value, fieldName) => {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    throw new ScorecardGenerationError(`GROQ scorecard output has invalid ${fieldName}`, 502, 'INVALID_SCORECARD_SCHEMA');
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

const normalizeStringArray = (value, fieldName) => {
  if (!Array.isArray(value)) {
    throw new ScorecardGenerationError(`GROQ scorecard output is missing ${fieldName}`, 502, 'INVALID_SCORECARD_SCHEMA');
  }

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') return JSON.stringify(item);
      return '';
    })
    .filter(Boolean);
};

const normalizeScorecardData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ScorecardGenerationError('GROQ scorecard output must be an object', 502, 'INVALID_SCORECARD_SCHEMA');
  }

  const interviewSummary = typeof data.interviewSummary === 'string' ? data.interviewSummary.trim() : '';
  const hireRecommendation = typeof data.hireRecommendation === 'string' ? data.hireRecommendation.trim() : '';

  if (!interviewSummary) {
    throw new ScorecardGenerationError('GROQ scorecard output is missing interviewSummary', 502, 'INVALID_SCORECARD_SCHEMA');
  }

  if (!ALLOWED_HIRE_RECOMMENDATIONS.includes(hireRecommendation)) {
    throw new ScorecardGenerationError('GROQ scorecard output has invalid hireRecommendation', 502, 'INVALID_SCORECARD_SCHEMA');
  }

  return {
    overallScore: normalizeScore(data.overallScore, 'overallScore'),
    technicalScore: normalizeScore(data.technicalScore, 'technicalScore'),
    communicationScore: normalizeScore(data.communicationScore, 'communicationScore'),
    problemSolvingScore: normalizeScore(data.problemSolvingScore, 'problemSolvingScore'),
    projectDiscussionScore: normalizeScore(data.projectDiscussionScore, 'projectDiscussionScore'),
    strengths: normalizeStringArray(data.strengths, 'strengths'),
    weaknesses: normalizeStringArray(data.weaknesses, 'weaknesses'),
    recommendations: normalizeStringArray(data.recommendations, 'recommendations'),
    interviewSummary,
    hireRecommendation
  };
};

const buildScorecardPrompt = ({ session }) => `
System Role: You are a Senior Technical Interview Panel.

Review the entire interview transcript and generate a detailed interview assessment.

Evaluation Criteria:
1. Technical Knowledge
2. Communication Skills
3. Problem Solving
4. Project Understanding
5. Confidence
6. Overall Readiness

Return ONLY valid JSON with this exact shape:
{
  "overallScore": 0,
  "technicalScore": 0,
  "communicationScore": 0,
  "problemSolvingScore": 0,
  "projectDiscussionScore": 0,
  "strengths": [],
  "weaknesses": [],
  "recommendations": [],
  "interviewSummary": "",
  "hireRecommendation": ""
}

Rules:
- All scores must be integers from 0 to 100.
- hireRecommendation must be one of: Strong Hire, Hire, Borderline, No Hire.
- Base the assessment on the full transcript and evaluation entries.
- Consider resume, JD, analysis, and interview type as context.
- Do not generate new interview questions.
- Do not include markdown.

Interview Type:
${session.interviewType}

Resume Data:
${JSON.stringify(session.resumeData)}

JD Data:
${JSON.stringify(session.jdData)}

Resume-JD Analysis Data:
${JSON.stringify(session.analysisData)}

Full Interview Transcript:
${JSON.stringify(session.transcript || [])}
`;

const average = (values, fallback = 0) => {
  const usableValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (usableValues.length === 0) return fallback;
  return Math.round(usableValues.reduce((sum, value) => sum + value, 0) / usableValues.length);
};

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const getText = (turn) => [
  turn?.message,
  turn?.overallFeedback,
  turn?.title,
  turn?.description
].filter(Boolean).join(' ');

const collectUniqueItems = (turns, fieldName) => {
  const items = turns.flatMap((turn) => Array.isArray(turn?.[fieldName]) ? turn[fieldName] : []);

  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))].slice(0, 5);
};

const getHireRecommendation = (overallScore) => {
  if (overallScore >= 85) return 'Strong Hire';
  if (overallScore >= 70) return 'Hire';
  if (overallScore >= 55) return 'Borderline';
  return 'No Hire';
};

const generateLocalScorecard = (session) => {
  const transcript = Array.isArray(session?.transcript) ? session.transcript : [];
  const evaluations = transcript.filter((turn) => turn.role === 'evaluation' || turn.role === 'coding-evaluation');
  const candidateTurns = transcript.filter((turn) => turn.role === 'candidate' || turn.role === 'coding-submission');
  const interviewerTurns = transcript.filter((turn) => turn.role === 'interviewer' || turn.role === 'coding-question');
  const transcriptText = transcript.map(getText).join(' ').toLowerCase();
  const answerWordCounts = candidateTurns.map((turn) => String(turn.message || turn.code || '').split(/\s+/).filter(Boolean).length);
  const averageAnswerWords = average(answerWordCounts, 0);

  const technicalScore = clampScore(average([
    ...evaluations.map((turn) => turn.technicalAccuracy),
    ...evaluations.map((turn) => turn.practicalKnowledge),
    ...evaluations.map((turn) => turn.correctnessScore)
  ], evaluations.length ? 60 : 50));

  const communicationScore = clampScore(average([
    ...evaluations.map((turn) => turn.communication),
    averageAnswerWords >= 80 ? 82 : averageAnswerWords >= 40 ? 70 : 55
  ], 60));

  const problemSolvingScore = clampScore(average([
    ...evaluations.map((turn) => turn.depth),
    ...evaluations.map((turn) => turn.completeness),
    ...evaluations.map((turn) => turn.correctnessScore)
  ], evaluations.length ? 60 : 50));

  const projectKeywords = ['project', 'architecture', 'database', 'api', 'deployment', 'scalability', 'security'];
  const projectSignal = projectKeywords.filter((keyword) => transcriptText.includes(keyword)).length;
  const projectDiscussionScore = clampScore(average([
    ...evaluations.map((turn) => turn.practicalKnowledge),
    projectSignal >= 4 ? 82 : projectSignal >= 2 ? 70 : 55
  ], 60));

  const overallScore = clampScore(average([
    ...evaluations.map((turn) => turn.score),
    technicalScore,
    communicationScore,
    problemSolvingScore,
    projectDiscussionScore
  ], 60));

  const strengths = collectUniqueItems(evaluations, 'strengths');
  const weaknesses = collectUniqueItems(evaluations, 'weaknesses');
  const improvements = collectUniqueItems(evaluations, 'improvements');

  if (candidateTurns.length > 0 && averageAnswerWords >= 50) {
    strengths.push('Provided sufficiently detailed responses across the interview.');
  }

  if (technicalScore >= 70) {
    strengths.push('Demonstrated a solid baseline of technical understanding.');
  }

  if (candidateTurns.length === 0) {
    weaknesses.push('No candidate answers were submitted for evaluation.');
  } else if (averageAnswerWords < 35) {
    weaknesses.push('Responses were brief and need more technical depth.');
  }

  if (problemSolvingScore < 70) {
    weaknesses.push('Problem solving explanations need clearer reasoning and trade-off analysis.');
  }

  const recommendations = improvements.length ? improvements : [
    'Practice answering with structured examples, trade-offs, and implementation details.',
    'Review weak technical areas from the mock interview before the next session.',
    'Use the coding workspace to verbalize problem-solving steps before writing code.'
  ];

  const interviewSummary = [
    `Local scorecard generated from ${interviewerTurns.length} interviewer prompt(s), ${candidateTurns.length} candidate response(s), and ${evaluations.length} evaluation turn(s).`,
    `Overall readiness is ${overallScore}% with strongest signal in ${technicalScore >= communicationScore ? 'technical content' : 'communication'} and improvement focus around ${problemSolvingScore < 70 ? 'problem-solving depth' : 'consistent elaboration'}.`
  ].join(' ');

  return {
    overallScore,
    technicalScore,
    communicationScore,
    problemSolvingScore,
    projectDiscussionScore,
    strengths: [...new Set(strengths)].slice(0, 5),
    weaknesses: [...new Set(weaknesses)].slice(0, 5),
    recommendations: [...new Set(recommendations)].slice(0, 5),
    interviewSummary,
    hireRecommendation: getHireRecommendation(overallScore)
  };
};

const generateScorecardForSession = async (session) => {
  if (!Array.isArray(session?.transcript) || session.transcript.length === 0) {
    throw new ScorecardGenerationError('Interview transcript is empty', 400, 'EMPTY_TRANSCRIPT');
  }

  try {
    const responseText = await generateContent({
      prompt: buildScorecardPrompt({ session }),
      jsonMode: true
    });
    const parsedData = extractJson(responseText);
    const scorecardData = normalizeScorecardData(parsedData);

    return {
      ...EMPTY_SCORECARD_RESPONSE,
      ...scorecardData
    };
  } catch (error) {
    console.warn('GROQ scorecard generation failed. Using local interview scorecard fallback. Reason:', error.message || error);
    return {
      ...EMPTY_SCORECARD_RESPONSE,
      ...generateLocalScorecard(session)
    };
  }
};

module.exports = {
  ScorecardGenerationError,
  generateLocalScorecard,
  generateScorecardForSession
};
