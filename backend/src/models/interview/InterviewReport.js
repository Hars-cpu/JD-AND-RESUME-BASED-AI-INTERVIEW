/**
 * @file InterviewReport.js
 * @summary Mongoose schema and model for AI-generated interview scorecards.
 *          One report is created per session when the user triggers scorecard generation.
 *          Stores five dimension scores, qualitative feedback arrays, and the AI hire recommendation.
 *          A compound index on (userId, createdAt DESC) supports fast dashboard listing.
 *
 * @schema
 * - userId:                Required ObjectId reference to the User model (indexed).
 * - sessionId:             Required, unique ObjectId reference to the InterviewSession model.
 * - overallScore:          Aggregate interview score (0–100).
 * - technicalScore:        Score for technical knowledge dimension (0–100).
 * - communicationScore:    Score for communication and articulation (0–100).
 * - problemSolvingScore:   Score for analytical reasoning and problem-solving (0–100).
 * - projectDiscussionScore: Score for depth of project knowledge discussion (0–100).
 * - codingScore:           Score for coding round performance (0–100).
 * - strengths:             String array of AI-identified candidate strengths.
 * - weaknesses:            String array of AI-identified candidate weaknesses.
 * - recommendations:       String array of AI-generated improvement recommendations.
 * - summary:               Narrative interview summary text from the scorecard.
 * - hireRecommendation:    Enum 'Strong Hire' | 'Hire' | 'Borderline' | 'No Hire'.
 * - createdAt:             Report creation timestamp (default: Date.now).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const interviewReportSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'interviewSession',
    required: true,
    unique: true
  },
  overallScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  technicalScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  communicationScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  problemSolvingScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  projectDiscussionScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  codingScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  strengths: {
    type: [String],
    default: []
  },
  weaknesses: {
    type: [String],
    default: []
  },
  recommendations: {
    type: [String],
    default: []
  },
  summary: {
    type: String,
    trim: true,
    default: ''
  },
  hireRecommendation: {
    type: String,
    enum: ['Strong Hire', 'Hire', 'Borderline', 'No Hire'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

interviewReportSchema.index({ userId: 1, createdAt: -1 });

const InterviewReport = mongoose.model('interviewReport', interviewReportSchema);

module.exports = InterviewReport;
