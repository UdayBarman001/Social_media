const Comment = require("./comment.model");

// `author` is a real ObjectId ref to User — reads populate it down to the
// display fields comment.service.js#toClientComment needs.
const AUTHOR_POPULATE = { path: "author", select: "name avatarUrl verified" };

function findByPost(postId, { skip, limit }) {
  return Comment.find({ post: postId })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit)
    .populate(AUTHOR_POPULATE)
    .lean();
}

function countByPost(postId) {
  return Comment.countDocuments({ post: postId });
}

function findById(id) {
  return Comment.findById(id);
}

async function create(data) {
  const comment = await Comment.create(data);
  return comment.populate(AUTHOR_POPULATE);
}

function deleteById(id, session) {
  const q = Comment.findByIdAndDelete(id);
  if (session) q.session(session);
  return q;
}

// All comment ids belonging to a post — used by post.service.js#deletePost
// to cascade-delete the post's Like/Report rows before the comments
// themselves are removed by deleteByPost.
function findIdsByPost(postId) {
  return Comment.find({ post: postId }).select("_id").lean();
}

// Removes every comment on a post in one query — called when the post
// itself is deleted, so no comment is left pointing at a nonexistent post.
function deleteByPost(postId, session) {
  const q = Comment.deleteMany({ post: postId });
  if (session) q.session(session);
  return q;
}

// Direct replies to a comment (one level deep — see the schema comment
// above). Used by comment.service.js#deleteComment to cascade-delete a
// comment's own replies instead of leaving them pointing at a deleted
// parentComment.
function findReplyIds(commentId) {
  return Comment.find({ parentComment: commentId }).select("_id").lean();
}

function deleteReplies(commentId, session) {
  const q = Comment.deleteMany({ parentComment: commentId });
  if (session) q.session(session);
  return q;
}

function incrementLikeCount(id, delta) {
  return Comment.findByIdAndUpdate(
    id,
    [
      {
        $set: {
          likeCount: {
            $max: [0, { $add: [{ $ifNull: ["$likeCount", 0] }, delta] }],
          },
        },
      },
    ],
    { new: true }
  ).lean();
}

// Adjusts likeCount and dislikeCount together in one atomic update — clamped to >= 0
function incrementReactionCounts(id, { likeCount = 0, dislikeCount = 0 } = {}) {
  return Comment.findByIdAndUpdate(
    id,
    [
      {
        $set: {
          likeCount: {
            $max: [0, { $add: [{ $ifNull: ["$likeCount", 0] }, likeCount] }],
          },
          dislikeCount: {
            $max: [0, { $add: [{ $ifNull: ["$dislikeCount", 0] }, dislikeCount] }],
          },
        },
      },
    ],
    { new: true }
  )
    .populate(AUTHOR_POPULATE)
    .lean();
}

function updateText(id, text) {
  return Comment.findByIdAndUpdate(
    id,
    { text, editedAt: new Date() },
    { new: true }
  ).populate(AUTHOR_POPULATE);
}

module.exports = {
  findByPost,
  countByPost,
  findById,
  create,
  deleteById,
  findIdsByPost,
  deleteByPost,
  findReplyIds,
  deleteReplies,
  incrementLikeCount,
  incrementReactionCounts,
  updateText,
};