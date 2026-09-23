// Rate limiters. `generalLimiter` applies to the whole API; `authLimiter` is
// stricter and applied only to sensitive auth endpoints (login/register/reset)
// to slow down brute-force and credential-stuffing attempts.

const rateLimit = require("express-rate-limit");
const config = require("../config/env");

const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later.", errors: [] },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, please try again later.", errors: [] },
});

module.exports = { generalLimiter, authLimiter };
