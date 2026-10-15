/**
 * User Authentication & Session Management Controller
 * 
 * This file handles core business logic for user lifecycle management:
 * 1. User registration with automatic role assignment ('user').
 * 2. User login via password hashing comparison (bcrypt) and issuing of stateful JWT cookies.
 * 3. User logout including JWT invalidation via Redis blacklist storage and cookie clearance.
 * 4. Admin registration restricted to pre-existing authorized admin profiles.
 * 5. Complete user profile deletion and automatic data cascade.
 */

const redisClient = require('../config/redis'); // Redis client used for caching and token blacklisting
const User = require('../models/user'); // Candidate and administrator schema model
const validate = require('../utils/validator'); // Validation helper for incoming request bodies
const bcrypt = require('bcrypt'); // Library for hashing and comparing passwords
const jwt = require('jsonwebtoken'); // JSON Web Token utility for stateless sessions

// Detect production environment once to configure secure transport rules
const isProduction = process.env.NODE_ENV === 'production';

// Reusable standard HTTP-only cookie configuration parameters
const cookieOptions = {
  maxAge: 60 * 60 * 1000,                  // Expiration interval: 1 hour in milliseconds
  httpOnly: true,                          // Mitigates XSS by preventing client-side script access
  secure: false,                            // Allow cookies over HTTP during local development
  sameSite: 'Lax'  // Controls cross-site cookie transmission policies
};

/**
 * Registers a new candidate user profile in the database.
 * 
 * Validates request data, hashes credentials, locks candidate role, creates database record,
 * generates an active session token, and responds with the cookie and profile details.
 * 
 * @param {Object} req - Express request object containing firstName, lastName, emailId, and password
 * @param {Object} res - Express response object
 */
const register = async (req, res) => {
  try {
    // Validate request body schema
    validate(req.body);
    const { firstName, lastName, emailId, password } = req.body;
    
    // Hash password securely (cost factor of 10)
    req.body.password = await bcrypt.hash(password, 10);
    
    // Hardcode user role to prevent privilege escalation attempts during registration
    req.body.role = 'user';

    const user = await User.create({
      firstName,
      lastName: lastName || undefined,
      emailId,
      password: req.body.password,
      role: 'user'
    });

    // Sign session token expiring in 1 hour
    const token = jwt.sign(
      { _id: user._id, emailId: emailId, role: 'user' },
      process.env.JWT_KEY,
      { expiresIn: 60 * 60 }
    );

    const reply = {
      firstName: user.firstName,
      lastName: user.lastName,
      emailId: user.emailId,
      _id: user._id,
      role: user.role
    };

    res.cookie('token', token, cookieOptions);
    res.status(201).send({ user: reply, message: 'User registered successfully' });
  } catch (error) {
    res.status(400).send("Error: " + error);
  }
};

/**
 * Authenticates user credentials and initiates a new session.
 * 
 * Fetches user profile, verifies hashed password correctness, issues a signed JWT,
 * and sets cookie options for cross-site browser authorization.
 * 
 * @param {Object} req - Express request object containing emailId and password
 * @param {Object} res - Express response object
 */
const login = async (req, res) => {
  try {
    const { emailId, password } = req.body;
    
    if (!emailId) throw new Error('Email Id is required');
    if (!password) throw new Error('Password is required');

    const user = await User.findOne({ emailId });

    if (!user) throw new Error('User not found');

    const match = await bcrypt.compare(password, user.password);

    if (!match) throw new Error('Invalid credentials');

    // Issue JWT containing basic profile metadata
    const token = jwt.sign(
      { _id: user._id, emailId: emailId, role: user.role },
      process.env.JWT_KEY,
      { expiresIn: 60 * 60 }
    );

    const reply = {
      firstName: user.firstName,
      lastName: user.lastName,
      emailId: user.emailId,
      _id: user._id,
      role: user.role
    };

    res.cookie('token', token, cookieOptions);
    res.status(200).send({ user: reply, message: 'Logged In Successfully' });

  } catch (error) {
    res.status(401).send({ message: error.message });
  }
};

/**
 * Clears the active session and invalidates the authentication token.
 * 
 * Extracts JWT token from incoming request, decodes its expiration epoch,
 * logs it into the Redis blacklist until its scheduled expiration to prevent reuse,
 * 
 * and clears the browser cookie reference.
 * 
 * @param {Object} req - Express request object containing session token in req.cookies
 * @param {Object} res - Express response object
 */
const logout = async (req, res) => {
  try {
    const { token } = req.cookies;
    if (!token) {
      return res.status(400).send("No token found");
    }

    const payload = jwt.decode(token);

    if (!payload || !payload.exp) {
      return res.status(400).send("Invalid token");
    }

    // Calculate remaining seconds until token expires
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = payload.exp - currentTime;

    if (timeUntilExpiry > 0) {
      // Store token inside Redis with the block state, matching the original token expiry (EX flag)
      await redisClient.set(`token:${token}`, 'Blocked', 'EX', timeUntilExpiry);
    }

    // Clear active session cookie in client browser (using matching CORS path criteria)
    res.cookie("token", "", {
      expires: new Date(0),
      httpOnly: true,
      secure: false,
      sameSite: isProduction ? 'None' : 'Lax'
    });

    res.send("Logged Out Successfully");
  } catch (error) {
    console.error("Logout error:", error);
    res.status(503).send("Error: " + error.message);
  }
};

/**
 * Registers a new administrator profile in the system.
 * 
 * This endpoint is restricted by adminMiddleware. It validates the body schema,
 * creates a new admin user record, signs a session cookie, and returns a success response.
 * 
 * @param {Object} req - Express request containing admin details
 * @param {Object} res - Express response object
 */
const adminRegister = async (req, res) => {
  try {
    if (req.body.role && req.body.role != 'admin') {
      throw new Error('Invalid Credentials');
    }

    validate(req.body);
    const { firstName, emailId, password } = req.body;
    req.body.password = await bcrypt.hash(password, 10);

    const user = await User.create(req.body);
    const token = jwt.sign(
      { _id: user._id, emailId: emailId, role: user.role },
      process.env.JWT_KEY,
      { expiresIn: 60 * 60 }
    );

    res.cookie('token', token, cookieOptions);
    res.status(201).send({ message: 'Admin registered successfully' });
  } catch (error) {
    res.status(400).send("Error: " + error);
  }
};

/**
 * Permanently deletes the authenticated user's profile.
 * 
 * Removes the core user document from MongoDB. Associated document cascades
 * (e.g., deleting code submissions) are handled in the background by Mongoose
 * post-remove hook middleware.
 * 
 * @param {Object} req - Express request containing active user session metadata
 * @param {Object} res - Express response object
 */
const deleteProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    // Delete user profile document
    await User.findByIdAndDelete(userId);

    res.status(200).send("Deleted Successfully");
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};

module.exports = { register, login, logout, adminRegister, deleteProfile };