/**
 * @file achievementController.js
 * @summary Controller that aggregates user achievements for the Achievements page.
 *          Parallel-fetches all interview sessions, generated reports, and accepted coding
 *          submissions for the logged-in user, then delegates medal/trophy calculation to
 *          the achievementService.
 *
 * @functions
 * - getInterviewAchievements: Fetches sessions, reports, and accepted submissions in parallel
 *                             via Promise.all, then calls calculateAchievements() and returns
 *                             the trophy/progress data to the frontend.
 */

const InterviewReport = require('../../models/interview/InterviewReport');
const InterviewSession = require('../../models/interview/InterviewSession');
const { calculateAchievements } = require('../../services/interview/achievementService');

const getInterviewAchievements = async (req, res) => {
  try {
    const Submission = require('../../models/submission');
    const [sessions, reports, acceptedSubmissions] = await Promise.all([
      InterviewSession.find({ userId: req.user._id })
        .sort({ createdAt: 1 })
        .select('_id interviewType templateType status createdAt endedAt')
        .lean(),
      InterviewReport.find({ userId: req.user._id })
        .sort({ createdAt: 1 })
        .select('_id sessionId overallScore hireRecommendation createdAt')
        .lean(),
      Submission.find({ userId: req.user._id, status: 'accepted' })
        .sort({ createdAt: 1 })
        .select('problemId createdAt')
        .lean()
    ]);

    const achievementData = calculateAchievements({ sessions, reports, acceptedSubmissions });

    res.status(200).json(achievementData);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch interview achievements'
    });
  }
};

module.exports = {
  getInterviewAchievements
};
