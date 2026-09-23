// Distributed Mutation Idempotency Middleware
// Protects against duplicate writes (posts, comments) caused by mobile network
// timeouts, packet drops, or rapid double-clicks on weak rural 3G/4G connections.

const { getRedis } = require("../config/redis");
const logger = require("../config/logger");

const IDEMPOTENCY_TTL_SECONDS = 180; // 3 minutes window for mobile retries
const IN_FLIGHT_LOCK_SECONDS = 45;   // Auto-expires in-flight lock if server abruptly crashes

function idempotency(req, res, next) {
  // Only apply to state-modifying HTTP methods
  if (req.method !== "POST" && req.method !== "PATCH" && req.method !== "PUT") {
    return next();
  }

  const rawKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
  if (!rawKey || typeof rawKey !== "string" || rawKey.trim().length === 0) {
    return next();
  }

  const key = rawKey.trim();
  if (key.length < 8 || key.length > 128) {
    return res.status(400).json({
      success: false,
      message: "Invalid Idempotency-Key length (must be 8-128 characters)",
    });
  }

  const redisClient = getRedis();
  if (!redisClient || redisClient.status !== "ready") {
    // Fail-open: if Redis is unavailable, don't block user requests
    return next();
  }

  const redisKey = `idempotency:${req.baseUrl || ""}${req.path}:${key}`;

  (async () => {
    try {
      // 1. Check existing record
      const existingRaw = await redisClient.get(redisKey);
      if (existingRaw) {
        const record = JSON.parse(existingRaw);
        if (record.status === "IN_FLIGHT") {
          return res.status(409).json({
            success: false,
            message: "A request with this Idempotency-Key is already processing. Please wait.",
            inFlight: true,
          });
        }
        if (record.status === "COMPLETED") {
          res.setHeader("X-Idempotency-Replay", "true");
          return res.status(record.statusCode || 200).json(record.body);
        }
      }

      // 2. Atomically claim in-flight lock
      const lockAcquired = await redisClient.set(
        redisKey,
        JSON.stringify({ status: "IN_FLIGHT", startedAt: Date.now() }),
        "EX",
        IN_FLIGHT_LOCK_SECONDS,
        "NX"
      );

      if (lockAcquired !== "OK") {
        return res.status(409).json({
          success: false,
          message: "A concurrent request with this Idempotency-Key is in flight.",
          inFlight: true,
        });
      }

      // 3. Intercept response to cache on completion
      const originalJson = res.json.bind(res);
      res.json = function (body) {
        // Run original response
        const result = originalJson(body);

        // Store result asynchronously in Redis
        (async () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 500) {
              await redisClient.set(
                redisKey,
                JSON.stringify({
                  status: "COMPLETED",
                  statusCode: res.statusCode,
                  body,
                  completedAt: Date.now(),
                }),
                "EX",
                IDEMPOTENCY_TTL_SECONDS
              );
            } else {
              // On 5xx server failures, remove key to allow clean retry
              await redisClient.del(redisKey);
            }
          } catch (err) {
            logger.warn(`Failed to update idempotency cache for ${redisKey}:`, err.message);
          }
        })();

        return result;
      };

      next();
    } catch (err) {
      logger.warn(`Idempotency middleware error for ${redisKey}:`, err.message);
      // Fail-open
      next();
    }
  })();
}

module.exports = idempotency;
