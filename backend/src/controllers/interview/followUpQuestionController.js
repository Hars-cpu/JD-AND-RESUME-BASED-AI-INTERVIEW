/**
 * @file followUpQuestionController.js
 * @summary Controller that generates contextual follow-up questions based on the candidate's
 *          previous answer and evaluation score during a mock interview session.
 *          Reads the last interviewer question, candidate answer, and evaluation turn from the
 *          transcript and passes them to the AI follow-up service.
 *
 * @functions
 * - getAuthorizedSession: Validates the session ObjectId, fetches the document, and checks ownership.
 * - findLatestTranscriptEntry: Scans the transcript in reverse to find the last entry with a given role.
 * - getTargetQuestionCount: Returns total question targets per template type.
 * - getTranscriptCount: Counts transcript entries that match a given predicate.
 * - updateFollowUpProgress: Updates questionCount, followUpCount, and completionPercentage on the session.
 * - generateFollowUpQuestion: Validates transcript history, calls generateFollowUpQuestionForSession(),
 *                             appends the new follow-up to the transcript, and saves.
 */

const mongoose = require('mongoose');
const InterviewSession = require('../../models/interview/InterviewSession');
const {
  FollowUpQuestionError,
  generateFollowUpQuestionForSession
} = require('../../services/interview/followUpQuestionService');

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

const findLatestTranscriptEntry = (transcript = [], role) => {
  for (let index = transcript.length - 1; index >= 0; index--) {
    if (transcript[index]?.role === role) {
      return transcript[index];
    }
  }

  return null;
};

const getTargetQuestionCount = (templateType) => {
  if (templateType === 'coding') return 5;
  if (templateType === 'full-mock') return 20;
  return 10;
};

const getTranscriptCount = (transcript = [], predicate) => (
  transcript.filter(predicate).length
);

const updateFollowUpProgress = (session) => {
  const transcript = session.transcript || [];
  const questionCount = Math.max(
    Number(session.questionCount) || 0,
    getTranscriptCount(transcript, (turn) => turn.role === 'interviewer')
  );
  const followUpCount = Math.max(
    Number(session.followUpCount) || 0,
    getTranscriptCount(transcript, (turn) => turn.role === 'interviewer' && turn.questionType === 'follow-up')
  );
  const targetQuestionCount = getTargetQuestionCount(session.templateType);

  session.questionCount = questionCount;
  session.followUpCount = followUpCount;
  session.completionPercentage = targetQuestionCount > 0
    ? Math.min(100, Math.round((questionCount / targetQuestionCount) * 100))
    : 0;
};

const generateFollowUpQuestion = async (req, res) => {
  try {
    const { session, error } = await getAuthorizedSession(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json(error.body);
    }

    const previousQuestion = findLatestTranscriptEntry(session.transcript, 'interviewer');
    const candidateAnswer = findLatestTranscriptEntry(session.transcript, 'candidate');
    const evaluation = findLatestTranscriptEntry(session.transcript, 'evaluation');

    if (!previousQuestion) {
      return res.status(400).json({
        error: 'Missing question history',
        code: 'MISSING_QUESTION_HISTORY'
      });
    }

    if (!candidateAnswer) {
      return res.status(400).json({
        error: 'Missing answer history',
        code: 'MISSING_ANSWER_HISTORY'
      });
    }

    if (!evaluation) {
      return res.status(400).json({
        error: 'Missing evaluation',
        code: 'MISSING_EVALUATION'
      });
    }

    const followUpData = await generateFollowUpQuestionForSession({
      session,
      previousQuestion,
      candidateAnswer,
      evaluation
    });

    session.transcript.push({
      role: 'interviewer',
      message: followUpData.question,
      category: followUpData.category,
      questionType: 'follow-up',
      timestamp: new Date()
    });
    updateFollowUpProgress(session);

    await session.save();

    res.status(200).json({
      ...followUpData,
      questionCount: session.questionCount,
      followUpCount: session.followUpCount,
      completionPercentage: session.completionPercentage
    });
  } catch (error) {
    if (error instanceof FollowUpQuestionError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Failed to generate follow-up question'
    });
  }
};

module.exports = {
  generateFollowUpQuestion
};
