// Single centralized error handler — the last middleware in app.js.
// No route/controller should send its own error response; throw ApiError
// (or let mongoose errors bubble) and this converts them consistently.

const multer = require("multer");
const config = require("../config/env");
const logger = require("../config/logger");
const ApiError = require("../utils/ApiError");

// Multer's own error codes, mapped to messages a mobile client can show
// as-is. Without this, any upload limit breach (too many files, file too
// big, wrong field name) fell through to the generic
// `ApiError.internal("Internal server error")` branch below — a 500 for
// what is really a 400-level client mistake, with no indication of what
// actually went wrong.
const MULTER_ERROR_MESSAGES = {
  LIMIT_FILE_SIZE: "Each image must be under 10MB",
  LIMIT_FILE_COUNT: "A post can have at most 6 images",
  LIMIT_UNEXPECTED_FILE: "Too many images, or an unexpected upload field",
};

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  // Normalize known non-ApiError errors into ApiError shape
  if (!(error instanceof ApiError)) {
    if (error instanceof multer.MulterError) {
      error = ApiError.badRequest(MULTER_ERROR_MESSAGES[error.code] || "File upload failed");
    } else if (error.name === "ValidationError") {
      // Mongoose schema validation
      const messages = Object.values(error.errors || {}).map((e) => e.message);
      error = ApiError.badRequest("Validation failed", messages);
    } else if (error.name === "CastError") {
      error = ApiError.badRequest(`Invalid ${error.path}: ${error.value}`);
    } else if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || "field";
      error = ApiError.conflict(`${field} already in use`);
    } else {
      error = ApiError.internal(config.isProduction ? "Internal server error" : error.message);
    }
  }

  if (error.statusCode >= 500) {
    logger.error(`[Request ${req.id || "unknown"}]`, err);
  }

  const response = {
    success: false,
    message: error.message,
    errors: error.errors || [],
    ...(req.id ? { requestId: req.id } : {}),
  };

  // Never leak stack traces in production
  if (!config.isProduction) {
    response.stack = err.stack;
  }

  res.status(error.statusCode || 500).json(response);
}

module.exports = { errorHandler, notFoundHandler };