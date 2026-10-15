/**
 * @file pdfExportController.js
 * @summary Controller that generates downloadable PDF documents for interview reports,
 *          learning roadmaps, and preparation plans. Fetches data from MongoDB, uses Redis
 *          cache to avoid re-calling the LLM for roadmap/prep hub data, then pipes the PDFKit
 *          document stream directly to the HTTP response.
 *
 * @functions
 * - roundAverage: Computes the rounded mean of a numeric field across report documents.
 * - countTopItems: Ranks string array values by frequency and returns the top N items.
 * - countTemplates: Counts sessions per template type.
 * - buildAnalyticsSummary: Assembles a compact analytics summary for AI prompts and PDF content.
 * - mapReportsForPrompt: Strips reports to the subset of fields needed by the LLM.
 * - mapSessionsForPrompt: Strips sessions to the subset of fields needed by the LLM.
 * - loadRoadmapInputs: Parallel-fetches reports and sessions, validates availability, and returns mapped inputs.
 * - handleExportError: Centralized error handler that normalizes service-specific errors to JSON.
 * - exportInterviewReportPdf: Fetches the session and report, builds and streams the report PDF.
 * - exportLearningRoadmapPdf: Fetches/generates the learning roadmap and streams the roadmap PDF.
 * - exportPreparationHubPdf: Fetches/generates both the roadmap and preparation hub and streams the plan PDF.
 */

const mongoose = require('mongoose');
const InterviewReport = require('../../models/interview/InterviewReport');
const InterviewSession = require('../../models/interview/InterviewSession');
const {
  LearningRoadmapError,
  generateLearningRoadmap
} = require('../../services/interview/learningRoadmapService');
const redisClient = require('../../config/redis');
const {
  PreparationHubError,
  generatePreparationHub
} = require('../../services/interview/preparationHubService');
const {
  PdfExportError,
  formatDateForName,
  buildInterviewReportPdf,
  buildLearningRoadmapPdf,
  buildPreparationHubPdf,
  streamPdf
} = require('../../services/interview/pdfExportService');

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

const loadRoadmapInputs = async (userId) => {
  const [reports, sessions] = await Promise.all([
    InterviewReport.find({ userId }).sort({ createdAt: -1 }).lean(),
    InterviewSession.find({ userId }).sort({ createdAt: -1 }).lean()
  ]);

  if (!sessions.length) {
    throw new PdfExportError('No interview history available', 404, 'NO_INTERVIEW_HISTORY');
  }

  if (!reports.length) {
    throw new PdfExportError('No interview reports available', 404, 'NO_REPORTS_AVAILABLE');
  }

  const analytics = buildAnalyticsSummary(reports, sessions);
  const mappedReports = mapReportsForPrompt(reports);
  const mappedSessions = mapSessionsForPrompt(sessions);

  return {
    analytics,
    reports: mappedReports,
    sessions: mappedSessions
  };
};

const handleExportError = (res, error) => {
  if (error instanceof PdfExportError || error instanceof LearningRoadmapError || error instanceof PreparationHubError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code
    });
  }

  return res.status(500).json({
    error: 'PDF generation failed'
  });
};

const exportInterviewReportPdf = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        error: 'Invalid session id',
        code: 'INVALID_SESSION_ID'
      });
    }

    const session = await InterviewSession.findOne({
      _id: sessionId,
      userId: req.user._id
    }).lean();

    if (!session) {
      return res.status(404).json({
        error: 'Interview session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    const report = await InterviewReport.findOne({
      sessionId,
      userId: req.user._id
    }).lean();

    if (!report) {
      return res.status(404).json({
        error: 'Interview report not found',
        code: 'REPORT_NOT_FOUND'
      });
    }

    const doc = buildInterviewReportPdf({
      user: req.user,
      report,
      session
    });

    streamPdf({
      res,
      doc,
      filename: `Interview_Report_${formatDateForName(report.createdAt)}.pdf`
    });
  } catch (error) {
    handleExportError(res, error);
  }
};

const exportLearningRoadmapPdf = async (req, res) => {
  try {
    const inputs = await loadRoadmapInputs(req.user._id);

    const latestReportId = inputs.reports.length > 0 ? inputs.reports[0].reportId.toString() : 'noreport';
    const roadmapCacheKey = `roadmap:${req.user._id}:${latestReportId}`;

    let roadmap;
    const cachedRoadmap = await redisClient.get(roadmapCacheKey);
    if (cachedRoadmap) {
      roadmap = JSON.parse(cachedRoadmap);
    } else {
      roadmap = await generateLearningRoadmap(inputs);
      await redisClient.setEx(roadmapCacheKey, 86400 * 7, JSON.stringify(roadmap));
    }

    if (!roadmap || !Array.isArray(roadmap.focusAreas) || roadmap.focusAreas.length === 0) {
      return res.status(404).json({
        error: 'No roadmap available',
        code: 'NO_ROADMAP_AVAILABLE'
      });
    }

    const doc = buildLearningRoadmapPdf({
      user: req.user,
      roadmap
    });

    streamPdf({
      res,
      doc,
      filename: `Learning_Roadmap_${formatDateForName()}.pdf`
    });
  } catch (error) {
    handleExportError(res, error);
  }
};

const exportPreparationHubPdf = async (req, res) => {
  try {
    const inputs = await loadRoadmapInputs(req.user._id);

    const latestReportId = inputs.reports.length > 0 ? inputs.reports[0].reportId.toString() : 'noreport';
    const roadmapCacheKey = `roadmap:${req.user._id}:${latestReportId}`;

    let roadmap;
    const cachedRoadmap = await redisClient.get(roadmapCacheKey);
    if (cachedRoadmap) {
      roadmap = JSON.parse(cachedRoadmap);
    } else {
      roadmap = await generateLearningRoadmap(inputs);
      await redisClient.setEx(roadmapCacheKey, 86400 * 7, JSON.stringify(roadmap));
    }

    if (!roadmap || !Array.isArray(roadmap.focusAreas) || roadmap.focusAreas.length === 0) {
      return res.status(404).json({
        error: 'No roadmap available',
        code: 'NO_ROADMAP_AVAILABLE'
      });
    }

    const preparationHub = await generatePreparationHub({
      roadmap,
      reports: inputs.reports,
      analytics: inputs.analytics
    });

    const doc = buildPreparationHubPdf({
      user: req.user,
      preparationHub
    });

    streamPdf({
      res,
      doc,
      filename: `Preparation_Plan_${formatDateForName()}.pdf`
    });
  } catch (error) {
    handleExportError(res, error);
  }
};

module.exports = {
  exportInterviewReportPdf,
  exportLearningRoadmapPdf,
  exportPreparationHubPdf
};
