/**
 * @file achievementService.js
 * @summary Service that calculates gamified achievement badges and daily streaks for a user.
 *          Evaluates completed interview sessions, generated reports, and accepted coding submissions
 *          against a set of milestone thresholds (e.g., First Blood, Interview Master, 7 Day Streak).
 *
 * @functions
 * - startOfUtcDay: Normalizes a date to midnight UTC for consistent day-level comparisons.
 * - toDayKey: Returns the ISO YYYY-MM-DD string for a date, used as a map key for streak tracking.
 * - addDays: Adds a number of days to a UTC date.
 * - calculateStreaks: Builds a set of unique completion days and computes the current and longest
 *                     consecutive-day streaks from completed session timestamps.
 * - firstDate: Finds the first item matching a predicate and returns a date extracted via a getter.
 * - achievement: Factory that creates a normalized achievement object with unlocked status and progress.
 * - buildAchievements: Evaluates all milestone conditions and returns the full list of achievement objects.
 * - calculateAchievements: Main exported function — validates inputs, computes streaks, and returns the
 *                          currentStreak, longestStreak, and full achievements array.
 */

const startOfUtcDay = (date) => {
  const value = new Date(date);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

const toDayKey = (date) => startOfUtcDay(date).toISOString().slice(0, 10);

const addDays = (date, days) => {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
};

const calculateStreaks = (sessions = []) => {
  const completedDayKeys = new Set(
    sessions
      .filter((session) => session.status === 'completed')
      .map((session) => session.endedAt || session.createdAt)
      .filter(Boolean)
      .map(toDayKey)
  );

  const sortedDays = Array.from(completedDayKeys)
    .sort()
    .map((dayKey) => startOfUtcDay(dayKey));

  let longestStreak = 0;
  let runningStreak = 0;
  let previousDay = null;

  sortedDays.forEach((day) => {
    if (!previousDay) {
      runningStreak = 1;
    } else {
      const expectedNextDay = addDays(previousDay, 1).getTime();
      runningStreak = day.getTime() === expectedNextDay ? runningStreak + 1 : 1;
    }

    longestStreak = Math.max(longestStreak, runningStreak);
    previousDay = day;
  });

  let currentStreak = 0;
  const today = startOfUtcDay(new Date());
  const yesterday = addDays(today, -1);
  let cursor = completedDayKeys.has(toDayKey(today)) ? today : yesterday;

  while (completedDayKeys.has(toDayKey(cursor))) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    currentStreak,
    longestStreak
  };
};

const firstDate = (items, predicate, getDate) => {
  const item = items.find(predicate);
  return item ? getDate(item) : '';
};

const achievement = ({
  id,
  name,
  description,
  unlocked,
  unlockedAt,
  progress,
  target
}) => ({
  id,
  name,
  description,
  unlocked,
  unlockedAt: unlocked ? unlockedAt || '' : '',
  progress,
  target
});

