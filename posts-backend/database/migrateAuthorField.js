// One-off migration: some posts were created before the backend redesign,
// when `author` was stored as a nested object ({ id, name, handle,
// avatarUrl }) instead of the plain string the current schema/services
// expect (see post.model.js — `author: { type: String }`). Those old docs
// still have the object shape in Mongo since Mongoose doesn't rewrite
// existing documents when a schema changes.
//
// This script finds every post whose `author` field is still an object and
// flattens it to a single string (preferring name, since that's what the
// app currently uses as the display-name "userId"), then unsets the leftover
// nested shape. Safe to run multiple times — posts already migrated (author
// already a string) are skipped.
//
// Usage: node database/migrateAuthorField.js

const config = require("../config/env");
const logger = require("../config/logger");
const { connectDB, disconnectDB } = require("../config/database");
const Post = require("../features/posts/post.model");

async function migrate() {
  await connectDB();

  // Query via the raw collection, not the Mongoose model — the model now
  // types `author` as String, so Mongoose would try (and fail) to cast the
  // legacy object documents on the way out if we queried through Post.find().
  const collection = Post.collection;

  const legacyPosts = await collection
    .find({ author: { $type: "object" } })
    .toArray();

  logger.info(`Found ${legacyPosts.length} post(s) with a legacy object author.`);

  let migrated = 0;
  let skipped = 0;

  for (const post of legacyPosts) {
    const legacyAuthor = post.author || {};
    const flattened =
      legacyAuthor.name || legacyAuthor.handle || legacyAuthor.id || null;

    if (!flattened) {
      logger.warn(`Post ${post._id} has no usable name/handle/id on its author object — skipping.`);
      skipped++;
      continue;
    }

    await collection.updateOne(
      { _id: post._id },
      { $set: { author: String(flattened) } },
    );
    migrated++;
  }

  logger.info(`Migration complete. Migrated: ${migrated}, skipped: ${skipped}.`);
  await disconnectDB();
  process.exit(0);
}

migrate().catch((err) => {
  logger.error("Migration failed", err);
  process.exit(1);
});