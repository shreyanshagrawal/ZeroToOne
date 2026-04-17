/**
 * Standardized Application Error
 * Allows capturing HTTP status codes and cleanly passing them to the error middleware
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Set to distinguish from unhandled bugs

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
