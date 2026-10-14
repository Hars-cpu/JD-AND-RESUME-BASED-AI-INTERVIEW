/**
 * @file requestLogger.js
 * @summary Express middleware that logs HTTP request timing and status codes.
 *          Attaches a 'finish' event listener to the response object so that once the response
 *          is sent, it logs the HTTP method, URL, status code, and total duration in ms.
 *          Only logs in non-production environments or for error responses (status >= 400).
 *
 * @functions
 * - requestLogger: Records request start time and logs method, URL, status, and duration on response finish.
 */

const requestLogger = (req, _res, next) => {
  const startedAt = Date.now();

  _res.on('finish', () => {
    const duration = Date.now() - startedAt;
    const status = _res.statusCode;

    if (status >= 400 || process.env.NODE_ENV !== 'production') {
      console.log(`${req.method} ${req.originalUrl} ${status} ${duration}ms`);
    }
  });

  next();
};

module.exports = requestLogger;
