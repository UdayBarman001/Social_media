// One-off migration: recomputes User.followerCount / followingCount /
// postCount for every existing user from the source-of-truth collections
// (Follow, Post).
//
// These three fields were never written by application code before this
// fix — follow.service.js#follow/unfollow and post.service.js#createPost/
// deletePost only touched the Follow/Post collections directly, so every
// existing user's counters are stuck at whatever database/seed.js (or
// nothing) set them to, regardless of their real follow/post activity.
// This script makes the stored numbers match reality once; going forward
// the app keeps them in sync incrementally via userRepository.incrementCounts.
//
// Safe to re-run — recomputes and overwrites unconditionally.
// Usage:  node scripts/backfill-user-counts.js

const { connectDB, disconnectDB } = require("../config/database");
const logger = require("../config/logger");
const User = require("../features/users/user.model");
const Follow = require("../features/follows/follow.model");
const Post = require("../features/posts/post.model");

const BATCH_SIZE = 500;

async function run() {
  await connectDB();

  const [followerCounts, followingCounts, postCounts] = await Promise.all([
    Follow.aggregate([{ $group: { _id: "$following", count: { $sum: 1 } } }]),
    Follow.aggregate([{ $group: { _id: "$follower", count: { $sum: 1 } } }]),
    Post.aggregate([{ $group: { _id: "$author", count: { $sum: 1 } } }]),
  ]);

  const followerMap = new Map(followerCounts.map((r) => [r._id.toString(), r.count]));
  const followingMap = new Map(followingCounts.map((r) => [r._id.toString(), r.count]));
  const postMap = new Map(postCounts.map((r) => [r._id.toString(), r.count]));

  const cursor = User.find().select("_id").cursor();

  let ops = [];
  let updated = 0;

  for await (const user of cursor) {
    const id = user._id.toString();
    ops.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            followerCount: followerMap.get(id) || 0,
            followingCount: followingMap.get(id) || 0,
            postCount: postMap.get(id) || 0,
          },
        },
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

  logger.info(`Backfill complete. Recomputed counts for ${updated} user(s).`);

  await disconnectDB();
}

run().catch((err) => {
  logger.error("Backfill failed", err);
  process.exit(1);
});