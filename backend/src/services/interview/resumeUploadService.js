/**
 * @file resumeUploadService.js
 * @summary Multer configuration for resume PDF uploads.
 *          Uses memory storage so the file buffer is available in-memory for the resume parser,
 *          enforces a 5 MB size limit, and rejects non-PDF files by MIME type and extension.
 *
 * @functions
 * - pdfFileFilter: Multer file filter that allows only files with PDF MIME type and .pdf extension.
 */

const multer = require('multer');

const MAX_RESUME_SIZE = 5 * 1024 * 1024;

const storage = multer.memoryStorage();

const pdfFileFilter = (req, file, cb) => {
  const hasPdfMimeType = file.mimetype === 'application/pdf';
  const hasPdfExtension = /\.pdf$/i.test(file.originalname || '');

  if (!hasPdfMimeType || !hasPdfExtension) {
    return cb(new Error('Only PDF files are allowed'));
  }

  cb(null, true);
};

const resumeUploadService = multer({
  storage,
  limits: {
    fileSize: MAX_RESUME_SIZE
  },
  fileFilter: pdfFileFilter
});

module.exports = {
  resumeUploadService,
  MAX_RESUME_SIZE
};
