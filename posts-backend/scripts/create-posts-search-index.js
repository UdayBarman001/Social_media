// One-time / CI setup: creates the Atlas Search index post.repository.js's
// searchPosts() uses. Safe to run repeatedly (checks for the index first).
// server.js also runs this same logic automatically on every boot as a
// best-effort step — this script exists for CI/deploy pipelines that want
// an explicit, fail-loud step instead of a background best-effort one, and
// for manually (re)creating the index on demand.
//
// Requires an actual Atlas cluster — fails against a local `mongod` (the
// MONGO_URI fallback in config/env.js). Point MONGO_URI at Atlas first.
//
// Usage:  node scripts/create-posts-search-index.js

const mongoose = require("mongoose");
const { connectDB, disconnectDB } = require("../config/database");
const logger = require("../config/logger");
const { ensureSearchIndex } = require("../features/posts/ensureSearchIndex");

async function run() {
  await connectDB();
  await ensureSearchIndex(mongoose, logger);
  await disconnectDB();
}

run().catch((err) => {
  logger.error("Search index creation failed", err);
  process.exit(1);
});