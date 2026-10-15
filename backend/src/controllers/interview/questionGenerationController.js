/**
 * @file questionGenerationController.js
 * @summary Interview question generation controller. Handles session loading, checks user authorization parameters,
 *          calculates mock progression metrics based on template limits, and triggers LLM services to generate 
 *          relevant technical/verbal questions.
 * 
 * @functions
 * - getAuthorizedSession: Validates Mongo Object IDs, finds the session, and verifies ownership.
 * - getTargetQuestionCount: Returns target question limits according to mock types (Coding: 5, Full: 20, General: 10).
 * - getTranscriptCount: Helper to count existing entries matching specific turn roles.
 * - updateQuestionProgress: Recalculates completed questions ratios and updates session percentage fields.
 * - generateInterviewQuestion: Main endpoint controller that requests questions, pushes interviewer turns into
 *                              transcripts, and saves progress parameters.
 */

const mongoose = require('mongoose');
const InterviewSession = require('../../models/interview/InterviewSession');
const {
  QuestionGenerationError,
  generateQuestionForSession
} = require('../../services/interview/questionGenerationService');

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

const getTargetQuestionCount = (templateType) => {
  if (templateType === 'coding') return 5;
  if (templateType === 'full-mock') return 20;
  return 10;
};

const getTranscriptCount = (transcript = [], predicate) => (
  transcript.filter(predicate).length
);

const updateQuestionProgress = (session) => {
  const transcriptQuestionCount = getTranscriptCount(
    session.transcript || [],
    (turn) => turn.role === 'interviewer'
  );
  const questionCount = Math.max(Number(session.questionCount) || 0, transcriptQuestionCount);
  const targetQuestionCount = getTargetQuestionCount(session.templateType);

  session.questionCount = questionCount;
  session.completionPercentage = targetQuestionCount > 0
    ? Math.min(100, Math.round((questionCount / targetQuestionCount) * 100))
    : 0;
};

const generateInterviewQuestion = async (req, res) => {
  try {
    console.log('[Question Controller] Received generate interview question request. Session ID:', req.params.id);
    
    const { session, error } = await getAuthorizedSession(req.params.id, req.user._id);
    if (error) {
      console.warn('[Question Controller] Authorization failed:', error.body.error);
      return res.status(error.status).json(error.body);
    }

    console.log('[Question Controller] Authorized session template:', session.templateType, '| Current question count:', session.questionCount);

    const questionData = await generateQuestionForSession({
      session,
      difficulty: req.body?.difficulty
    });

    console.log('[Question Controller] Question successfully generated. Category:', questionData.category, '| Source:', questionData.source);

    session.transcript.push({
      role: 'interviewer',
      message: questionData.question,
      category: questionData.category,
      timestamp: new Date()
    });
    updateQuestionProgress(session);

    await session.save();
    console.log('[Question Controller] Session successfully updated in DB. Progress:', session.completionPercentage, '%');

    res.status(200).json({
      ...questionData,
      questionCount: session.questionCount,
      completionPercentage: session.completionPercentage
    });
  } catch (error) {
    console.error('[Question Controller] Question generation failed:', error);
    
    if (error instanceof QuestionGenerationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Failed to generate interview question',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

module.exports = {
  generateInterviewQuestion
};
