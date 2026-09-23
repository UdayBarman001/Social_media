// Redis client lifecycle. Unlike config/database.js (Mongo is a hard
// dependency — the app exits if it can't connect), Redis here is a pure
// performance layer: every cache read/write goes through utils/cache.js,
// which treats "no client" or "client errored" as a cache miss and falls
// through to Mongo. So this file never calls process.exit and never throws
// out of connectRedis() — it just logs and leaves `client` unusable, and
// the rest of the app keeps working exactly as if Redis were never added.

const Redis = require("ioredis");
const config = require("./env");
const logger = require("./logger");

let client = null;

function connectRedis() {
  if (client) return client;

  client = new Redis(config.redis.url, {
    // Cap reconnect attempts' backoff instead of the default unbounded
    // growth, and don't queue commands while disconnected — a queued
    // command would just delay the caller until it times out, which is
    // worse for a cache than failing fast and falling back to Mongo.
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 5000),
    enableOfflineQueue: false,
    lazyConnect: false,
  });

  client.on("connect", () => logger.info("Redis connected"));
  client.on("error", (err) => logger.warn("Redis error (continuing without cache):", err.message));
  client.on("close", () => logger.warn("Redis connection closed"));

  return client;
}

function getRedis() {
  return client;
}

async function disconnectRedis() {
  if (!client) return;
  await client.quit().catch(() => client.disconnect());
  client = null;
}

module.exports = { connectRedis, getRedis, disconnectRedis };