/**
 * @file preparationHubService.js
 * @summary Service that generates a multi-track personalized preparation plan from the user's roadmap
 *          and interview history. Calls the Groq/Gemini LLM to produce a structured list of study tracks
 *          (DSA, DBMS, Backend, etc.) with topics, practice tasks, priority, and expected outcomes.
 *          Falls back to a local rule-based track selector when the API is unavailable.
 *
 * @functions
 * - extractJson: Strips markdown fences from the LLM response and parses the inner JSON.
 * - normalizeStringArray: Validates and cleans a string array field from LLM output.
 * - normalizeEstimatedDays: Validates and clamps the estimatedDays number in a track.
 * - normalizeTrack: Validates all fields of a single prep track (name, priority, topics, etc.).
 * - normalizePreparationHubData: Validates the tracks array and maps each item through normalizeTrack.
 * - buildPreparationHubPrompt: Assembles the full LLM prompt with roadmap, analytics, and recent reports.
 * - textIncludesAny: Returns true if a string contains any keyword from a list.
 * - uniqueList: Deduplicates and trims an array to a maximum size.
 * - inferTrackName: Maps a free-text string to the closest supported SUPPORTED_TRACKS name.
 * - priorityFromSignals: Returns High/Medium/Low priority for a track based on dimension score averages.
 * - generateLocalPreparationHub: Rule-based fallback — infers tracks from roadmap/report keywords and
 *                                 maps them to pre-built topic/task templates from defaultTrackDetails.
 * - generatePreparationHub: Main exported function — validates inputs, calls LLM, normalizes output,
 *                            and activates local fallback on any failure.
 * - class PreparationHubError: Custom error class with statusCode and code fields.
 */

const { generateContent } = require('../ai/aiProvider');

const SUPPORTED_TRACKS = [
  'DSA',
  'DBMS',
  'Operating Systems',
  'Computer Networks',
  'OOPS',
  'System Design',
  'Frontend',
  'Backend',
  'Generative AI',
  'HR Preparation'
];

const PRIORITIES = ['High', 'Medium', 'Low'];

class PreparationHubError extends Error {
  constructor(message, statusCode = 500, code = 'PREPARATION_HUB_ERROR') {
    super(message);
    this.name = 'PreparationHubError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const extractJson = (text) => {
  if (!text) {
    throw new PreparationHubError('GROQ returned an empty response', 502, 'GROQ_EMPTY_RESPONSE');
  }

  const trimmedText = text.trim();
  const fencedJson = trimmedText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedJson ? fencedJson[1].trim() : trimmedText;

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new PreparationHubError('GROQ returned invalid JSON', 502, 'GROQ_INVALID_JSON');
  }
};

const normalizeStringArray = (value, fieldName) => {
  if (!Array.isArray(value)) {
    throw new PreparationHubError(`GROQ preparation hub output is missing ${fieldName}`, 502, 'INVALID_PREPARATION_HUB_SCHEMA');
  }

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') return JSON.stringify(item);
      return '';
    })
    .filter(Boolean);
};

const normalizeEstimatedDays = (value) => {
  const days = Number(value);

  if (!Number.isFinite(days) || days <= 0) {
    throw new PreparationHubError('GROQ preparation hub output has invalid estimatedDays', 502, 'INVALID_PREPARATION_HUB_SCHEMA');
  }

  return Math.max(1, Math.round(days));
};

