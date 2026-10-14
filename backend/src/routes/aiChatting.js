/**
 * AI Chat Doubts Solver Router
 * 
 * This router exposes endpoints for authenticated users to send coding-related doubts
 * to the AI solver and receive intelligent, context-aware responses.
 */

const express = require('express');
const aiRouter = express.Router();
const userMiddleware = require('../middleware/userMiddleware');
const solveDoubt = require('../controllers/solveDoubt');

/**
 * @route   POST /ai/chat
 * @desc    Sends user's doubt query to AI solver for intelligent resolution and explanation
 * @access  Private (Authenticated users only)
 */
aiRouter.post('/chat', userMiddleware, async (req, res) => {
  try {
    await solveDoubt(req, res);
  } catch (error) {
    console.error("Error in /ai/chat route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = aiRouter;