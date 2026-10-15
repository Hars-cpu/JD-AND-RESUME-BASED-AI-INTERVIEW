/**
 * @file scorecardGenerationController.js
 * @summary Controller that generates the final AI scorecard for a completed mock interview session.
 *          Calls generateScorecardForSession() which analyses the entire transcript and returns
 *          dimension scores; then upserts an InterviewReport document and marks the session as completed.
 *
 * @functions
 * - getAuthorizedSession: Validates the session ObjectId, fetches the document, and checks ownership.
 * - generateInterviewScorecard: Authorized session, calls the scorecard service, upserts the InterviewReport,
 *                               marks session status as 'completed', and returns the full scorecard JSON.
 */

const mongoose = require('mongoose');
const InterviewSession = require('../../models/interview/InterviewSession');
const InterviewReport = require('../../models/interview/InterviewReport');
const redis = require('../../config/redis');
const {
  ScorecardGenerationError,
  generateScorecardForSession
} = require('../../services/interview/scorecardGenerationService');

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

const generateInterviewScorecard = async (req, res) => {
  try {
    const { session, error } = await getAuthorizedSession(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json(error.body);
    }

    const scorecard = await generateScorecardForSession(session);

    await InterviewReport.findOneAndUpdate(
      {
        userId: req.user._id,
        sessionId: session._id
      },
      {
        userId: req.user._id,
        sessionId: session._id,
        overallScore: scorecard.overallScore,
        technicalScore: scorecard.technicalScore,
        communicationScore: scorecard.communicationScore,
        problemSolvingScore: scorecard.problemSolvingScore,
        projectDiscussionScore: scorecard.projectDiscussionScore,
        strengths: scorecard.strengths,
        weaknesses: scorecard.weaknesses,
        recommendations: scorecard.recommendations,
        summary: scorecard.interviewSummary,
        hireRecommendation: scorecard.hireRecommendation
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    const endedAt = new Date();
    const startedAt = session.startedAt || session.createdAt || endedAt;
    session.status = 'completed';
    session.endedAt = session.endedAt || endedAt;
    session.duration = session.duration || Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
    await session.save();

    // Invalidate the analytics cache since a new report was added
    const cacheKey = `analytics:${req.user._id}`;
    await redis.del(cacheKey);

    res.status(200).json(scorecard);
  } catch (error) {
    if (error instanceof ScorecardGenerationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Failed to generate interview scorecard'
    });
  }
};

module.exports = {
  generateInterviewScorecard
};