const normalizeTrack = (track) => {
  if (!track || typeof track !== 'object' || Array.isArray(track)) {
    throw new PreparationHubError('GROQ preparation hub track must be an object', 502, 'INVALID_PREPARATION_HUB_SCHEMA');
  }

  const name = typeof track.name === 'string' ? track.name.trim() : '';
  const priority = typeof track.priority === 'string' ? track.priority.trim() : '';
  const expectedOutcome = typeof track.expectedOutcome === 'string' ? track.expectedOutcome.trim() : '';

  if (!SUPPORTED_TRACKS.includes(name)) {
    throw new PreparationHubError('GROQ preparation hub output has unsupported track name', 502, 'INVALID_PREPARATION_HUB_SCHEMA');
  }

  if (!PRIORITIES.includes(priority)) {
    throw new PreparationHubError('GROQ preparation hub output has invalid priority', 502, 'INVALID_PREPARATION_HUB_SCHEMA');
  }

  if (!expectedOutcome) {
    throw new PreparationHubError('GROQ preparation hub output is missing expectedOutcome', 502, 'INVALID_PREPARATION_HUB_SCHEMA');
  }

  return {
    name,
    priority,
    estimatedDays: normalizeEstimatedDays(track.estimatedDays),
    topics: normalizeStringArray(track.topics, 'topics'),
    practiceTasks: normalizeStringArray(track.practiceTasks, 'practiceTasks'),
    expectedOutcome
  };
};

const normalizePreparationHubData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new PreparationHubError('GROQ preparation hub output must be an object', 502, 'INVALID_PREPARATION_HUB_SCHEMA');
  }

  if (!Array.isArray(data.tracks) || data.tracks.length === 0) {
    throw new PreparationHubError('GROQ preparation hub output is missing tracks', 502, 'INVALID_PREPARATION_HUB_SCHEMA');
  }

  return {
    tracks: data.tracks.map(normalizeTrack)
  };
};

const buildPreparationHubPrompt = ({ roadmap, reports, analytics }) => `
System Role: You are a Senior Placement Mentor.

Create personalized preparation modules from the candidate's learning roadmap, interview reports, weakness analysis, focus areas, and priority topics.
CRITICAL INSTRUCTION: You MUST generate completely unique, highly specific, and varied preparation tracks. Do not use generic boilerplate. Weight the most recent interview reports heavily to ensure the prep hub strictly evolves with the candidate's newest sessions.

Current Random Seed for Variety: ${Math.random().toString(36).substring(7)}

Return ONLY valid JSON with this exact shape:
{
  "tracks": [
    {
      "name": "",
      "priority": "",
      "estimatedDays": 0,
      "topics": [],
      "practiceTasks": [],
      "expectedOutcome": ""
    }
  ]
}

Supported track names:
${SUPPORTED_TRACKS.join(', ')}

Rules:
- Use only supported track names.
- priority must be one of: High, Medium, Low.
- estimatedDays must be a positive integer.
- Prefer fewer high-signal tracks over a long generic list.
- Build tracks from repeated weaknesses, roadmap focus areas, priority topics, and recommendations.
- Include practical tasks the candidate can complete without paid services.
- Do not generate interview questions.
- Do not include markdown.

Learning Roadmap:
${JSON.stringify(roadmap)}

Analytics Summary:
${JSON.stringify(analytics)}

Recent Interview Reports:
${JSON.stringify(reports.slice(0, 5))}
`;

const textIncludesAny = (text, keywords) => keywords.some((keyword) => text.includes(keyword));

const uniqueList = (items, limit = 5) => [
  ...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))
].slice(0, limit);

const inferTrackName = (text) => {
  const normalizedText = String(text || '').toLowerCase();

  if (textIncludesAny(normalizedText, ['dsa', 'data structure', 'algorithm', 'complexity', 'dynamic programming', 'graph', 'tree'])) return 'DSA';
  if (textIncludesAny(normalizedText, ['database', 'dbms', 'mongo', 'sql', 'index', 'query', 'schema'])) return 'DBMS';
  if (textIncludesAny(normalizedText, ['operating system', 'os ', 'process', 'thread', 'memory management', 'deadlock'])) return 'Operating Systems';
  if (textIncludesAny(normalizedText, ['network', 'tcp', 'http', 'https', 'dns', 'latency'])) return 'Computer Networks';
  if (textIncludesAny(normalizedText, ['oops', 'object oriented', 'class', 'inheritance', 'polymorphism'])) return 'OOPS';
  if (textIncludesAny(normalizedText, ['system design', 'scalability', 'distributed', 'load balancer', 'cache', 'microservice'])) return 'System Design';
  if (textIncludesAny(normalizedText, ['frontend', 'react', 'ui', 'css', 'component', 'state management'])) return 'Frontend';
  if (textIncludesAny(normalizedText, ['backend', 'node', 'express', 'api', 'jwt', 'server', 'middleware'])) return 'Backend';
  if (textIncludesAny(normalizedText, ['genai', 'generative ai', 'prompt', 'rag', 'langchain', 'GROQ', 'llm'])) return 'Generative AI';
  if (textIncludesAny(normalizedText, ['communication', 'hr', 'confidence', 'behavioral', 'resume', 'storytelling'])) return 'HR Preparation';

  return 'HR Preparation';
};

