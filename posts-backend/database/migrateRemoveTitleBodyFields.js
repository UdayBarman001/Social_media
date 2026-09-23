// One-off migration: `title` and `body` have been removed from the Post
// schema (see post.model.js). `body` was always just a duplicate of
// `description` on every post (post.service.js set body = description at
// creation), and `title` is no longer used anywhere in the app. Mongoose
// doesn't rewrite existing documents when fields are dropped from the
// schema, so old docs still carry both fields in Mongo — this unsets them.
//
// Safe to run multiple times — posts with neither field are skipped.
//
// Usage: node database/migrateRemoveTitleBodyFields.js

const logger = require("../config/logger");
const { connectDB, disconnectDB } = require("../config/database");
const Post = require("../features/posts/post.model");

async function migrate() {
  await connectDB();

  // Use the raw collection, not the Mongoose model — the model no longer
  // declares `title`/`body`, so there's nothing to cast through anyway;
  // going raw keeps this migration independent of future schema changes.
  const collection = Post.collection;

  const result = await collection.updateMany(
    { $or: [{ title: { $exists: true } }, { body: { $exists: true } }] },
    { $unset: { title: "", body: "" } },
  );

  logger.info(
    `Migration complete. Matched: ${result.matchedCount}, modified: ${result.modifiedCount}.`,
  );
  await disconnectDB();
  process.exit(0);
}

migrate().catch((err) => {
  logger.error("Migration failed", err);
  process.exit(1);
});
