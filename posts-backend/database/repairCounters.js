const { connectDB, disconnectDB } = require("../config/database");
const Post = require("../features/posts/post.model");
const Comment = require("../features/comments/comment.model");
const Like = require("../features/likes/like.model");
const redis = require("../config/redis");
const logger = require("../config/logger");

async function repairCounters() {
  await connectDB();
  logger.info("Starting counter repair migration...");

  // 1. Repair Posts
  const posts = await Post.find({});
  let repairedPosts = 0;

  for (const post of posts) {
    const trueLikes = await Like.countDocuments({ targetType: "Post", targetId: post._id });
    if (post.likeCount < 0 || post.likeCount !== trueLikes) {
      logger.info(`Fixing post ${post._id}: likeCount was ${post.likeCount} -> setting to ${trueLikes}`);
      await Post.updateOne({ _id: post._id }, { $set: { likeCount: trueLikes } });
      repairedPosts++;
    }
  }

  // 2. Repair Comments
  const comments = await Comment.find({});
  let repairedComments = 0;

  for (const comment of comments) {
    const trueLikes = await Like.countDocuments({ targetType: "Comment", targetId: comment._id, type: "like" });
    const trueDislikes = await Like.countDocuments({ targetType: "Comment", targetId: comment._id, type: "dislike" });
    const needsFix = comment.likeCount < 0 || comment.dislikeCount < 0 ||
                     comment.likeCount !== trueLikes || comment.dislikeCount !== trueDislikes;

    if (needsFix) {
      logger.info(
        `Fixing comment ${comment._id}: likeCount ${comment.likeCount}->${trueLikes}, dislikeCount ${comment.dislikeCount}->${trueDislikes}`
      );
      await Comment.updateOne(
        { _id: comment._id },
        { $set: { likeCount: trueLikes, dislikeCount: trueDislikes } }
      );
      repairedComments++;
    }
  }

  // 3. Invalidate Redis cache keys if redis is active
  if (redis) {
    try {
      const keys = await redis.keys("cache:*");
      if (keys.length > 0) {
        await redis.del(keys);
        logger.info(`Flushed ${keys.length} cache keys`);
      }
    } catch (err) {
      logger.warn("Could not flush redis cache:", err.message);
    }
  }

  logger.info(`Repair complete! Repaired ${repairedPosts} posts and ${repairedComments} comments.`);
  await disconnectDB();
  process.exit(0);
}

repairCounters().catch((err) => {
  logger.error("Repair failed:", err);
  process.exit(1);
});
