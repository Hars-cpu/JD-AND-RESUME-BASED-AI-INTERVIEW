/**
 * Coding Problem Creation & Retrieval Router
 * 
 * This router exposes endpoints for administrators to create, update, and delete coding problems,
 * and for authenticated users to view problems, track their solved questions, get their detailed
 * submissions, and fetch list of attempted but unsolved questions.
 */

const express = require('express');
const problemRouter = express.Router();

// Import role verification middlewares
const adminMiddleware = require('../middleware/adminMiddleware'); // Restricts write operations to admin roles
const userMiddleware = require('../middleware/userMiddleware.js'); // Validates core candidate authentication

// Import controllers containing logic for problem CRUD and user completion tracking
const {
  createProblem,
  updateProblem,
  deleteProblem,
  getProblemById,
  getAllProblem,
  solvedAllProblemByUser,
  submittedProblem,
  getAttemptedProblems
} = require('../controllers/userProblem');

/**
 * @route   POST /problem/create
 * @desc    Creates a new coding challenge
 * @access  Private (Admins only)
 */
problemRouter.post('/create', adminMiddleware, createProblem);

/**
 * @route   PUT /problem/update/:id
 * @desc    Updates an existing coding challenge by database ID
 * @access  Private (Admins only)
 */
problemRouter.put("/update/:id", adminMiddleware, updateProblem);

/**
 * @route   DELETE /problem/delete/:id
 * @desc    Removes a coding challenge by database ID
 * @access  Private (Admins only)
 */
problemRouter.delete("/delete/:id", adminMiddleware, deleteProblem);

/**
 * @route   GET /problem/problemById/:id
 * @desc    Fetches specific coding challenge details (description, boilerplate) by database ID
 * @access  Private (Authenticated users only)
 */
problemRouter.get("/problemById/:id", userMiddleware, getProblemById);

/**
 * @route   GET /problem/getAllProblem
 * @desc    Fetches all available coding challenges in the repository
 * @access  Private (Authenticated users only)
 */
problemRouter.get("/getAllProblem", userMiddleware, getAllProblem);

/**
 * @route   GET /problem/problemSolvedByUser
 * @desc    Lists all coding challenges successfully solved (accepted status) by the logged-in candidate
 * @access  Private (Authenticated users only)
 */
problemRouter.get("/problemSolvedByUser", userMiddleware, solvedAllProblemByUser);

/**
 * @route   GET /problem/submittedProblem/:pid
 * @desc    Retrieves all past code submissions and history of a user for a specific problem ID
 * @access  Private (Authenticated users only)
 */
problemRouter.get("/submittedProblem/:pid", userMiddleware, submittedProblem);

/**
 * @route   GET /problem/attemptedProblem
 * @desc    Fetches all coding challenges the user has attempted but not yet solved successfully (wrong answers, compile errors etc.)
 * @access  Private (Authenticated users only)
 */
problemRouter.get("/attemptedProblem", userMiddleware, getAttemptedProblems);

module.exports = problemRouter;