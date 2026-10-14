/**
 * @file submission.js
 * @summary Mongoose schema for the Submission collection.
 *          Stores every code run/submit attempt by a user against a problem, including the
 *          submitted code, language, verdict (accepted/wrong/error), runtime (ms), memory (kB),
 *          error messages, and test case pass counts.
 *          Has a compound index on (userId, problemId) to speed up user-specific submission queries.
 *
 * @schema fields
 * - userId, problemId: ObjectId refs linking to User and Problem collections
 * - code: the user's submitted source code string
 * - language: one of 'javascript' | 'cpp' | 'java'
 * - status: 'pending' | 'accepted' | 'wrong' | 'error'
 * - runtime (ms), memory (kB), errorMessage, testCasesPassed, testCasesTotal
 * - timestamps: auto-managed createdAt / updatedAt
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const submissionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
  problemId: {
    type: Schema.Types.ObjectId,
    ref: 'problem',
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    required: true,
    enum: ['javascript', 'cpp', 'java'],
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'wrong', 'error'],
    default: 'pending'
  },
  runtime: {
    type: Number,  // milliseconds
    default: 0
  },
  memory: {
    type: Number,  // kB
    default: 0
  },
  errorMessage: {
    type: String,
    default: ''
  },
  testCasesPassed: {
    type: Number,
    default: 0
  },
  testCasesTotal: {  
    type: Number,
    default: 0
  }
}, { 
  timestamps: true
});
// optimising queries ke liye
// index to quickly find all submissions by a user for a specific problem
// indexing eise create kiya ki userId aur problemId ke combination pe queries fast ho jaye
// 1 aur 1 ka matlab ascending order mein index create karna hai dono fields ke liye
// -1 ka matlab descending order hota
submissionSchema.index({ userId: 1, problemId: 1 });
const Submission = mongoose.model('submission',submissionSchema);

module.exports = Submission;