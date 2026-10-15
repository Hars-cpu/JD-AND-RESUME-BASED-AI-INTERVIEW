/**
 * @file interviewSessionController.js
 * @summary Core CRUD controller managing the lifecycle of an InterviewSession document.
 *          Handles creating new sessions with resume/JD snapshots, fetching session state,
 *          marking sessions as completed with duration calculation, and listing history.
 *
 * @functions
 * - isPlainObject: Type guard that returns true only for non-null, non-array plain objects.
 * - isMissingSnapshot: Returns true if a value is not a non-empty plain object (used to validate snapshots).
 * - normalizeTemplateType: Lowercases and validates the template type against an allowed enum list.
 * - validateStartInterviewInput: Validates that all required fields (interviewType, resumeData, jdData,
 *                                 analysisData) are present and well-formed before session creation.
 * - getAuthorizedSession: Validates the session ObjectId, fetches the document, and checks ownership.
 * - startInterviewSession: Creates a new InterviewSession with 'in-progress' status and stores all snapshots.
 * - getInterviewSession: Returns the full session document for a given session ID.
 * - endInterviewSession: Marks the session as 'completed', calculates total duration in seconds, and saves.
 * - getInterviewHistory: Returns a sorted list of all sessions for the current user.
 */

const mongoose = require('mongoose');
const InterviewSession = require('../../models/interview/InterviewSession');

const isPlainObject = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const isMissingSnapshot = (value) => (
  !isPlainObject(value) ||
  Object.keys(value).length === 0
);

const ALLOWED_TEMPLATE_TYPES = ['technical', 'hr', 'genai', 'coding', 'full-mock'];

const normalizeTemplateType = (templateType) => {
  if (!templateType) return 'technical';

  if (typeof templateType !== 'string') return null;

  const normalizedTemplateType = templateType.trim().toLowerCase();

  return ALLOWED_TEMPLATE_TYPES.includes(normalizedTemplateType) ? normalizedTemplateType : null;
};

const validateStartInterviewInput = (body) => {
  if (!body?.interviewType || typeof body.interviewType !== 'string') {
    return 'interviewType is required';
  }

  if (body.templateType && normalizeTemplateType(body.templateType) === null) {
    return 'templateType must be technical, hr, genai, coding, or full-mock';
  }

  if (isMissingSnapshot(body.resumeData)) {
    return 'resumeData is required';
  }

  if (isMissingSnapshot(body.jdData)) {
    return 'jdData is required';
  }

  if (isMissingSnapshot(body.analysisData)) {
    return 'analysisData is required';
  }

  return null;
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

const startInterviewSession = async (req, res) => {
  try {
    const validationError = validateStartInterviewInput(req.body);
    if (validationError) {
      return res.status(400).json({
        error: validationError,
        code: 'MISSING_FIELDS'
      });
    }

    const session = await InterviewSession.create({
      userId: req.user._id,
      interviewType: req.body.interviewType.trim(),
      templateType: normalizeTemplateType(req.body.templateType),
      status: 'in-progress',
      resumeData: req.body.resumeData,
      jdData: req.body.jdData,
      analysisData: req.body.analysisData,
      transcript: [],
      startedAt: new Date()
    });

    res.status(201).json({
      sessionId: session._id,
      status: session.status,
      templateType: session.templateType
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to start interview session'
    });
  }
};

const getInterviewSession = async (req, res) => {
  try {
    const { session, error } = await getAuthorizedSession(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json(error.body);
    }

    res.status(200).json(session);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch interview session'
    });
  }
};

const endInterviewSession = async (req, res) => {
  try {
    const { session, error } = await getAuthorizedSession(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json(error.body);
    }

    if (session.status === 'completed') {
      return res.status(200).json({
        sessionId: session._id,
        status: session.status,
        duration: session.duration
      });
    }

    const endedAt = new Date();
    const startedAt = session.startedAt || session.createdAt || endedAt;
    const duration = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

    session.status = 'completed';
    session.endedAt = endedAt;
    session.duration = duration;
    await session.save();

    res.status(200).json({
      sessionId: session._id,
      status: session.status,
      duration: session.duration
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to end interview session'
    });
  }
};

const getInterviewHistory = async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('_id interviewType templateType status createdAt');

    const history = sessions.map((session) => ({
      sessionId: session._id,
      interviewType: session.interviewType,
      templateType: session.templateType,
      status: session.status,
      createdAt: session.createdAt
    }));

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch interview history'
    });
  }
};

module.exports = {
  startInterviewSession,
  getInterviewSession,
  endInterviewSession,
  getInterviewHistory
};
