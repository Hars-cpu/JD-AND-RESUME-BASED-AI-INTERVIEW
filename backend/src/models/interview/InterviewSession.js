/**
 * @file InterviewSession.js
 * @summary Mongoose schema and model for active and historical interview sessions.
 *          A session is created when the user clicks "Start Interview" and stores the full
 *          conversation transcript (question/answer/evaluation turns) along with session metadata.
 *          The transcript sub-document (transcriptTurnSchema) is a polymorphic union of all turn
 *          types: interviewer questions, candidate answers, evaluation results, coding questions,
 *          coding submissions, and coding evaluations.
 *
 * @schema (interviewSessionSchema)
 * - userId:               Required ObjectId reference to the User model (indexed).
 * - interviewType:        Free-text string describing the interview role/position.
 * - templateType:         Enum 'technical' | 'hr' | 'genai' | 'coding' | 'full-mock' (indexed).
 * - status:               Enum 'in-progress' | 'completed' | 'cancelled' | 'discarded' (indexed).
 * - resumeData:           Mixed object with parsed resume fields (skills, projects, experience, education).
 * - jdData:               Mixed object with parsed JD fields (requiredSkills, technologies, responsibilities).
 * - analysisData:         Mixed object with resume–JD match score and skill gap analysis.
 * - transcript:           Array of transcriptTurnSchema sub-documents (the full conversation log).
 * - questionCount:        Running count of interviewer questions asked.
 * - answerCount:          Running count of candidate answers submitted.
 * - followUpCount:        Running count of follow-up questions generated.
 * - completionPercentage: Progress percentage (0–100).
 * - startedAt / endedAt / duration: Session timing metadata.
 *
 * @schema (transcriptTurnSchema)
 * - role: Enum of 'interviewer' | 'candidate' | 'system' | 'evaluation' | 'coding-question'
 *         | 'coding-submission' | 'coding-evaluation'
 * - message: Turn text content.
 * - score/technicalAccuracy/completeness/communication/depth/practicalKnowledge: Per-turn evaluation scores.
 * - strengths/weaknesses/improvements: Qualitative feedback arrays from evaluation turns.
 * - title/difficulty/description/constraints/examples/expectedTopics: Coding question fields.
 * - language/code/executionResult/correctnessScore/timeComplexity/spaceComplexity: Coding submission fields.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const transcriptTurnSchema = new Schema({
  role: {
    type: String,
    enum: ['interviewer', 'candidate', 'system', 'evaluation', 'coding-question', 'coding-submission', 'coding-evaluation'],
    required: true
  },
  message: {
    type: String,
    trim: true,
    default: ''
  },
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  technicalAccuracy: {
    type: Number,
    min: 0,
    max: 100
  },
  completeness: {
    type: Number,
    min: 0,
    max: 100
  },
  communication: {
    type: Number,
    min: 0,
    max: 100
  },
  depth: {
    type: Number,
    min: 0,
    max: 100
  },
  practicalKnowledge: {
    type: Number,
    min: 0,
    max: 100
  },
  strengths: {
    type: [String],
    default: undefined
  },
  weaknesses: {
    type: [String],
    default: undefined
  },
  improvements: {
    type: [String],
    default: undefined
  },
  overallFeedback: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true,
    default: ''
  },
  questionType: {
    type: String,
    enum: ['initial', 'follow-up'],
    default: undefined
  },
  title: {
    type: String,
    trim: true
  },
  difficulty: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  constraints: {
    type: [String],
    default: undefined
  },
  examples: {
    type: [Schema.Types.Mixed],
    default: undefined
  },
  expectedTopics: {
    type: [String],
    default: undefined
  },
  language: {
    type: String,
    trim: true
  },
  code: {
    type: String
  },
  executionResult: {
    type: Schema.Types.Mixed
  },
  correctnessScore: {
    type: Number,
    min: 0,
    max: 100
  },
  timeComplexity: {
    type: String,
    trim: true
  },
  spaceComplexity: {
    type: String,
    trim: true
  },
  optimizationSuggestions: {
    type: [String],
    default: undefined
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const interviewSessionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true
  },
  interviewType: {
    type: String,
    required: true,
    trim: true
  },
  templateType: {
    type: String,
    enum: ['technical', 'hr', 'genai', 'coding', 'full-mock'],
    default: 'technical',
    index: true
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'cancelled', 'discarded'],
    default: 'in-progress',
    index: true
  },
  resumeData: {
    type: Schema.Types.Mixed,
    required: true
  },
  jdData: {
    type: Schema.Types.Mixed,
    required: true
  },
  analysisData: {
    type: Schema.Types.Mixed,
    required: true
  },
  transcript: {
    type: [transcriptTurnSchema],
    default: []
  },
  questionCount: {
    type: Number,
    min: 0,
    default: 0
  },
  answerCount: {
    type: Number,
    min: 0,
    default: 0
  },
  followUpCount: {
    type: Number,
    min: 0,
    default: 0
  },
  completionPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  duration: {
    type: Number,
    min: 0,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

interviewSessionSchema.index({ userId: 1, createdAt: -1 });

const InterviewSession = mongoose.model('interviewSession', interviewSessionSchema);

module.exports = InterviewSession;
