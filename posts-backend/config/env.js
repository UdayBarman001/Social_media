// Loads and validates environment variables in one place.
// Nothing else in the app should read `process.env` directly —
// import `config` instead so every value is centralized, typed, and defaulted.

require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config = {
  env: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT, 10) || 4000,

  clientOrigins: (process.env.CLIENT_ORIGINS || "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  mongoUri: required("MONGO_URI", "mongodb://127.0.0.1:27017/krishiverse"),

  // Signs pagination cursors (see utils/cursor.js) so a client can't hand-
  // craft a {createdAt, id} pair to range-scan outside what a real feed
  // response would ever issue. Falls back to a fixed dev secret (never
  // required) since cursors are a pagination-integrity concern, not an
  // auth boundary — losing this secret's secrecy doesn't expose private
  // data, it only means a forged cursor becomes possible again, so this
  // never throws/exits the way a real auth secret's absence would.
  cursorSecret: process.env.CURSOR_SECRET || "dev-insecure-cursor-secret",

  redis: {
    // Optional by design: if unset/unreachable, config/redis.js and
    // utils/cache.js degrade to no-op cache misses rather than crashing the
    // app — caching is a performance layer, never a hard dependency.
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    feedTtlSeconds: parseInt(process.env.REDIS_FEED_TTL_SECONDS, 10) || 30,
    postTtlSeconds: parseInt(process.env.REDIS_POST_TTL_SECONDS, 10) || 300,
    commentsTtlSeconds: parseInt(process.env.REDIS_COMMENTS_TTL_SECONDS, 10) || 60,
    followsTtlSeconds: parseInt(process.env.REDIS_FOLLOWS_TTL_SECONDS, 10) || 300,
    userTtlSeconds: parseInt(process.env.REDIS_USER_TTL_SECONDS, 10) || 300,
  },

  imagekit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  },
};

module.exports = config;