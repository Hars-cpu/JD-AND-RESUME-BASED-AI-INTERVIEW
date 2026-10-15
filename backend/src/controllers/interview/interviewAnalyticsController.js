/**
 * @file interviewAnalyticsController.js
 * @summary Controller that computes aggregated analytics across all of a user's interview reports.
 *          Calculates score averages, hire recommendation breakdowns, score trend timelines,
 *          top recurring strengths/weaknesses, and coding submission activity data
 *          for display on the InterviewAnalyticsDashboard page.
 *
 * @functions
 * - roundAverage: Calculates the rounded arithmetic mean of a numeric field across an array of reports.
 * - countTopItems: Counts occurrences of string array items across all reports and returns the top N.
 * - getInterviewAnalytics: Aggregates all InterviewReport documents for the user and returns
 *                          score trends, averages, breakdowns, strengths, weaknesses, and coding activity.
 */

const InterviewReport = require('../../models/interview/InterviewReport');
const redis = require('../../config/redis');

const HIRE_RECOMMENDATIONS = ['Strong Hire', 'Hire', 'Borderline', 'No Hire'];

const roundAverage = (items, fieldName) => {
  if (!items.length) return 0;

  const total = items.reduce((sum, item) => sum + (Number(item[fieldName]) || 0), 0);
  return Math.round(total / items.length);
};

const countTopItems = (reports, fieldName, limit = 5) => {
  const counts = new Map();

  reports.forEach((report) => {
    (report[fieldName] || []).forEach((item) => {
      const key = String(item || '').trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
};

const getInterviewAnalytics = async (req, res) => {
  try {
    const cacheKey = `analytics:${req.user._id}`;
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    const reports = await InterviewReport.find({ userId: req.user._id })
      .sort({ createdAt: 1 })
      .lean();

    const totalInterviews = reports.length;

    const hireRecommendationBreakdown = HIRE_RECOMMENDATIONS.reduce((acc, recommendation) => {
      acc[recommendation] = 0;
      return acc;
    }, {});

    reports.forEach((report) => {
      if (hireRecommendationBreakdown[report.hireRecommendation] !== undefined) {
        hireRecommendationBreakdown[report.hireRecommendation] += 1;
      }
    });

    const scoreTrend = reports.map((report) => ({
      reportId: report._id,
      sessionId: report.sessionId,
      date: report.createdAt,
      overallScore: report.overallScore || 0,
      technicalScore: report.technicalScore || 0,
      communicationScore: report.communicationScore || 0,
      problemSolvingScore: report.problemSolvingScore || 0,
      projectDiscussionScore: report.projectDiscussionScore || 0,
      hireRecommendation: report.hireRecommendation
    }));

    const reportHistory = [...reports].reverse().map((report) => ({
      reportId: report._id,
      sessionId: report.sessionId,
      createdAt: report.createdAt,
      overallScore: report.overallScore || 0,
      technicalScore: report.technicalScore || 0,
      communicationScore: report.communicationScore || 0,
      problemSolvingScore: report.problemSolvingScore || 0,
      projectDiscussionScore: report.projectDiscussionScore || 0,
      strengths: report.strengths || [],
      weaknesses: report.weaknesses || [],
      recommendations: report.recommendations || [],
      summary: report.summary || '',
      hireRecommendation: report.hireRecommendation
    }));

    const Submission = require('../../models/submission');
    const codingActivity = await Submission.find({ userId: req.user._id }).select('createdAt').lean().then(subs => subs.map(s => ({ date: s.createdAt, count: 1 })));

    const result = {
      totalInterviews,
      averageOverallScore: roundAverage(reports, 'overallScore'),
      averageTechnicalScore: roundAverage(reports, 'technicalScore'),
      averageCommunicationScore: roundAverage(reports, 'communicationScore'),
      averageProblemSolvingScore: roundAverage(reports, 'problemSolvingScore'),
      averageProjectDiscussionScore: roundAverage(reports, 'projectDiscussionScore'),
      hireRecommendationBreakdown,
      scoreTrend,
      topStrengths: countTopItems(reports, 'strengths'),
      topWeaknesses: countTopItems(reports, 'weaknesses'),
      recommendedFocusAreas: countTopItems(reports, 'recommendations'),
      reportHistory,
      codingActivity
    };

    // Cache the result for 24 hours (86400 seconds)
    await redis.setEx(cacheKey, 86400, JSON.stringify(result));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch interview analytics'
    });
  }
};

module.exports = {
  getInterviewAnalytics
};