const priorityFromSignals = ({ trackName, analytics, reports }) => {
  const averages = {
    DSA: analytics.averageProblemSolvingScore,
    DBMS: analytics.averageTechnicalScore,
    'Operating Systems': analytics.averageTechnicalScore,
    'Computer Networks': analytics.averageTechnicalScore,
    OOPS: analytics.averageTechnicalScore,
    'System Design': analytics.averageProjectDiscussionScore,
    Frontend: analytics.averageTechnicalScore,
    Backend: analytics.averageTechnicalScore,
    'Generative AI': analytics.averageTechnicalScore,
    'HR Preparation': analytics.averageCommunicationScore
  };

  const score = Number(averages[trackName]) || Number(analytics.averageOverallScore) || 0;
  const noHireCount = reports.filter((report) => ['No Hire', 'Borderline'].includes(report.hireRecommendation)).length;

  if (score < 60 || noHireCount >= 2) return 'High';
  if (score < 75) return 'Medium';
  return 'Low';
};

const defaultTrackDetails = {
  DSA: {
    topics: ['Arrays and hashing patterns', 'Two pointers and sliding window', 'Recursion basics', 'Time and space complexity'],
    practiceTasks: ['Solve 3 easy array problems and explain complexity aloud.', 'Review one previous coding answer and rewrite the approach step by step.'],
    expectedOutcome: 'Solve common coding prompts with clearer reasoning and complexity analysis.'
  },
  DBMS: {
    topics: ['Schema design', 'Indexes and query optimization', 'Transactions and consistency', 'MongoDB aggregation basics'],
    practiceTasks: ['Explain your project database schema with indexes.', 'Write 5 sample queries for common product workflows.'],
    expectedOutcome: 'Discuss database choices and trade-offs with practical confidence.'
  },
  'Operating Systems': {
    topics: ['Processes and threads', 'Memory management', 'Scheduling', 'Deadlocks'],
    practiceTasks: ['Prepare short explanations for process vs thread and deadlock handling.', 'Connect OS concepts to backend performance examples.'],
    expectedOutcome: 'Answer core OS questions with concise definitions and examples.'
  },
  'Computer Networks': {
    topics: ['HTTP and HTTPS', 'DNS flow', 'TCP vs UDP', 'Caching and latency'],
    practiceTasks: ['Trace what happens when a browser calls your API.', 'Explain one production network failure and mitigation.'],
    expectedOutcome: 'Explain web request flow and networking trade-offs clearly.'
  },
  OOPS: {
    topics: ['Encapsulation', 'Inheritance', 'Polymorphism', 'SOLID basics'],
    practiceTasks: ['Map OOPS principles to your project classes or modules.', 'Prepare 3 examples of abstraction from your codebase.'],
    expectedOutcome: 'Use OOPS terminology accurately during technical interviews.'
  },
  'System Design': {
    topics: ['Scalability basics', 'Caching', 'Rate limiting', 'Service boundaries'],
    practiceTasks: ['Draw a high-level architecture of your MERN platform.', 'Explain one scaling bottleneck and one fix.'],
    expectedOutcome: 'Discuss architecture decisions, constraints, and trade-offs more deeply.'
  },
  Frontend: {
    topics: ['React component design', 'State management', 'Forms and validation', 'Frontend performance'],
    practiceTasks: ['Explain one complex React component lifecycle from your app.', 'Audit one page for loading and UX improvements.'],
    expectedOutcome: 'Communicate frontend decisions with stronger implementation detail.'
  },
  Backend: {
    topics: ['Express routing', 'Authentication middleware', 'Error handling', 'API design'],
    practiceTasks: ['Explain JWT auth flow end to end.', 'Document 5 backend routes with inputs, outputs, and failure cases.'],
    expectedOutcome: 'Answer backend implementation questions with concrete API examples.'
  },
  'Generative AI': {
    topics: ['Prompt templates', 'Structured output', 'RAG basics', 'Evaluation and fallbacks'],
    practiceTasks: ['Explain how GROQ is used in the interview module.', 'Prepare one example of JSON schema validation and fallback behavior.'],
    expectedOutcome: 'Discuss GenAI features with practical architecture vocabulary.'
  },
  'HR Preparation': {
    topics: ['Resume storytelling', 'STAR answers', 'Project ownership', 'Communication clarity'],
    practiceTasks: ['Record a 2-minute project pitch and refine weak parts.', 'Prepare 5 STAR stories from project and teamwork experience.'],
    expectedOutcome: 'Present experience with stronger confidence, structure, and relevance.'
  }
};

