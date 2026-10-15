/**
 * @file jdController.js
 * @summary Controller for handling Job Description (JD) PDF file uploads.
 *          Receives a PDF file via multer, passes the binary buffer to the JD parser service
 *          which uses an AI model to extract role title, required skills, and technologies,
 *          and returns the structured JSON to the frontend.
 *
 * @functions
 * - uploadJd: Validates the uploaded PDF file, calls parseJd() on the buffer, and returns structured JD data.
 * - handleJdUploadError: Express error-handling middleware that normalizes multer and file-type errors
 *                        into consistent JSON error responses.
 */

const { parseJd, JdParserError } = require('../../services/interview/jdParserService');

const uploadJd = async (req, res) => {
  try {
    console.log('[JD File Upload] Received JD upload request');
    
    // Step 1: Verify file upload details
    if (!req.file) {
      console.warn('[JD File Upload] Verification failed: No file found in request');
      return res.status(400).json({
        error: 'Job Description PDF is required',
        code: 'MISSING_FILE'
      });
    }

    console.log('[JD File Upload] Filename:', req.file.originalname);
    console.log('[JD File Upload] Mimetype:', req.file.mimetype);
    console.log('[JD File Upload] Size:', req.file.size, 'bytes');
    console.log('[JD File Upload] Buffer available:', req.file.buffer ? 'Yes' : 'No');

    // Parse the PDF buffer
    const jdData = await parseJd(req.file.buffer);

    console.log('[JD File Upload] Parse succeeded, returning structured data');
    res.status(200).json(jdData);
  } catch (error) {
    console.error('[JD File Upload] Job description parsing failed:', error);
    
    if (error instanceof JdParserError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Failed to upload and parse job description',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

const handleJdUploadError = (error, req, res, next) => {
  if (!error) return next();

  console.error('[JD File Upload Error Handler] Error during file upload:', error);

  const multer = require('multer');
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Job Description PDF must be 5 MB or smaller',
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
    error: 'Invalid job description upload',
    code: 'INVALID_UPLOAD'
  });
};

module.exports = {
  uploadJd,
  handleJdUploadError
};
