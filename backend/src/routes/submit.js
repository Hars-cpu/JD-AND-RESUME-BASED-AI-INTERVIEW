/**
 * Submission Router for Code Evaluation
 * 
 * This router handles code submission and execution requests from authenticated users.
 * It integrates with Judge0 for code compilation and execution via the userSubmission controller.
 */

const express = require('express');
const submitRouter = express.Router();

// Import user authentication middleware and submission controllers
const userMiddleware = require("../middleware/userMiddleware");
const {submitCode,runCode} = require("../controllers/userSubmission");

/**
 * @route   POST /submission/submit/:id
 * @desc    Evaluates a user's code submission against test cases using Judge0
 * @access  Private (Authenticated users only)
 */
submitRouter.post("/submit/:id", userMiddleware, submitCode);
submitRouter.post("/run/:id",userMiddleware,runCode);


module.exports = submitRouter;
