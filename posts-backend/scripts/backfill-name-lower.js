// One-off migration: backfills User.nameLower for every existing document.
// Needed because the pre-save/pre-findOneAndUpdate hooks in user.model.js
// only fire on writes made AFTER this code is deployed — anyone who
// existed before today has no nameLower yet, and search() filters on it,
// so without this script every pre-existing user silently drops out of
// name-based search results (they'd still be found via handle).
//
// Safe to re-run — only touches documents missing nameLower.
// Usage:  node scripts/backfill-name-lower.js

const { connectDB, disconnectDB } = require("../config/database");
const logger = require("../config/logger");
const User = require("../features/users/user.model");

const BATCH_SIZE = 500;

async function run() {
  await connectDB();

  const cursor = User.find({
    $or: [{ nameLower: { $exists: false } }, { nameLower: null }],
  })
    .select("_id name")
    .cursor();

  let ops = [];
  let updated = 0;

  for await (const user of cursor) {
    if (!user.name) continue;
    ops.push({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { nameLower: user.name.toLowerCase() } },
      },
    });
    if (ops.length >= BATCH_SIZE) {
      await User.collection.bulkWrite(ops);
      updated += ops.length;
      logger.info(`Backfilled ${updated} user(s) so far...`);
      ops = [];
    }
  }
  if (ops.length) {
    await User.collection.bulkWrite(ops);
    updated += ops.length;
  }

  logger.info(`Backfill complete. Updated ${updated} user(s).`);

  await User.collection.createIndex({ nameLower: 1 });
  logger.info("Index on nameLower confirmed.");

  await disconnectDB();
}

run().catch((err) => {
  logger.error("Backfill failed", err);
  process.exit(1);
});