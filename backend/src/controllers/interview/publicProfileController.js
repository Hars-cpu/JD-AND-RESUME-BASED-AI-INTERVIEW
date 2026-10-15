/**
 * @file publicProfileController.js
 * @summary Controller that builds a shareable public profile page for any user by username.
 *          Derives the public-facing username from the email prefix or full name, then fetches
 *          interview stats, achievements, score trends, and coding activity for display.
 *
 * @functions
 * - normalizeUsername: Strips a string to lowercase alphanumeric + dots/dashes for safe URL comparison.
 * - publicUsernameFor: Derives the canonical public username from a user's email prefix or name.
 * - matchesUsername: Returns true if any candidate username variant matches the requested username.
 * - average: Computes the rounded mean of a numeric report field.
 * - countTopStrengths: Aggregates and ranks the most frequently occurring strengths across all reports.
 * - findPublicUser: Scans all users and returns the first whose username variants match the request.
 * - getPublicProfile: Main endpoint that resolves the username, parallel-fetches all profile data,
 *                     and returns interview stats, achievements, score history, and coding activity.
 */

const User = require('../../models/user');
const InterviewReport = require('../../models/interview/InterviewReport');
const InterviewSession = require('../../models/interview/InterviewSession');
const Submission = require('../../models/submission');
const { calculateAchievements } = require('../../services/interview/achievementService');

const normalizeUsername = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._-]/g, '');

const publicUsernameFor = (user) => (
  normalizeUsername(String(user.emailId || '').split('@')[0]) ||
  normalizeUsername(`${user.firstName || ''}-${user.lastName || ''}`) ||
  String(user._id)
);

const matchesUsername = (user, username) => {
  const candidates = [
    publicUsernameFor(user),
    normalizeUsername(user.firstName),
    normalizeUsername(`${user.firstName || ''}-${user.lastName || ''}`),
    normalizeUsername(`${user.firstName || ''}${user.lastName || ''}`)
  ];

  return candidates.includes(username);
};

const average = (items, fieldName) => {
  if (!items.length) return 0;
  const total = items.reduce((sum, item) => sum + (Number(item[fieldName]) || 0), 0);
  return Math.round(total / items.length);
};

const countTopStrengths = (reports, limit = 8) => {
  const counts = new Map();

  reports.forEach((report) => {
    (report.strengths || []).forEach((strength) => {
      const key = String(strength || '').trim();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
};

const findPublicUser = async (username) => {
  const users = await User.find({})
    .select('_id firstName lastName emailId createdAt')
    .lean();

  return users.find((user) => matchesUsername(user, username));
};

const getPublicProfile = async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);

    if (!username) {
      return res.status(400).json({
        error: 'Invalid username',
        code: 'INVALID_USERNAME'
      });
    }

    const user = await findPublicUser(username);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const [sessions, reports, userWithProblems] = await Promise.all([
      InterviewSession.find({ userId: user._id })
        .sort({ createdAt: 1 })
        .select('_id interviewType templateType status createdAt endedAt')
        .lean(),
      InterviewReport.find({ userId: user._id })
        .sort({ createdAt: 1 })
        .select('_id sessionId overallScore technicalScore communicationScore problemSolvingScore strengths hireRecommendation createdAt')
        .lean(),
      User.findById(user._id).select('problemSolved').lean()
    ]);

    const completedSessions = sessions.filter((session) => session.status === 'completed');
    const codingInterviews = completedSessions.filter((session) => (
      session.templateType === 'coding' ||
      String(session.interviewType || '').toLowerCase().includes('coding')
    )).length;
    const bestScore = reports.length
      ? Math.max(...reports.map((report) => Number(report.overallScore) || 0))
      : 0;
    const achievements = calculateAchievements({ sessions, reports }).achievements
      .filter((achievement) => achievement.unlocked)
      .map((achievement) => ({
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        unlocked: achievement.unlocked,
        unlockedAt: achievement.unlockedAt
      }));

    const recentProgress = [...reports]
      .reverse()
      .slice(0, 10)
      .reverse()
      .map((report) => ({
        reportId: report._id,
        date: report.createdAt,
        overallScore: report.overallScore || 0
      }));

    const problemsSolved = (userWithProblems?.problemSolved || []).length;
    // Acceptance rate: solved / total unique attempted (from submissions)
    const totalAttempted = await Submission.distinct('problemId', { userId: user._id }).then(ids => ids.length).catch(() => 0);
    const acceptanceRate = totalAttempted > 0 ? Math.min(100, Math.round((problemsSolved / totalAttempted) * 100)) : 0;
    const codingActivity = await Submission.find({ userId: user._id }).select('createdAt').lean().then(subs => subs.map(s => ({ date: s.createdAt, count: 1 })));

    res.status(200).json({
      username: publicUsernameFor(user),
      joinedAt: user.createdAt,
      totalInterviews: completedSessions.length,
      averageScore: average(reports, 'overallScore'),
      bestScore,
      codingInterviews,
      technicalAverage: average(reports, 'technicalScore'),
      communicationAverage: average(reports, 'communicationScore'),
      problemSolvingAverage: average(reports, 'problemSolvingScore'),
      achievements,
      recentProgress,
      topStrengths: countTopStrengths(reports),
      problemsSolved,
      acceptanceRate,
      codingActivity
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch public profile'
    });
  }
};

module.exports = {
  getPublicProfile
};
