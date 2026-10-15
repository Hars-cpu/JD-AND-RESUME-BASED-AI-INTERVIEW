/**
 * @file preparationHubController.js
 * @summary Controller that generates a personalized study preparation plan by combining
 *          the AI learning roadmap with past interview report data. Uses a two-layer Redis cache:
 *          one for the roadmap (7-day TTL) and one for the prep hub plan (7-day TTL).
 *
 * @functions
 * - roundAverage: Computes the rounded mean of a numeric field across report documents.
 * - countTopItems: Ranks string array values by frequency and returns the top N items.
 * - countTemplates: Counts sessions per template type.
 * - buildAnalyticsSummary: Assembles a compact analytics summary object.
 * - mapReportsForPrompt: Strips reports to the fields needed by the AI prompt.
 * - mapSessionsForPrompt: Strips sessions to the fields needed by the AI prompt.
 * - getPreparationHub: Checks Redis for cached hub plan; if not found, generates the roadmap,
 *                      calls generatePreparationHub(), caches both, and returns the plan.
 */

const InterviewReport = require('../../models/interview/InterviewReport');
const InterviewSession = require('../../models/interview/InterviewSession');
const {
  LearningRoadmapError,
  generateLearningRoadmap
} = require('../../services/interview/learningRoadmapService');
const {
  PreparationHubError,
  generatePreparationHub
} = require('../../services/interview/preparationHubService');
const redisClient = require('../../config/redis');

const roundAverage = (items, fieldName) => {
  if (!items.length) return 0;

  const total = items.reduce((sum, item) => sum + (Number(item[fieldName]) || 0), 0);
  return Math.round(total / items.length);
};

const countTopItems = (items, fieldName, limit = 8) => {
  const counts = new Map();

  items.forEach((item) => {
    (item[fieldName] || []).forEach((value) => {
      const key = String(value || '').trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
};

const countTemplates = (sessions) => {
  const counts = {};

  sessions.forEach((session) => {
    const templateType = session.templateType || 'technical';
    counts[templateType] = (counts[templateType] || 0) + 1;
  });

  return counts;
};

const buildAnalyticsSummary = (reports, sessions) => ({
  totalInterviews: sessions.length,
  totalReports: reports.length,
  averageOverallScore: roundAverage(reports, 'overallScore'),
  averageTechnicalScore: roundAverage(reports, 'technicalScore'),
  averageCommunicationScore: roundAverage(reports, 'communicationScore'),
  averageProblemSolvingScore: roundAverage(reports, 'problemSolvingScore'),
  averageProjectDiscussionScore: roundAverage(reports, 'projectDiscussionScore'),
  averageCodingScore: roundAverage(reports, 'codingScore'),
  topWeaknesses: countTopItems(reports, 'weaknesses'),
  topRecommendations: countTopItems(reports, 'recommendations'),
  selectedTemplates: countTemplates(sessions)
});

const mapReportsForPrompt = (reports) => reports.map((report) => ({
  reportId: report._id,
  sessionId: report.sessionId,
  overallScore: report.overallScore || 0,
  technicalScore: report.technicalScore || 0,
  communicationScore: report.communicationScore || 0,
  problemSolvingScore: report.problemSolvingScore || 0,
  projectDiscussionScore: report.projectDiscussionScore || 0,
  codingScore: report.codingScore || 0,
  strengths: report.strengths || [],
  weaknesses: report.weaknesses || [],
  recommendations: report.recommendations || [],
  summary: report.summary || '',
  hireRecommendation: report.hireRecommendation,
  createdAt: report.createdAt
}));

const mapSessionsForPrompt = (sessions) => sessions.map((session) => ({
  sessionId: session._id,
  interviewType: session.interviewType,
  templateType: session.templateType || 'technical',
  status: session.status,
  analysisData: session.analysisData,
  createdAt: session.createdAt
}));

const getPreparationHub = async (req, res) => {
  try {
    const [reports, sessions] = await Promise.all([
      InterviewReport.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean(),
      InterviewSession.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean()
    ]);

    if (!sessions.length) {
      return res.status(404).json({
        error: 'No interview history available',
        code: 'NO_INTERVIEW_HISTORY'
      });
    }

    if (!reports.length) {
      return res.status(404).json({
        error: 'No interview reports available',
        code: 'NO_REPORTS_AVAILABLE'
      });
    }

    const latestReportId = reports[0]._id.toString();
    const cacheKey = `prephub:${req.user._id}:${latestReportId}`;
    const roadmapCacheKey = `roadmap:${req.user._id}:${latestReportId}`;

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    const analytics = buildAnalyticsSummary(reports, sessions);
    const mappedReports = mapReportsForPrompt(reports);
    const mappedSessions = mapSessionsForPrompt(sessions);

    let roadmap;
    const cachedRoadmap = await redisClient.get(roadmapCacheKey);
    if (cachedRoadmap) {
      roadmap = JSON.parse(cachedRoadmap);
    } else {
      roadmap = await generateLearningRoadmap({
        reports: mappedReports,
        sessions: mappedSessions,
        analytics
      });
      await redisClient.setEx(roadmapCacheKey, 86400 * 7, JSON.stringify(roadmap));
    }

    const preparationHub = await generatePreparationHub({
      roadmap,
      reports: mappedReports,
      analytics
    });

    await redisClient.setEx(cacheKey, 86400 * 7, JSON.stringify(preparationHub));

    res.status(200).json(preparationHub);
  } catch (error) {
    if (error instanceof LearningRoadmapError || error instanceof PreparationHubError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Failed to generate preparation hub'
    });
  }
};

module.exports = {
  getPreparationHub
};