const buildAchievements = ({ sessions = [], reports = [], streaks, acceptedSubmissions = [] }) => {
  const completedSessions = sessions.filter((session) => session.status === 'completed');
  const completedCount = completedSessions.length;
  const codingSessions = completedSessions.filter((session) => (
    session.templateType === 'coding' ||
    String(session.interviewType || '').toLowerCase().includes('coding')
  ));
  const codingCount = codingSessions.length;
  const strongHireReport = reports.find((report) => report.hireRecommendation === 'Strong Hire');
  const perfectScoreReport = reports.find((report) => Number(report.overallScore) >= 95);
  
  // Unique problems solved
  const solvedProblemIds = new Set(acceptedSubmissions.map(s => s.problemId?.toString() || s.problemId));
  const problemsSolvedCount = solvedProblemIds.size;

  return [
    achievement({
      id: 'first-blood',
      name: 'First Blood',
      description: 'Solve your first problem.',
      unlocked: problemsSolvedCount >= 1,
      unlockedAt: firstDate(acceptedSubmissions, () => true, (sub) => sub.createdAt),
      progress: Math.min(problemsSolvedCount, 1),
      target: 1
    }),
    achievement({
      id: 'problem-solver',
      name: 'Problem Solver',
      description: 'Solve 10 problems.',
      unlocked: problemsSolvedCount >= 10,
      unlockedAt: firstDate(acceptedSubmissions, (_sub, index) => index === 9, (sub) => sub.createdAt),
      progress: Math.min(problemsSolvedCount, 10),
      target: 10
    }),
    achievement({
      id: 'algorithm-master',
      name: 'Algorithm Master',
      description: 'Solve 50 problems.',
      unlocked: problemsSolvedCount >= 50,
      unlockedAt: firstDate(acceptedSubmissions, (_sub, index) => index === 49, (sub) => sub.createdAt),
      progress: Math.min(problemsSolvedCount, 50),
      target: 50
    }),
    achievement({
      id: 'first-interview',
      name: 'First Interview',
      description: 'Complete 1 interview.',
      unlocked: completedCount >= 1,
      unlockedAt: firstDate(completedSessions, () => true, (session) => session.endedAt || session.createdAt),
      progress: Math.min(completedCount, 1),
      target: 1
    }),
    achievement({
      id: 'interview-explorer',
      name: 'Interview Explorer',
      description: 'Complete 5 interviews.',
      unlocked: completedCount >= 5,
      unlockedAt: firstDate(completedSessions, (_session, index) => index === 4, (session) => session.endedAt || session.createdAt),
      progress: Math.min(completedCount, 5),
      target: 5
    }),
    achievement({
      id: 'interview-master',
      name: 'Interview Master',
      description: 'Complete 10 interviews.',
      unlocked: completedCount >= 10,
      unlockedAt: firstDate(completedSessions, (_session, index) => index === 9, (session) => session.endedAt || session.createdAt),
      progress: Math.min(completedCount, 10),
      target: 10
    }),
    achievement({
      id: 'strong-hire',
      name: 'Strong Hire',
      description: 'Receive a Strong Hire recommendation.',
      unlocked: Boolean(strongHireReport),
      unlockedAt: strongHireReport?.createdAt || '',
      progress: strongHireReport ? 1 : 0,
      target: 1
    }),
    achievement({
      id: 'coding-enthusiast',
      name: 'Coding Enthusiast',
      description: 'Complete 5 coding interviews.',
      unlocked: codingCount >= 5,
      unlockedAt: firstDate(codingSessions, (_session, index) => index === 4, (session) => session.endedAt || session.createdAt),
      progress: Math.min(codingCount, 5),
      target: 5
    }),
    achievement({
      id: 'interview-marathon',
      name: 'Interview Marathon',
      description: 'Complete 25 interviews.',
      unlocked: completedCount >= 25,
      unlockedAt: firstDate(completedSessions, (_session, index) => index === 24, (session) => session.endedAt || session.createdAt),
      progress: Math.min(completedCount, 25),
      target: 25
    }),
    achievement({
      id: 'perfect-score',
      name: 'Perfect Score',
      description: 'Earn an overall score of 95 or higher.',
      unlocked: Boolean(perfectScoreReport),
      unlockedAt: perfectScoreReport?.createdAt || '',
      progress: perfectScoreReport ? 1 : 0,
      target: 1
    }),
    achievement({
      id: 'seven-day-streak',
      name: '7 Day Streak',
      description: 'Practice 7 consecutive days.',
      unlocked: streaks.longestStreak >= 7,
      unlockedAt: '',
      progress: Math.min(streaks.currentStreak, 7),
      target: 7
    }),
    achievement({
      id: 'thirty-day-streak',
      name: '30 Day Streak',
      description: 'Practice 30 consecutive days.',
      unlocked: streaks.longestStreak >= 30,
      unlockedAt: '',
      progress: Math.min(streaks.currentStreak, 30),
      target: 30
    })
  ];
};

const calculateAchievements = ({ sessions = [], reports = [], acceptedSubmissions = [] }) => {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const safeReports = Array.isArray(reports) ? reports : [];
  const safeSubmissions = Array.isArray(acceptedSubmissions) ? acceptedSubmissions : [];
  const streaks = calculateStreaks(safeSessions);

  return {
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
    achievements: buildAchievements({
      sessions: safeSessions,
      reports: safeReports,
      streaks,
      acceptedSubmissions: safeSubmissions
    })
  };
};

module.exports = {
  calculateAchievements
};
