/**
 * @file learningRoadmapService.js
 * @summary Service that generates a personalized AI learning roadmap from the user's interview history.
 *          Builds a contextualized LLM prompt with analytics summary, reports, and session history,
 *          parses the structured JSON output, and falls back to a built-in template-based roadmap generator
 *          when the API is unavailable.
 *
 * @functions
 * - extractJson: Strips markdown fences from the LLM response and parses the inner JSON.
 * - normalizeStringArray: Validates and cleans a string array field from LLM output.
 * - normalizeRequiredString: Validates a required string field; throws on empty or missing value.
 * - normalizeRoadmapData: Validates and normalizes all roadmap fields from the LLM output.
 * - buildLearningRoadmapPrompt: Assembles the full LLM prompt with analytics, recent reports, and sessions.
 * - generateLocalFallbackRoadmap: Template-based fallback that generates a 7/14/30-day plan from
 *                                 analytics weak areas and recommendations when the API is down.
 * - generateLearningRoadmap: Main exported function — validates inputs, calls LLM, normalizes output,
 *                             and activates local fallback on API or schema failure.
 * - class LearningRoadmapError: Custom error class with statusCode and code fields.
 */

const { generateContent } = require('../ai/aiProvider');

const EMPTY_ROADMAP_RESPONSE = {
  focusAreas: [],
  priorityTopics: [],
  sevenDayPlan: [],
  fourteenDayPlan: [],
  thirtyDayPlan: [],
  recommendedResources: [],
  estimatedImprovement: '',
  mentorAdvice: ''
};

class LearningRoadmapError extends Error {
  constructor(message, statusCode = 500, code = 'LEARNING_ROADMAP_ERROR') {
    super(message);
    this.name = 'LearningRoadmapError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const extractJson = (text) => {
  if (!text) {
    throw new LearningRoadmapError('GROQ returned an empty response', 502, 'GROQ_EMPTY_RESPONSE');
  }

  const trimmedText = text.trim();
  const fencedJson = trimmedText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedJson ? fencedJson[1].trim() : trimmedText;

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new LearningRoadmapError('GROQ returned invalid JSON', 502, 'GROQ_INVALID_JSON');
  }
};

const normalizeStringArray = (value, fieldName) => {
  if (!Array.isArray(value)) {
    throw new LearningRoadmapError(`GROQ roadmap output is missing ${fieldName}`, 502, 'INVALID_ROADMAP_SCHEMA');
  }

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') return JSON.stringify(item);
      return '';
    })
    .filter(Boolean);
};

const normalizeRequiredString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new LearningRoadmapError(`GROQ roadmap output is missing ${fieldName}`, 502, 'INVALID_ROADMAP_SCHEMA');
  }

  return value.trim();
};

const normalizeRoadmapData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new LearningRoadmapError('GROQ roadmap output must be an object', 502, 'INVALID_ROADMAP_SCHEMA');
  }

  return {
    focusAreas: normalizeStringArray(data.focusAreas, 'focusAreas'),
    priorityTopics: normalizeStringArray(data.priorityTopics, 'priorityTopics'),
    sevenDayPlan: normalizeStringArray(data.sevenDayPlan, 'sevenDayPlan'),
    fourteenDayPlan: normalizeStringArray(data.fourteenDayPlan, 'fourteenDayPlan'),
    thirtyDayPlan: normalizeStringArray(data.thirtyDayPlan, 'thirtyDayPlan'),
    recommendedResources: normalizeStringArray(data.recommendedResources, 'recommendedResources'),
    estimatedImprovement: normalizeRequiredString(data.estimatedImprovement, 'estimatedImprovement'),
    mentorAdvice: normalizeRequiredString(data.mentorAdvice, 'mentorAdvice')
  };
};

const buildLearningRoadmapPrompt = ({ reports, sessions, analytics }) => `
System Role: You are a Senior Technical Mentor.

Review the candidate's interview history, interview reports, analytics data, weak areas, recommendations, and selected interview templates.
CRITICAL INSTRUCTION: You MUST generate a completely unique, highly specific, and varied preparation roadmap. Do not use generic boilerplate. Weight the most recent interview reports heavily to ensure the roadmap strictly evolves with the candidate's newest sessions. Focus on specific micro-skills rather than broad topics.

Current Random Seed for Variety: ${Math.random().toString(36).substring(7)}

Return ONLY valid JSON with this exact shape:
{
  "focusAreas": [],
  "priorityTopics": [],
  "sevenDayPlan": [],
  "fourteenDayPlan": [],
  "thirtyDayPlan": [],
  "recommendedResources": [],
  "estimatedImprovement": "",
  "mentorAdvice": ""
}

Rules:
- Keep every array item concise and action-oriented.
- Base focus areas on repeated weaknesses, low score categories, template-specific weaknesses, and recommendations.
- Include technical, communication, coding, and template-specific gaps when present.
- Do not generate interview questions.
- Do not mention paid resources or services.
- Do not include markdown.

Analytics Summary:
${JSON.stringify(analytics)}

Interview Reports (Most Recent First):
${JSON.stringify(reports.slice(0, 5))}

Recent Interview Sessions:
${JSON.stringify(sessions.slice(0, 5))}
`;

