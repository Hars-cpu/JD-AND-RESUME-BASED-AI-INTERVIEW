/**
 * @file resumeController.js
 * @summary Controller for handling resume PDF file uploads and parsing.
 *          Receives the user's resume as a PDF file via multer memory storage, passes the
 *          binary buffer to the resume parser service (AI-powered extraction), and returns
 *          structured data (skills, experience, education) as JSON to the frontend.
 *
 * @functions
 * - uploadResume: Validates the uploaded PDF, calls parseResume() on the buffer, and returns structured resume data.
 * - handleResumeUploadError: Express error-handling middleware that translates multer and file-type
 *                            validation errors into consistent JSON error responses.
 */

const multer = require('multer');
const { parseResume, ResumeParserError } = require('../../services/interview/resumeParserService');

const uploadResume = async (req, res) => {
  try {
    console.log('[File Upload] Received resume upload request');
    
    // Step 1: Verify file upload details
    if (!req.file) {
      console.warn('[File Upload] Verification failed: No file found in request');
      return res.status(400).json({
        error: 'Resume PDF is required',
        code: 'MISSING_FILE'
      });
    }

    console.log('[File Upload] Filename:', req.file.originalname);
    console.log('[File Upload] Mimetype:', req.file.mimetype);
    console.log('[File Upload] Size:', req.file.size, 'bytes');
    console.log('[File Upload] Buffer available:', req.file.buffer ? 'Yes' : 'No');

    // Parse the PDF buffer
    const resumeData = await parseResume(req.file.buffer);

    console.log('[File Upload] Parse succeeded, returning structured data');
    res.status(200).json(resumeData);
  } catch (error) {
    console.error('[File Upload] Resume parsing failed:', error);
    
    if (error instanceof ResumeParserError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Failed to upload and parse resume',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

const handleResumeUploadError = (error, req, res, next) => {
  if (!error) return next();

  console.error('[File Upload Error Handler] Error during file upload:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Resume PDF must be 5 MB or smaller',
        code: 'PDF_TOO_LARGE'
      });
    }

    return res.status(400).json({
      error: error.message,
      code: error.code
    });
  }

  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      error: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }

  res.status(400).json({
    error: 'Invalid resume upload',
    code: 'INVALID_UPLOAD'
  });
};

module.exports = {
  uploadResume,
  handleResumeUploadError
};
