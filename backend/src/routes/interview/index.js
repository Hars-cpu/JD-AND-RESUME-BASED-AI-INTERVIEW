/**
 * AI Mock Interview & Evaluation Engine Router
 *
 * This router acts as the primary hub for the mock interview preparation suite.
 * It manages resume/JD file uploads, AI matching analysis, session control lifecycle
 * (start, resume, discard, end), question and follow-up generation (real-time chat/voice),
 * coding round challenges, detailed analytics, achievements tracking, and PDF exports
 * for candidate evaluation reports, learning roadmaps, and preparation hubs.
 */

const express = require('express');
const userMiddleware = require('../../middleware/userMiddleware'); // Enforces login authentication

// Upload middleware services (Multer configurations)
const { resumeUploadService } = require('../../services/interview/resumeUploadService'); // Handles PDF/Word resume uploads
const { jdUploadService } = require('../../services/interview/jdUploadService'); // Handles Job Description text/file uploads

// Controllers for Resume, JD parsing, and AI analysis
const { uploadResume, handleResumeUploadError } = require('../../controllers/interview/resumeController');
const { uploadJd, handleJdUploadError } = require('../../controllers/interview/jdController');
const { analyzeResumeAndJd } = require('../../controllers/interview/interviewAnalysisController');

// Controllers for session lifecycle
const {
  startInterviewSession,
  getInterviewSession,
  endInterviewSession,
  getInterviewHistory
} = require('../../controllers/interview/interviewSessionController'); 

// Controllers for conversational AI & real-time evaluations
const { generateInterviewQuestion } = require('../../controllers/interview/questionGenerationController');
const { submitInterviewAnswer } = require('../../controllers/interview/answerEvaluationController');
const { generateFollowUpQuestion } = require('../../controllers/interview/followUpQuestionController');
const { generateInterviewScorecard } = require('../../controllers/interview/scorecardGenerationController');

// Controllers for managing coding tasks during coding interview rounds
const {
  generateCodingQuestion,
  submitCodingSolution
} = require('../../controllers/interview/codingInterviewController');

// Controllers for metrics, learning curves, and gamification streaks
const { getInterviewAnalytics } = require('../../controllers/interview/interviewAnalyticsController');
const { getLearningRoadmap } = require('../../controllers/interview/learningRoadmapController');
const { getPreparationHub } = require('../../controllers/interview/preparationHubController');

// Controllers for compiling data into downloadable PDF reports
const {
  exportInterviewReportPdf,
  exportLearningRoadmapPdf,
  exportPreparationHubPdf
} = require('../../controllers/interview/pdfExportController');

// Controllers for session persistence and state restoration
const {
  getActiveInterviewSession,
  resumeInterviewSession,
  discardInterviewSession
} = require('../../controllers/interview/interviewResumeController');

// Controller for checking candidate badges and daily streaks
const { getInterviewAchievements } = require('../../controllers/interview/achievementController');

const interviewRouter = express.Router();

/**
 * @route   POST /api/interview/resume/upload
 * @desc    Uploads a candidate's resume (PDF/DOCX) to Cloudinary
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/resume/upload',
  userMiddleware,
  resumeUploadService.single('resume'),
  handleResumeUploadError,
  uploadResume
);

/**
 * @route   POST /api/interview/jd/upload
 * @desc    Uploads a target Job Description (text/PDF) to extract core tech stack requirements
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/jd/upload',
  userMiddleware,
  jdUploadService.single('jd'),
  handleJdUploadError,
  uploadJd
);

/**
 * @route   POST /api/interview/analyze
 * @desc    Performs match-rate analysis comparing the uploaded resume to the Job Description
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/analyze',
  userMiddleware,
  analyzeResumeAndJd
);

/**
 * @route   POST /api/interview/session/start
 * @desc    Initiates a new mock interview session and returns initial greeting prompt
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/session/start',
  userMiddleware,
  startInterviewSession
);

/**
 * @route   GET /api/interview/active-session
 * @desc    Checks if there is an unfinished, ongoing interview session for the candidate
 * @access  Private (Authenticated users only)
 */
interviewRouter.get(
  '/active-session',
  userMiddleware,
  getActiveInterviewSession
);

/**
 * @route   GET /api/interview/session/:id
 * @desc    Retrieves transcript, status, and metadata for a specific interview session
 * @access  Private (Authenticated users only)
 */
interviewRouter.get(
  '/session/:id',
  userMiddleware,
  getInterviewSession
);

