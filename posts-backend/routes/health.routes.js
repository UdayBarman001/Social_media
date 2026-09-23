// Enterprise Health Probes (Liveness & Readiness)
// Compliant with Kubernetes / Docker / AWS ALB health checking specifications.

const express = require("express");
const mongoose = require("mongoose");
const { getRedis } = require("../config/redis");
const ApiResponse = require("../utils/ApiResponse");

const router = express.Router();

// ── Liveness Probe ─────────────────────────────────────────────────────────
// Answers: "Is this Node.js process alive and able to process HTTP requests?"
// If this fails, the container orchestrator restarts the pod/container.
router.get("/live", (req, res) => {
  return ApiResponse.success(res, {
    statusCode: 200,
    message: "Process is alive",
    data: {
      status: "alive",
      uptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid,
      memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      timestamp: new Date().toISOString(),
    },
  });
});

// ── Readiness Probe ────────────────────────────────────────────────────────
// Answers: "Are critical backing dependencies (MongoDB, Redis) reachable?"
// If this fails, the load balancer stops routing traffic to this instance.
router.get("/ready", async (req, res) => {
  const checks = {
    mongo: { status: "unknown" },
    redis: { status: "unknown" },
  };

  let allHealthy = true;

  // 1. Check MongoDB
  try {
    const mongoState = mongoose.connection.readyState;
    // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (mongoState === 1 && mongoose.connection.db) {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      checks.mongo = {
        status: "connected",
        latencyMs: Date.now() - start,
        host: mongoose.connection.host || "cluster",
      };
    } else {
      allHealthy = false;
      checks.mongo = {
        status: mongoState === 2 ? "connecting" : "disconnected",
        readyState: mongoState,
      };
    }
  } catch (err) {
    allHealthy = false;
    checks.mongo = {
      status: "error",
      error: err.message,
    };
  }

  // 2. Check Redis (gracefully optional)
  const redisClient = getRedis();
  if (redisClient && redisClient.status === "ready") {
    try {
      const start = Date.now();
      await redisClient.ping();
      checks.redis = {
        status: "ready",
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      checks.redis = {
        status: "degraded",
        error: err.message,
      };
    }
  } else {
    checks.redis = {
      status: redisClient ? redisClient.status : "disabled_or_unavailable",
    };
  }

  const statusCode = allHealthy ? 200 : 503;
  const message = allHealthy
    ? "Service is healthy and ready to accept traffic"
    : "Service is degraded: backing dependencies unavailable";

  return res.status(statusCode).json({
    success: allHealthy,
    message,
    data: {
      status: allHealthy ? "ready" : "unhealthy",
      timestamp: new Date().toISOString(),
      dependencies: checks,
    },
  });
});

// Default /health points to readiness
router.get("/", (req, res, next) => {
  req.url = "/ready";
  router.handle(req, res, next);
});

module.exports = router;
