/**
 * @file codingInterviewController.js
 * @summary Controller for the coding round of a mock interview session.
 *          Manages two endpoints: generating a live coding question via the AI service and
 *          handling code submissions which are executed against test cases on Judge0 then
 *          evaluated for complexity and quality by the Groq LLM.
 *
 * @functions
 * - getAuthorizedSession: Validates the session ObjectId, fetches the document, and verifies ownership.
 * - findLatestCodingQuestion: Scans the transcript in reverse to retrieve the last 'coding-question' turn.
 * - generateCodingQuestion: Calls generateCodingQuestionForSession() and appends the problem to the transcript.
 * - submitCodingSolution: Runs the submitted code on Judge0, and on 'submit' action also calls the
 *                         Groq evaluator to score correctness, time/space complexity, and quality;
 *                         appends both a coding-submission and coding-evaluation turn to the transcript.
 */

const mongoose = require('mongoose');
const InterviewSession = require('../../models/interview/InterviewSession');
const {
  CodingInterviewError,
  generateCodingQuestionForSession,
  executeCodeWithJudge0,
  evaluateCodingSolutionWithGROQ
} = require('../../services/interview/codingInterviewService');

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

const findLatestCodingQuestion = (transcript = []) => {
  for (let index = transcript.length - 1; index >= 0; index--) {
    if (transcript[index]?.role === 'coding-question') {
      return transcript[index];
    }
  }

  return null;
};

const generateCodingQuestion = async (req, res) => {
  try {
    const { session, error } = await getAuthorizedSession(req.params.id, req.user._id);
    if (error) return res.status(error.status).json(error.body);

    const question = await generateCodingQuestionForSession(session);

    session.transcript.push({
      role: 'coding-question',
      title: question.title,
      message: question.description,
      description: question.description,
      difficulty: question.difficulty,
      constraints: question.constraints,
      examples: question.examples,
      expectedTopics: question.expectedTopics,
      timestamp: new Date()
    });

    await session.save();

    res.status(200).json(question);
  } catch (error) {
    if (error instanceof CodingInterviewError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Failed to generate coding question'
    });
  }
};

const submitCodingSolution = async (req, res) => {
  try {
    const { session, error } = await getAuthorizedSession(req.params.id, req.user._id);
    if (error) return res.status(error.status).json(error.body);

    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const language = typeof req.body?.language === 'string' ? req.body.language.trim() : '';
    const action = req.body?.action === 'run' ? 'run' : 'submit';

    if (!code) {
      return res.status(400).json({
        error: 'Code submission cannot be empty',
        code: 'EMPTY_CODE'
      });
    }

    const question = req.body?.question || findLatestCodingQuestion(session.transcript);

    if (!question) {
      return res.status(400).json({
        error: 'No coding question found for this session',
        code: 'MISSING_CODING_QUESTION'
      });
    }

    const executionResult = await executeCodeWithJudge0({
      question,
      code,
      language
    });

    if (action === 'run') {
      return res.status(200).json({
        executionResult
      });
    }

    const evaluation = await evaluateCodingSolutionWithGROQ({
      question,
      code,
      language,
      executionResult
    });

    // Remove any existing submission/evaluation for this current question before appending the new one
    for (let i = session.transcript.length - 1; i >= 0; i--) {
      const role = session.transcript[i].role;
      if (role === 'coding-question') {
        break;
      }
      if (role === 'coding-submission' || role === 'coding-evaluation') {
        session.transcript.splice(i, 1);
      }
    }

    session.transcript.push({
      role: 'coding-submission',
      language,
      code,
      executionResult,
      timestamp: new Date()
    });

    session.transcript.push({
      role: 'coding-evaluation',
      correctnessScore: evaluation.correctnessScore,
      timeComplexity: evaluation.timeComplexity,
      spaceComplexity: evaluation.spaceComplexity,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      optimizationSuggestions: evaluation.optimizationSuggestions,
      overallFeedback: evaluation.overallFeedback,
      timestamp: new Date()
    });

    await session.save();

    res.status(200).json({
      executionResult,
      evaluation
    });
  } catch (error) {
    if (error instanceof CodingInterviewError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Failed to submit coding solution'
    });
  }
};

module.exports = {
  generateCodingQuestion,
  submitCodingSolution
};
