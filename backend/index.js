/**
 * ALGOPILOT Backend Entry Point
 * 
 * This file serves as the main entry point for the ALGOPILOT Express server.
 * It loads environment configurations, establishes connections to databases (MongoDB & Redis),
 * configures essential middleware (CORS, JSON parsing, cookie-parser, request logger),
 * and maps all API routes (user auth, problems, submissions, AI chat, video content,
 * mock interviews, and profiles).
 */

const express = require('express');
const app = express();
require('dotenv').config();

// Database configuration/connection modules
const main = require('./src/config/db'); // MongoDB connection setup
const redisClient = require("./src/config/redis"); // Redis client setup for caching and blacklisting

// HTTP / Cookie Middleware
const cookie_parser = require('cookie-parser');
const cors = require('cors');

// API Routers
const authRouter = require('./src/routes/userAuth'); // Handles login, signup, and auth check
const problemRouter = require('./src/routes/problemCreator'); // Handles CRUD operations for coding problems
const submitRouter = require('./src/routes/submit'); // Handles code submission evaluation via Judge0
const aiRouter = require('./src/routes/aiChatting'); // Handles AI-driven chat assistance
const videoRouter = require('./src/routes/videoCreator'); // Handles video tutorials upload/management by admins
const interviewRouter = require('./src/routes/interview'); // Handles AI mock interview sessions & evaluation reports
const publicProfileRouter = require('./src/routes/publicProfile'); // Handles retrieval of public candidate profiles

// Middleware for logging detailed request data
const requestLogger = require('./src/middleware/requestLogger');

const port = process.env.PORT || 3000;

// Enable CORS for credentials (cookies) with frontend URL validation
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5714',
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true })); //parse form data
app.use(cookie_parser());

// Base health check route to verify web service health status
app.get('/health', (req, res) => {
    res.send("Server is up and running");
});

// Standard route registration
app.use('/user', authRouter);
app.use('/problem', problemRouter);
app.use('/submission', submitRouter);
app.use('/ai', aiRouter);
app.use('/video', videoRouter);

// Logged API route registration
app.use('/api/interview', requestLogger, interviewRouter);
app.use('/api/profile', requestLogger, publicProfileRouter);

/**
 * Initializes backend connections and starts the Express server listening on the configured port.
 * Establishes a blocking connection with MongoDB before booting the server, while
 * attempting a background connection to Redis to ensure Redis downtime doesn't brick the API.
 */
const InitializeConnection = async () => {
    try {
        // Connect to MongoDB only
        await main();
        console.log("✅ Connected to MongoDB");

        // Connect to Redis in background (don't wait for it)
        redisClient.connect().catch(err => {
            console.log("⚠️ Redis connection failed, but server continues:", err.message);
        });
                    
        app.listen(port, () => {
            console.log(`🚀 Server is running on port ${port}`);
        });
    } catch (error) {
        console.log("❌ Error Occurred: " + error);
    }
}

// Start database connections and boot the server
InitializeConnection();
