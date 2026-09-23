// Process entry point: connects to MongoDB, then starts listening.
// Also owns graceful shutdown so in-flight requests aren't dropped on deploy.

const app = require("./app");
const config = require("./config/env");
const logger = require("./config/logger");
const { connectDB, disconnectDB } = require("./config/database");
const { connectRedis, disconnectRedis } = require("./config/redis");
const mongoose = require("mongoose");
const { ensureSearchIndex } = require("./features/posts/ensureSearchIndex");

let server;
let isShuttingDown = false;

async function start() {
  await connectDB();
  // Not awaited-for-success the way connectDB is — Redis is optional (see
  // config/redis.js), so we just kick off the connection attempt and let
  // the app start regardless of whether/when it succeeds.
  connectRedis();

  // Best-effort: makes sure the Atlas Search index post.repository.js's
  // searchPosts() wants exists, without anyone having to remember to run
  // scripts/create-posts-search-index.js by hand after every deploy —
  // that manual step being easy to forget is exactly what made posts
  // search silently return nothing/error out in practice. Deliberately
  // NOT awaited and NEVER allowed to crash startup: on a local/self-hosted
  // Mongo (this app's own MONGO_URI fallback), Atlas Search index APIs
  // don't exist at all, which is expected and fine — searchPosts() falls
  // back to a plain $regex query in that case, so the app is fully
  // functional either way. This is purely a "make the fast path available
  // when it can be" step, run in the background so it never delays the
  // server actually accepting requests.
  ensureSearchIndex(mongoose, logger).catch((err) => {
    logger.warn(`Skipping Atlas Search index setup (expected on non-Atlas Mongo): ${err.message}`);
  });

  server = app.listen(config.port, "0.0.0.0", () => {
    logger.info(`KrishiVerse API running on http://localhost:${config.port} [${config.env}]`);
  });
}

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${signal} received, shutting down gracefully...`);

  // Force termination if connections don't drain within 10 seconds
  const forceTimeout = setTimeout(() => {
    logger.error("Graceful shutdown timed out (10s), forcing process termination.");
    process.exit(1);
  }, 10000);
  forceTimeout.unref();

  if (server) {
    server.close(async () => {
      try {
        await disconnectRedis();
        await disconnectDB();
        logger.info("HTTP server and backing services closed cleanly.");
        process.exit(0);
      } catch (err) {
        logger.error("Error during teardown:", err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception:", err);
  process.exit(1);
});

start();