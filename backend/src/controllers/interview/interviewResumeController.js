/**
 * @file interviewResumeController.js
 * @summary Controller for handling interrupted mock interview sessions.
 *          Detects any 'in-progress' session for the current user, returns a session summary
 *          with question/answer counts and elapsed time, and allows the user to choose to
 *          resume (restore full transcript) or discard (soft-delete) the session.
 *
 * @functions
 * - getLatestByRole: Scans the transcript in reverse to find the last entry with a specific role.
 * - getLastActivity: Returns the timestamp of the most recent transcript turn or session start time.
 * - getSessionDuration: Computes elapsed session time in seconds from start to current/end time.
 * - getSessionStats: Counts interviewer, candidate, follow-up, and evaluation turns in a transcript.
 * - summarizeActiveSession: Assembles a compact summary object from session metadata and stats.
 * - getAuthorizedSession: Validates the session ObjectId, fetches the document, and checks ownership.
 * - getActiveInterviewSession: Finds the latest 'in-progress' session for the user and returns its summary.
 * - resumeInterviewSession: Returns the full session document, transcript, and current question for continuation.
 * - discardInterviewSession: Marks the session as 'discarded' with a final duration and saves.
 */

const mongoose = require('mongoose');
const InterviewSession = require('../../models/interview/InterviewSession');

const getLatestByRole = (transcript = [], role) => {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    if (transcript[index]?.role === role) return transcript[index];
  }

  return null;
};

const getLastActivity = (session) => {
  const transcript = session.transcript || [];
  const latestTurn = transcript[transcript.length - 1];
  return latestTurn?.timestamp || session.startedAt || session.createdAt;
};

const getSessionDuration = (session) => {
  if (session.duration) return session.duration;

  const startedAt = session.startedAt || session.createdAt;
  if (!startedAt) return 0;

  const endTime = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const startTime = new Date(startedAt).getTime();
  return Math.max(0, Math.round((endTime - startTime) / 1000));
};

const getSessionStats = (session) => {
  const transcript = session.transcript || [];
  const interviewerTurns = transcript.filter((turn) => turn.role === 'interviewer');
  const candidateTurns = transcript.filter((turn) => turn.role === 'candidate');
  const followUpTurns = interviewerTurns.filter((turn) => turn.questionType === 'follow-up');
  const evaluationTurns = transcript.filter((turn) => turn.role === 'evaluation');

  return {
    questionCount: interviewerTurns.length,
    answerCount: candidateTurns.length,
    followUpCount: followUpTurns.length,
    evaluationCount: evaluationTurns.length,
    lastActivity: getLastActivity(session)
  };
};

const summarizeActiveSession = (session) => {
  const stats = getSessionStats(session);

  return {
    sessionId: session._id,
    templateType: session.templateType || 'technical',
    interviewType: session.interviewType,
    startedAt: session.startedAt,
    duration: getSessionDuration(session),
    questionCount: stats.questionCount,
    answerCount: stats.answerCount,
    followUpCount: stats.followUpCount,
    lastActivity: stats.lastActivity
  };
};

const getAuthorizedSession = async (sessionId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return {
      error: {
        status: 400,
        body: {
          error: 'Invalid session id',
          code: 'INVALID_SESSION_ID'
        }
      }
    };
  }

  const session = await InterviewSession.findById(sessionId);

  if (!session) {
    return {
      error: {
        status: 404,
        body: {
          error: 'Interview session not found',
          code: 'SESSION_NOT_FOUND'
        }
      }
    };
  }

  if (session.userId.toString() !== userId.toString()) {
    return {
      error: {
        status: 403,
        body: {
          error: 'Unauthorized access to interview session',
          code: 'UNAUTHORIZED_SESSION_ACCESS'
        }
      }
    };
  }

  return { session };
};

const getActiveInterviewSession = async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      userId: req.user._id,
      status: 'in-progress'
    }).sort({ createdAt: -1 });

    if (!session) {
      return res.status(404).json({
        error: 'No active interview session found',
        code: 'NO_ACTIVE_SESSION'
      });
    }

    res.status(200).json(summarizeActiveSession(session));
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch active interview session'
    });
  }
};

const resumeInterviewSession = async (req, res) => {
  try {
    const { session, error } = await getAuthorizedSession(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json(error.body);
    }

    if (session.status !== 'in-progress') {
      return res.status(400).json({
        error: 'Only in-progress interviews can be resumed',
        code: 'SESSION_NOT_IN_PROGRESS'
      });
    }

    const stats = getSessionStats(session);

    res.status(200).json({
      session,
      transcript: session.transcript || [],
      currentQuestion: getLatestByRole(session.transcript, 'interviewer'),
      latestEvaluation: getLatestByRole(session.transcript, 'evaluation'),
      statistics: {
        ...stats,
        duration: getSessionDuration(session)
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to resume interview session'
    });
  }
};

const discardInterviewSession = async (req, res) => {
  try {
    const { session, error } = await getAuthorizedSession(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json(error.body);
    }

    if (session.status === 'completed') {
      return res.status(400).json({
        error: 'Completed interviews cannot be discarded',
        code: 'SESSION_ALREADY_COMPLETED'
      });
    }

    if (session.status === 'discarded') {
      return res.status(200).json({
        sessionId: session._id,
        status: session.status,
        endedAt: session.endedAt,
        duration: session.duration
      });
    }

    const endedAt = new Date();
    session.status = 'discarded';
    session.endedAt = endedAt;
    session.duration = getSessionDuration({
      ...session.toObject(),
      endedAt
    });
    await session.save();

    res.status(200).json({
      sessionId: session._id,
      status: session.status,
      endedAt: session.endedAt,
      duration: session.duration
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to discard interview session'
    });
  }
};

module.exports = {
  getActiveInterviewSession,
  resumeInterviewSession,
  discardInterviewSession
};
