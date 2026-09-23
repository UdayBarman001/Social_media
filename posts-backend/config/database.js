// MongoDB connection lifecycle. Kept separate from server.js so tests /
// scripts (seed.js, migrations) can import and reuse the same connection logic.

const mongoose = require("mongoose");
const config = require("./env");
const logger = require("./logger");

mongoose.set("strictQuery", true);

async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri, {
      // M0 (free-tier) Atlas clusters throttle/park idle connections more
      // aggressively than dedicated tiers, which is what was producing the
      // "MongoDB disconnected" cycles + multi-second request spikes right
      // after each one. These options don't stop Atlas from parking the
      // connection, but they make Mongoose notice and recover faster
      // instead of hanging on a dead socket until its long default timeout.
      serverSelectionTimeoutMS: 10000, // fail fast to reconnect instead of hanging (default 30s)
      socketTimeoutMS: 20000, // kill a stalled socket instead of leaving it half-open
      maxPoolSize: 10, // free-tier clusters cap total connections; keep the pool modest
      minPoolSize: 1, // keep at least one warm connection instead of fully idling out
    });
    logger.info(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    logger.error("MongoDB connection failed", err);
    process.exit(1);
  }
}

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected");
});

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };