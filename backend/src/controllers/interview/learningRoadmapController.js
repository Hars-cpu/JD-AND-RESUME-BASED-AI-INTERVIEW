/**
 * @file learningRoadmapController.js
 * @summary Controller that generates a personalized AI learning roadmap based on all of a user's
 *          interview reports and session history. Results are cached in Redis for 7 days
 *          to avoid redundant LLM calls on repeat visits.
 *
 * @functions
 * - roundAverage: Computes the rounded mean of a numeric field across report documents.
 * - countTopItems: Ranks string array values by frequency and returns the top N items.
 * - countTemplates: Counts how many sessions used each template type (technical, hr, coding, etc.).
 * - buildAnalyticsSummary: Assembles a compact analytics object from reports and sessions for the AI prompt.
 * - mapReportsForPrompt: Strips reports down to the fields needed by the LLM prompt.
 * - mapSessionsForPrompt: Strips sessions down to the fields needed by the LLM prompt.
 * - getLearningRoadmap: Checks Redis cache first; if miss, calls generateLearningRoadmap() and caches result.
 */

const InterviewReport = require('../../models/interview/InterviewReport');
const InterviewSession = require('../../models/interview/InterviewSession');
const {
  LearningRoadmapError,
  generateLearningRoadmap
} = require('../../services/interview/learningRoadmapService');
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

const getLearningRoadmap = async (req, res) => {
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
    const cacheKey = `roadmap:${req.user._id}:${latestReportId}`;

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    const analytics = buildAnalyticsSummary(reports, sessions);
    const roadmap = await generateLearningRoadmap({
      reports: mapReportsForPrompt(reports),
      sessions: mapSessionsForPrompt(sessions),
      analytics
    });

    await redisClient.setEx(cacheKey, 86400 * 7, JSON.stringify(roadmap));

    res.status(200).json(roadmap);
  } catch (error) {
    if (error instanceof LearningRoadmapError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Failed to generate learning roadmap'
    });
  }
};

module.exports = {
  getLearningRoadmap
};
