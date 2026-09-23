// READ-ONLY check — run this BEFORE migrateRemoveTitleBodyFields.js.
//
// Reports any posts where dropping `body`/`title` would actually lose
// content, i.e. where `body` differs from `description` (not just the
// create-time default of body === description) or `body` is longer than
// the 2000-char description cap. Makes no changes to the database.
//
// Usage: node database/checkTitleBodyDataLoss.js

const logger = require("../config/logger");
const { connectDB, disconnectDB } = require("../config/database");
const Post = require("../features/posts/post.model");

async function check() {
  await connectDB();
  const collection = Post.collection;

  const withBody = await collection
    .find({ body: { $exists: true, $ne: "" } })
    .project({ title: 1, body: 1, description: 1 })
    .toArray();

  const atRisk = withBody.filter((p) => (p.body || "") !== (p.description || ""));
  const overCap = withBody.filter((p) => (p.body || "").length > 2000);
  const withTitle = await collection.countDocuments({ title: { $exists: true, $ne: null } });

  logger.info(`Posts with a non-empty body field: ${withBody.length}`);
  logger.info(`Posts with a title set: ${withTitle}`);
  logger.info(`Posts where body != description (content would be lost): ${atRisk.length}`);
  logger.info(`Posts where body exceeds 2000 chars (over description's cap): ${overCap.length}`);

  if (atRisk.length > 0) {
    logger.warn("Sample at-risk post IDs (first 10):");
    atRisk.slice(0, 10).forEach((p) => logger.warn(`  ${p._id}`));
  }

  await disconnectDB();
  process.exit(0);
}

check().catch((err) => {
  logger.error("Check failed", err);
  process.exit(1);
});
