/**
 * Admin Video Solution Uploads & Management Router
 * 
 * This router exposes endpoints for administrators to generate secure upload signatures
 * for hosting explanation videos (e.g., via Cloudinary or other CDNs), saving video metadata,
 * and deleting associated video solutions for coding challenges.
 */

const express = require('express');
const adminMiddleware = require('../middleware/adminMiddleware'); // Restricts video actions to administrators
const videoRouter = express.Router();

// Import controllers containing logic for managing video uploads and metadata
const { generateUploadSignature, saveVideoMetadata, deleteVideo } = require("../controllers/videoSection");

/**
 * @route   GET /video/create/:problemId
 * @desc    Generates a secure, signed upload URL/signature for uploading videos (e.g., to Cloudinary)
 * @access  Private (Admins only)
 */
videoRouter.get("/create/:problemId", adminMiddleware, generateUploadSignature);

/**
 * @route   POST /video/save
 * @desc    Saves video reference metadata (e.g. public URL, public ID, duration) to the database problem schema
 * @access  Private (Admins only)
 */
videoRouter.post("/save", adminMiddleware, saveVideoMetadata);

/**
 * @route   DELETE /video/delete/:problemId
 * @desc    Deletes an associated video solution for a coding challenge
 * @access  Private (Admins only)
 */
videoRouter.delete("/delete/:problemId", adminMiddleware, deleteVideo);

module.exports = videoRouter;