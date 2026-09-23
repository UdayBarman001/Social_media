// Enterprise Request ID Middleware
// Assigns or preserves a unique X-Request-Id for distributed tracing across logs,
// microservices, and client crash reports.

const crypto = require("crypto");

function requestId(req, res, next) {
  const existingId = req.headers["x-request-id"];
  const id = existingId && typeof existingId === "string" && existingId.trim().length > 0
    ? existingId.trim()
    : crypto.randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);

  next();
}

module.exports = requestId;
