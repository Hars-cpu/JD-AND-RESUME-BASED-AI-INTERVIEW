/**
 * @file answerEvaluationController.js
 * @summary Controller that handles candidate answer submission and AI-based evaluation during a mock interview.
 *          Finds the most recent interviewer question in the transcript, sends the candidate's answer
 *          to the evaluation service (which calls the AI API), then appends both the candidate turn
 *          and a detailed evaluation turn to the session transcript.
 *
 * @functions
 * - getAuthorizedSession: Validates the session ObjectId, fetches the document, and checks ownership.
 * - findLatestInterviewerQuestion: Scans the transcript array in reverse to find the last 'interviewer' turn.
 * - getTargetQuestionCount: Returns question target counts per template type (coding:5, full-mock:20, default:10).
 * - getTranscriptCount: Counts transcript turns matching a given predicate filter.
 * - updateAnswerProgress: Recomputes answerCount, questionCount, followUpCount, and completionPercentage.
 * - submitInterviewAnswer: Main endpoint that validates the session, locates the active question,
 *                          calls evaluateAnswerForSession(), and saves the evaluation results.
 */

const mongoose = require('mongoose');
const InterviewSession = require('../../models/interview/InterviewSession');
const {
  AnswerEvaluationError,
  evaluateAnswerForSession
} = require('../../services/interview/answerEvaluationService');

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

const findLatestInterviewerQuestion = (transcript = []) => {
  for (let index = transcript.length - 1; index >= 0; index--) {
    if (transcript[index]?.role === 'interviewer') {
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

const updateAnswerProgress = (session) => {
  const transcript = session.transcript || [];
  const answerCount = Math.max(
    Number(session.answerCount) || 0,
    getTranscriptCount(transcript, (turn) => turn.role === 'candidate')
  );
  const questionCount = Math.max(
    Number(session.questionCount) || 0,
    getTranscriptCount(transcript, (turn) => turn.role === 'interviewer')
  );
  const followUpCount = Math.max(
    Number(session.followUpCount) || 0,
    getTranscriptCount(transcript, (turn) => turn.role === 'interviewer' && turn.questionType === 'follow-up')
  );
  const targetQuestionCount = getTargetQuestionCount(session.templateType);

  session.answerCount = answerCount;
  session.questionCount = questionCount;
  session.followUpCount = followUpCount;
  session.completionPercentage = targetQuestionCount > 0
    ? Math.min(100, Math.round((questionCount / targetQuestionCount) * 100))
    : 0;
};

const submitInterviewAnswer = async (req, res) => {
  try {
    const { session, error } = await getAuthorizedSession(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json(error.body);
    }

    const activeQuestion = findLatestInterviewerQuestion(session.transcript);

    if (!activeQuestion) {
      return res.status(400).json({
        error: 'No previous interviewer question found',
        code: 'NO_PREVIOUS_QUESTION'
      });
    }

    const { answer, evaluation } = await evaluateAnswerForSession({
      session,
      question: activeQuestion,
      answer: req.body?.answer
    });

    session.transcript.push({
      role: 'candidate',
      message: answer,
      timestamp: new Date()
    });

    session.transcript.push({
      role: 'evaluation',
      score: evaluation.score,
      technicalAccuracy: evaluation.technicalAccuracy,
      completeness: evaluation.completeness,
      communication: evaluation.communication,
      depth: evaluation.depth,
      practicalKnowledge: evaluation.practicalKnowledge,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      improvements: evaluation.improvements,
      overallFeedback: evaluation.overallFeedback,
      timestamp: new Date()
    });
    updateAnswerProgress(session);

    await session.save();

    res.status(200).json({
      ...evaluation,
      answerCount: session.answerCount,
      questionCount: session.questionCount,
      followUpCount: session.followUpCount,
      completionPercentage: session.completionPercentage
    });
  } catch (error) {
    if (error instanceof AnswerEvaluationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Failed to submit and evaluate answer'
    });
  }
};

module.exports = {
  submitInterviewAnswer
};