/**
 * @route   POST /api/interview/session/:id/end
 * @desc    Gracefully halts the interview, preventing further questions
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/session/:id/end',
  userMiddleware,
  endInterviewSession
);

/**
 * @route   POST /api/interview/session/:id/resume
 * @desc    Restores an in-progress or interrupted interview session to active status
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/session/:id/resume',
  userMiddleware,
  resumeInterviewSession
);

/**
 * @route   POST /api/interview/session/:id/discard
 * @desc    Discards/archives an ongoing session to allow starting a new clean round
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/session/:id/discard',
  userMiddleware,
  discardInterviewSession
);

/**
 * @route   POST /api/interview/session/:id/generate-question
 * @desc    Generates the next interview question using Groq API (tailored to resume/JD)
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/session/:id/generate-question',
  userMiddleware,
  generateInterviewQuestion
);

/**
 * @route   POST /api/interview/session/:id/submit-answer
 * @desc    Submits candidate response, runs real-time score evaluation, and saves transcript
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/session/:id/submit-answer',
  userMiddleware,
  submitInterviewAnswer
);

/**
 * @route   POST /api/interview/session/:id/generate-followup
 * @desc    Generates a context-aware follow-up question based on the candidate's last response
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/session/:id/generate-followup',
  userMiddleware,
  generateFollowUpQuestion
);

/**
 * @route   POST /api/interview/session/:id/generate-scorecard
 * @desc    Ends the interview, aggregates performance parameters, locks session, and returns final scorecard
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/session/:id/generate-scorecard',
  userMiddleware,
  generateInterviewScorecard
);

/**
 * @route   POST /api/interview/session/:id/generate-coding-question
 * @desc    Generates a dynamic DSA coding challenge for the coding round workspace
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/session/:id/generate-coding-question',
  userMiddleware,
  generateCodingQuestion
);

/**
 * @route   POST /api/interview/session/:id/submit-coding-solution
 * @desc    Evaluates coding solution code execution and complexity (Big O) parameters
 * @access  Private (Authenticated users only)
 */
interviewRouter.post(
  '/session/:id/submit-coding-solution',
  userMiddleware,
  submitCodingSolution
);

/**
 * @route   GET /api/interview/analytics
 * @desc    Gathers long-term interview scores, strengths, weaknesses, and performance curves
 * @access  Private (Authenticated users only)
 */
interviewRouter.get(
  '/analytics',
  userMiddleware,
  getInterviewAnalytics
);

/**
 * @route   GET /api/interview/achievements
 * @desc    Checks and returns user placement milestones, unlocked badges, and daily streaks
 * @access  Private (Authenticated users only)
 */
interviewRouter.get(
  '/achievements',
  userMiddleware,
  getInterviewAchievements
);

/**
 * @route   GET /api/interview/report/:sessionId/pdf
 * @desc    Compiles the finalized interview scorecard and detailed feedback into a downloadable PDF
 * @access  Private (Authenticated users only)
 */
interviewRouter.get(
  '/report/:sessionId/pdf',
  userMiddleware,
  exportInterviewReportPdf
);

/**
 * @route   GET /api/interview/roadmap
 * @desc    Fetches custom learning path curriculum generated based on candidate's weaknesses
 * @access  Private (Authenticated users only)
 */
interviewRouter.get(
  '/roadmap',
  userMiddleware,
  getLearningRoadmap
);

/**
 * @route   GET /api/interview/roadmap/pdf
 * @desc    Exports the personalized roadmap curriculum as a PDF file
 * @access  Private (Authenticated users only)
 */
interviewRouter.get(
  '/roadmap/pdf',
  userMiddleware,
  exportLearningRoadmapPdf
);

/**
 * @route   GET /api/interview/preparation-hub
 * @desc    Gathers structured topic modules, timeline schedule checklist, and daily tasks
 * @access  Private (Authenticated users only)
 */
interviewRouter.get(
  '/preparation-hub',
  userMiddleware,
  getPreparationHub
);

/**
 * @route   GET /api/interview/preparation-hub/pdf
 * @desc    Exports the aggregated tracks, timelines, and outcomes check list into a PDF plan
 * @access  Private (Authenticated users only)
 */
interviewRouter.get(
  '/preparation-hub/pdf',
  userMiddleware,
  exportPreparationHubPdf
);

/**
 * @route   GET /api/interview/history
 * @desc    Lists all past completed and in-progress interview sessions for dashboard logs
 * @access  Private (Authenticated users only)
 */
interviewRouter.get(
  '/history',
  userMiddleware,
  getInterviewHistory
);

module.exports = interviewRouter;
