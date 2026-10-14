/**
 * User Authentication & Authorization Router
 * 
 * This router defines paths for managing candidate and admin registration,
 * user sessions (login/logout), profile deletion, and session status verification.
 * It enforces authentication through userMiddleware and administrative access
 * restrictions through adminMiddleware.
 */

const express = require('express');
const authRouter = express.Router();

// Import controllers containing business logic for authentication tasks
const { register, login, logout, adminRegister, deleteProfile } = require('../controllers/userAuthent');

// Import authentication and role verification middlewares
const userMiddleware = require("../middleware/userMiddleware"); // Validates JWT & sets req.user
const adminMiddleware = require("../middleware/adminMiddleware"); // Ensures user is logged in and is an administrator

/**
 * @route   POST /user/register
 * @desc    Registers a new candidate user profile
 * @access  Public
 */
authRouter.post('/register', register);

/**
 * @route   POST /user/login
 * @desc    Authenticates a user and issues a HTTP-only JWT cookie
 * @access  Public
 */
authRouter.post('/login', login);

/**
 * @route   POST /user/logout
 * @desc    Clears the active session and blacklists the JWT
 * @access  Private (Authenticated users only)
 */
authRouter.post('/logout', userMiddleware, logout);

/**
 * @route   POST /user/admin/register
 * @desc    Registers a new administrator profile
 * @access  Private (Admins only)
 */
authRouter.post('/admin/register', adminMiddleware, adminRegister);   

/**
 * @route   DELETE /user/deleteprofile
 * @desc    Deletes the logged-in user's profile and credentials
 * @access  Private (Authenticated users only)
 */
authRouter.delete('/deleteprofile', userMiddleware, deleteProfile);

/**
 * @route   GET /user/check
 * @desc    Validates active JWT cookie and returns authenticated user metadata
 *          Used by frontend auth slice to restore user session on page refresh.
 * @access  Private (Authenticated users only)
 */
authRouter.get("/check", userMiddleware, (req, res) => {
  // If userMiddleware failed to populate req.user, reject access
  if (!req.user){
    return res.status(401).send({
      user: null,
      message: "Invalid User / Token missing",
    });
  }

  // Filter sensitive fields and return only necessary candidate profile data
  const reply = {
    firstName: req.user.firstName,
    emailId: req.user.emailId,
    _id: req.user._id,
    role: req.user.role,
  };

  res.status(200).send({
    user: reply,
    message: "Valid User",
  });
});

module.exports = authRouter;