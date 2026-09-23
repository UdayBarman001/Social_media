// Business logic for comments. Keeps Post.commentCount in sync via
// post.repository so the feed's denormalized counter never drifts.

const commentRepository = require("./comment.repository");
const postRepository = require("../posts/post.repository");
const postService = require("../posts/post.service");
const likeRepository = require("../likes/like.repository");
const reportRepository = require("../reports/report.repository");
const notificationService = require("../notifications/notification.service");
const ApiError = require("../../utils/ApiError");
const cache = require("../../utils/cache");
const config = require("../../config/env");
const { getPagination, buildMeta } = require("../../utils/pagination");
const { NOTIFICATION_TYPE, TARGET_TYPE } = require("../../constants");
const { withTransaction } = require("../../utils/transaction");

// First page only — same reasoning as the feed's cache: comment sheets are
// opened repeatedly on popular posts, and it's the first page that's read
// far more than it's written. Later pages are one-off enough not to bother.
const commentsCacheKey = (postId) => `cache:comments:${postId}:page1`;

async function invalidateCommentsCache(postId) {
  await cache.del(commentsCacheKey(postId));
}

function toClientComment(comment) {
  // `author` may be populated (an object with .name) or not, same pattern
  // as post.service.js#toClientPost — handle both so callers never need to
  // know which query path produced this comment.
  const authorPopulated = comment.author && typeof comment.author === "object" && comment.author.name !== undefined;
  return {
    id: comment._id.toString(),
    author: authorPopulated ? comment.author._id.toString() : (comment.author ? comment.author.toString() : ""),
    authorName: authorPopulated ? comment.author.name : undefined,
    authorAvatar: authorPopulated ? comment.author.avatarUrl : undefined,
    authorVerified: authorPopulated ? comment.author.verified : undefined,
    text: comment.text,
    likeCount: Math.max(0, comment.likeCount ?? 0),
    dislikeCount: Math.max(0, comment.dislikeCount ?? 0),
    editedAt: comment.editedAt ?? null,
    parentComment: comment.parentComment ? comment.parentComment.toString() : null,
    createdAt: comment.createdAt,
  };
}

async function listComments(postId, query) {
  const pagination = getPagination(query);
  const isCacheableRequest = pagination.page === 1;
  const cacheKey = commentsCacheKey(postId);

  if (isCacheableRequest) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const post = await postRepository.findById(postId);
  if (!post) throw ApiError.notFound("Post not found");

  const [comments, total] = await Promise.all([
    commentRepository.findByPost(postId, pagination),
    commentRepository.countByPost(postId),
  ]);

  const result = { comments: comments.map(toClientComment), meta: buildMeta({ ...pagination, total }) };

  if (isCacheableRequest) {
    await cache.set(cacheKey, result, config.redis.commentsTtlSeconds);
  }

  return result;
}

async function addComment(userId, postId, { text, parentComment }) {
  const post = await postRepository.findById(postId);
  if (!post) throw ApiError.notFound("Post not found");

  if (parentComment) {
    const parent = await commentRepository.findById(parentComment);
    if (!parent || parent.post.toString() !== postId) {
      throw ApiError.badRequest("Parent comment not found on this post");
    }
  }

  const comment = await commentRepository.create({ post: postId, author: userId, text, parentComment: parentComment || null });
  await postRepository.incrementCommentCount(postId, 1);
  // commentCount changed on the post (denormalized counter) and the
  // comment itself was added — three cached views are now stale, not two:
  // this single post's own cache, its comments list, AND the cached feed
  // page 1 (cache:feed:page1), which embeds every post's commentCount
  // inline (see post.service.js#toClientPost). Missing invalidateFeedCache()
  // here meant a comment on a post already sitting in the page-1 feed
  // cache kept showing its stale pre-comment count on the home feed until
  // the cache's TTL expired, even though the post-detail screen (reading
  // the just-invalidated post cache) showed the correct number.
  await postService.invalidatePostCache(postId);
  await postService.invalidateFeedCache();
  await invalidateCommentsCache(postId);

  notificationService.notify({
    // post.author is populated (postRepository.findById uses
    // .populate(AUTHOR_POPULATE)), so it's an object here, not a string —
    // unwrap to the id the Notification model expects.
    recipient: post.author._id ? post.author._id.toString() : post.author.toString(),
    sender: userId,
    type: NOTIFICATION_TYPE.COMMENT,
    post: postId,
    comment: comment._id,
  });

  return toClientComment(comment);
}

async function deleteComment(userId, postId, commentId) {
  const comment = await commentRepository.findById(commentId);
  if (!comment || comment.post.toString() !== postId) throw ApiError.notFound("Comment not found");
  if (comment.author.toString() !== userId) throw ApiError.forbidden("You can only delete your own comments");

  // Cascade-delete this comment's own replies (one level deep — see
  // comment.model.js) plus every Like/Report on the comment AND its
  // replies, so nothing is left pointing at a deleted comment.
  const replyDocs = await commentRepository.findReplyIds(commentId);
  const replyIds = replyDocs.map((r) => r._id);
  const targetIds = [commentId, ...replyIds];

  await withTransaction(async (session) => {
    await Promise.all([
      commentRepository.deleteReplies(commentId, session),
      likeRepository.deleteByTargets(TARGET_TYPE.COMMENT, targetIds, session),
      reportRepository.deleteByTargets(TARGET_TYPE.COMMENT, targetIds, session),
      notificationService.deleteForComments(targetIds, session),
    ]);
    await commentRepository.deleteById(commentId, session);

    // Post.commentCount was incremented by 1 for every one of these rows
    // when it was created (addComment doesn't distinguish top-level vs.
    // reply), so it has to be decremented by the same total here: the
    // comment itself plus each reply removed with it.
    await postRepository.incrementCommentCount(postId, -(1 + replyIds.length));
  });

  await postService.invalidatePostCache(postId);
  // Same reasoning as addComment above — the cached feed page also embeds
  // this post's commentCount and goes stale without this.
  await postService.invalidateFeedCache();
  await invalidateCommentsCache(postId);
}

// Author-only, same ownership check as deleteComment. Sets editedAt so the
// client can show an "edited" indicator (Facebook-style) without needing
// to separately diff old vs. new text.
async function updateComment(userId, postId, commentId, text) {
  const comment = await commentRepository.findById(commentId);
  if (!comment || comment.post.toString() !== postId) throw ApiError.notFound("Comment not found");
  if (comment.author.toString() !== userId) throw ApiError.forbidden("You can only edit your own comments");

  const updated = await commentRepository.updateText(commentId, text);
  await invalidateCommentsCache(postId);
  return toClientComment(updated);
}

module.exports = {
  listComments,
  addComment,
  deleteComment,
  updateComment,
  toClientComment,
  invalidateCommentsCache,
};