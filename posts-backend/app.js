// Express app configuration: middleware pipeline + route mounting.
// No `app.listen()` here — that lives in server.js so app.js can be
// imported by tests without opening a real network port.

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");

const config = require("./config/env");
const logger = require("./config/logger");
const routes = require("./routes");
const healthRoutes = require("./routes/health.routes");
const requestId = require("./middleware/requestId");
const idempotency = require("./middleware/idempotency");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { generalLimiter } = require("./middleware/rateLimiter");

const app = express();

app.set("trust proxy", 1);

// ── Distributed Tracing ──────────────────────────────────────────────────
app.use(requestId);

// ── Security ─────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigins.includes("*") ? true : config.clientOrigins,
    credentials: true,
  })
);
app.use(mongoSanitize()); // strips $/. keys from req.body/query/params to prevent Mongo operator injection

// ── Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());
app.use(compression());

// ── Logging (development only) ──────────────────────────────────────────
if (!config.isProduction) {
  morgan.token("req-id", (req) => req.id ? `[${req.id.slice(0, 8)}]` : "");
  app.use(morgan(":req-id :method :url :status :response-time ms - :res[content-length]"));
}

// ── Health Probes (Docker / Kubernetes Root Probes) ──────────────────────
app.use("/health", healthRoutes);

// ── Rate limiting & Idempotency ──────────────────────────────────────────
app.use("/api", generalLimiter);
app.use("/api", idempotency);

// ── Routes ───────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ success: true, message: "KrishiVerse API", data: { status: "ok" } }));
app.use("/api/v1", routes);

// ── Error handling (must be last) ───────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