const generateLocalPreparationHub = ({ roadmap, reports, analytics }) => {
  const sourceItems = [
    ...(roadmap.focusAreas || []),
    ...(roadmap.priorityTopics || []),
    ...(roadmap.recommendedResources || []),
    ...((analytics.topWeaknesses || []).map((item) => item.label)),
    ...((analytics.topRecommendations || []).map((item) => item.label)),
    ...reports.flatMap((report) => [
      ...(report.weaknesses || []),
      ...(report.recommendations || []),
      report.summary
    ])
  ];

  const trackNames = uniqueList(sourceItems.map(inferTrackName), 6);

  const selectedTrackNames = trackNames.length
    ? trackNames
    : ['HR Preparation', 'DSA', 'Backend', 'System Design'];

  return {
    tracks: selectedTrackNames.map((trackName) => {
      const details = defaultTrackDetails[trackName] || defaultTrackDetails['HR Preparation'];
      const matchingSignals = sourceItems.filter((item) => inferTrackName(item) === trackName);
      const customTopics = uniqueList(matchingSignals, 2);
      const priority = priorityFromSignals({ trackName, analytics, reports });

      return {
        name: trackName,
        priority,
        estimatedDays: priority === 'High' ? 5 : priority === 'Medium' ? 4 : 3,
        topics: uniqueList([...customTopics, ...details.topics], 5),
        practiceTasks: details.practiceTasks,
        expectedOutcome: details.expectedOutcome
      };
    })
  };
};

const generatePreparationHub = async ({ roadmap, reports, analytics }) => {
  if (!roadmap || !Array.isArray(roadmap.focusAreas) || roadmap.focusAreas.length === 0) {
    throw new PreparationHubError('No roadmap available', 404, 'NO_ROADMAP_AVAILABLE');
  }

  if (!Array.isArray(reports) || reports.length === 0) {
    throw new PreparationHubError('No interview reports available', 404, 'NO_REPORTS_AVAILABLE');
  }

  try {
    const responseText = await generateContent({
      prompt: buildPreparationHubPrompt({ roadmap, reports, analytics }),
      jsonMode: true
    });
    const parsedData = extractJson(responseText);
    return normalizePreparationHubData(parsedData);
  } catch (error) {
    console.warn('GROQ preparation hub generation failed. Using local preparation hub fallback. Reason:', error.message || error);
    return normalizePreparationHubData(generateLocalPreparationHub({ roadmap, reports, analytics }));
  }
};

module.exports = {
  PreparationHubError,
  generateLocalPreparationHub,
  generatePreparationHub
};
