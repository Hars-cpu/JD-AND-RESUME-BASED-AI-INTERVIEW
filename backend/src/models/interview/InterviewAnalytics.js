/**
 * @file InterviewAnalytics.js
 * @summary Mongoose schema and model for aggregated interview performance analytics per user.
 *          Stores one document per user (unique userId index) with cumulative score averages,
 *          skill strengths/weaknesses, per-skill score trends, and AI-generated recommendations.
 *          Updated after each scorecard is generated to maintain a running performance summary.
 *
 * @schema
 * - userId:            Required, unique ObjectId reference to the User model.
 * - totalInterviews:   Lifetime count of all started sessions.
 * - completedInterviews: Count of sessions that reached scorecard generation.
 * - scores:            Embedded analyticsScoreSchema with averageTechnical, averageCommunication,
 *                      averageCoding, and averageOverall (all 0–100).
 * - strongSkills:      String array of skills where the user consistently scores high.
 * - weakSkills:        String array of skills where the user consistently scores low.
 * - skillTrends:       Array of skillTrendSchema sub-documents tracking per-skill score history.
 * - recommendations:   String array of AI-generated improvement recommendations.
 * - lastSessionId:     ObjectId reference to the most recent InterviewSession.
 * - lastReportId:      ObjectId reference to the most recent InterviewReport.
 * - lastInterviewAt:   Date of the most recent completed interview.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const analyticsScoreSchema = new Schema({
  averageTechnical: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  averageCommunication: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  averageCoding: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  averageOverall: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, { _id: false });

const skillTrendSchema = new Schema({
  skill: {
    type: String,
    required: true,
    trim: true
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  lastAssessedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const interviewAnalyticsSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    unique: true,
    index: true
  },
  totalInterviews: {
    type: Number,
    min: 0,
    default: 0
  },
  completedInterviews: {
    type: Number,
    min: 0,
    default: 0
  },
  scores: {
    type: analyticsScoreSchema,
    default: {}
  },
  strongSkills: {
    type: [String],
    default: []
  },
  weakSkills: {
    type: [String],
    default: []
  },
  skillTrends: {
    type: [skillTrendSchema],
    default: []
  },
  recommendations: {
    type: [String],
    default: []
  },
  lastSessionId: {
    type: Schema.Types.ObjectId,
    ref: 'interviewSession'
  },
  lastReportId: {
    type: Schema.Types.ObjectId,
    ref: 'interviewReport'
  },
  lastInterviewAt: {
    type: Date
  }
}, {
  timestamps: true
});

const InterviewAnalytics = mongoose.model('interviewAnalytics', interviewAnalyticsSchema);

module.exports = InterviewAnalytics;