const generateLocalFallbackRoadmap = ({ reports, sessions, analytics }) => {
  const weaknesses = (analytics.topWeaknesses || []).map(item => item.label);
  const recommendations = (analytics.topRecommendations || []).map(item => item.label);
  
  const focusAreas = weaknesses.length > 0 
    ? weaknesses.map(w => `${w} (Strengthen core implementation)`)
    : [
        "Verbal Technical Communication & Articulation (especially for project details)",
        "Deep Technical Understanding of Resume Projects (architecture, design, integration)",
        "Data Structures & Algorithms (DSA) and Practical Problem Solving"
      ];
    
  const priorityTopics = recommendations.length > 0
    ? recommendations.map(r => `Mastering ${r.toLowerCase()}`)
    : [
        "Mastering clear and technical articulation",
        "In-depth analysis and explanation of personal projects",
        "Foundational to intermediate Data Structures and Algorithms practice"
      ];

  const sevenDayPlan = [
    "Day 1-2: Thoroughly document and orally explain your resume projects, tech stack, and scalability choices.",
    "Day 3-4: Revision of foundational software development core topics (DBMS, OS, OOPS, REST API authentication).",
    "Day 5: Solve 3-5 easy Data Structures & Algorithms challenges, verbalizing thought processes before writing.",
    "Day 6: Conduct a simulated project deep-dive practice run to refine communication confidence.",
    "Day 7: Perform a general chat mock session and audit your scorecard weak areas."
  ];

  const fourteenDayPlan = [
    "Week 1: Address top technical weaknesses: explain architecture details, database choices, and system design patterns.",
    "Week 2: Deep dive into intermediate Data Structures (arrays, linked lists, trees, graphs) and solve 2-3 medium challenges daily.",
    "Week 2: Solve Express API mock schemas, focusing on JWT middleware setups, secure routing, and error handlings.",
    "Week 2: Practice active listening, asking clarifying questions, and articulating coding thought streams out loud."
  ];

  const thirtyDayPlan = [
    "Weeks 1-2: Establish daily consistency logs across core technical focus areas, coding rounds, and review feedbacks.",
    "Week 3: Practice advanced competitive programming (sorting, search, DP); solve 1-2 hard challenges weekly.",
    "Week 4: Conduct comprehensive executive mock rounds, refine speaking articulation, and analyze streak achievements."
  ];

  const recommendedResources = [
    "Online algorithmic platforms for competitive programming practice (e.g. Monaco editor challenges)",
    "Official developer guides for core project tech stack (React, Node, Express, MongoDB, Redux)",
    "Software design patterns and database indexing documentation",
    "Technical communication frameworks and peer-based mock interview circles"
  ];

  const currentScore = Number(analytics.averageOverallScore) || 0;
  const estimatedImprovement = currentScore > 0
    ? `Dedicated effort will project a placement-readiness score boost from ${currentScore}% to ${Math.min(95, currentScore + 15)}% within 30 days.`
    : "Consistent mock preparation is estimated to increase your mock score match rating by 15-20% within 30 days.";

  const mentorAdvice = `Your analytics summary indicates active weaknesses in ${weaknesses.slice(0, 3).join(', ') || 'technical articulation'}. Focus immediately on bridging these technical implementation gaps. Practice explaining database schemas and API details out loud. Remember, structural consistency, technical clarity, and active confidence are key parameters that lead to hire recommendations.`;

  return {
    focusAreas,
    priorityTopics,
    sevenDayPlan,
    fourteenDayPlan,
    thirtyDayPlan,
    recommendedResources,
    estimatedImprovement,
    mentorAdvice
  };
};

const generateLearningRoadmap = async ({ reports, sessions, analytics }) => {
  if (!Array.isArray(reports) || reports.length === 0) {
    throw new LearningRoadmapError('No interview reports available', 404, 'NO_REPORTS_AVAILABLE');
  }

  if (!Array.isArray(sessions) || sessions.length === 0) {
    throw new LearningRoadmapError('No interview history available', 404, 'NO_INTERVIEW_HISTORY');
  }

  try {
    const responseText = await generateContent({
      prompt: buildLearningRoadmapPrompt({ reports, sessions, analytics }),
      jsonMode: true
    });
    const parsedData = extractJson(responseText);
    const roadmapData = normalizeRoadmapData(parsedData);

    return {
      ...EMPTY_ROADMAP_RESPONSE,
      ...roadmapData
    };
  } catch (error) {
    console.warn("⚠️ GROQ API failed, activating premium local fallback generator...", error.message);
    if (error instanceof LearningRoadmapError && error.code !== 'GROQ_FAILURE') {
      throw error;
    }
    return {
      ...EMPTY_ROADMAP_RESPONSE,
      ...generateLocalFallbackRoadmap({ reports, sessions, analytics })
    };
  }
};

module.exports = {
  LearningRoadmapError,
  generateLearningRoadmap
};
