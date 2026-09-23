// Toggling a like is idempotent from the client's point of view: `like()`
// is safe to call even if already liked (no-op), `unlike()` likewise. The
// target's denormalized counter (Post.likeCount / Comment.likeCount) is
// incremented/decremented only when the Like row actually changes.

const likeRepository = require("./like.repository");
const postRepository = require("../posts/post.repository");
const commentRepository = require("../comments/comment.repository");
const postService = require("../posts/post.service");
const commentService = require("../comments/comment.service");
const notificationService = require("../notifications/notification.service");
const ApiError = require("../../utils/ApiError");
const { TARGET_TYPE, NOTIFICATION_TYPE } = require("../../constants");

// A like changes a likeCount that's embedded in cached reads elsewhere:
// - POST target: cache:post:<id> AND cache:feed:page1 (feed embeds likeCount)
// - COMMENT target: the comment's parent post's cache:post:<id> (post detail
//   embeds comment previews with their own likeCount in some clients) —
//   invalidated via updated.post, same as comment.service.js does on add/delete —
//   AND the comments list cache (cache:comments:<postId>:page1), which is
//   where the comment's own likeCount is actually served from. Missing this
//   meant a liked comment's count kept resetting to the stale cached value
//   on the very next comments fetch (e.g. reopening the comment sheet).
async function invalidateCachesFor(targetType, targetId, updated) {
  if (targetType === TARGET_TYPE.POST) {
    await Promise.all([postService.invalidatePostCache(targetId), postService.invalidateFeedCache()]);
  } else {
    const parentPostId = updated?.post;
    if (parentPostId) {
      await Promise.all([
        postService.invalidatePostCache(parentPostId),
        commentService.invalidateCommentsCache(parentPostId),
      ]);
    }
  }
}

function repoFor(targetType) {
  return targetType === TARGET_TYPE.POST ? postRepository : commentRepository;
}

function counterField() {
  // Both repos expose the same method name for their like-count counter,
  // so this never actually varies by targetType. Kept as a function (not a
  // literal) so `repoFor(targetType)[counterField()]` reads the same way
  // at both call sites, and so a future repo with a differently-named
  // counter method has one place to add a real branch.
  return "incrementLikeCount";
}

async function likeTarget(userId, targetType, targetId) {
  // createLikeIfAbsent is atomic (see like.repository.js) — a double-tap
  // that fires two of these concurrently is now guaranteed to have exactly
  // one `created: true`, so the counter below is only ever incremented
  // once. The previous find-then-create version had a race window where
  // both requests could pass "not liked yet" before either wrote, hitting
  // the DB's unique index and surfacing as a client-facing 409.
  const { created } = await likeRepository.createLikeIfAbsent(userId, targetType, targetId);
  if (!created) {
    return getCurrentCount(targetType, targetId); // already liked (by this call or a concurrent one), no-op
  }
  const updated = await repoFor(targetType)[counterField()](targetId, 1);
  if (!updated) throw ApiError.notFound(`${targetType} not found`);
  await invalidateCachesFor(targetType, targetId, updated);

  // Post and Comment both expose `.author` on the same field name, so this
  // doesn't currently vary by targetType — but it's a genuine read of that
  // target's owner in each case (not a copy-paste artifact like the old
  // ternary here used to look like), so it's kept explicit rather than
  // collapsed to a bare `updated.author`, in case the two schemas' owner
  // field names ever diverge.
  // updated.author is populated (both repos' counter methods run
  // .populate(AUTHOR_POPULATE)), so it's an object here, not a string —
  // unwrap to the id the Notification model expects.
  const ownerId = updated.author._id ? updated.author._id.toString() : updated.author.toString();
  notificationService.notify({
    recipient: ownerId,
    sender: userId,
    type: NOTIFICATION_TYPE.LIKE,
    post: targetType === TARGET_TYPE.POST ? targetId : updated.post,
    comment: targetType === TARGET_TYPE.COMMENT ? targetId : undefined,
  });

  return extractCount(targetType, updated);
}

async function unlikeTarget(userId, targetType, targetId) {
  const existing = await likeRepository.deleteLike(userId, targetType, targetId);
  if (!existing) {
    return getCurrentCount(targetType, targetId); // wasn't liked, no-op
  }
  const updated = await repoFor(targetType)[counterField()](targetId, -1);
  if (!updated) throw ApiError.notFound(`${targetType} not found`);
  await invalidateCachesFor(targetType, targetId, updated);
  return extractCount(targetType, updated);
}

async function getCurrentCount(targetType, targetId) {
  const target =
    targetType === TARGET_TYPE.POST
      ? await postRepository.findById(targetId)
      : await commentRepository.findById(targetId);
  if (!target) throw ApiError.notFound(`${targetType} not found`);
  return extractCount(targetType, target);
}

function extractCount(targetType, target) {
  const count = Math.max(0, target.likeCount ?? 0);
  return targetType === TARGET_TYPE.POST ? { likeCount: count } : { likes: count };
}

// Posts a given user has liked, most-recent-like first. Backs the profile
// screen's "Likes" tab.
async function listLikedPosts(userId, pagination) {
  const rows = await likeRepository.findLikedTargetIds(userId, TARGET_TYPE.POST, pagination);
  const ids = rows.map((r) => r.targetId);
  if (ids.length === 0) return [];

  const posts = await postRepository.findByIds(ids);
  const orderIndex = new Map(ids.map((id, i) => [id.toString(), i]));
  return posts.sort(
    (a, b) => orderIndex.get(a._id.toString()) - orderIndex.get(b._id.toString())
  );
}

// Bulk "which post ids has this user liked" — ids only, no post population.
// Mirrors follow.service.js#listFollowing exactly (same pagination-defaults
// shape, no caching — this is a per-user, launch-time sync call, not a
// shared/hot read like the feed or a public profile's follow lists).
// Powers FeedContext's loadUserState, alongside fetchBookmarkedIds/
// fetchFollowingIds, so likedIds reflects server truth on every app
// launch instead of only ever being derived from local AsyncStorage.
async function listLikedIds(userId, pagination) {
  const rows = await likeRepository.findLikedTargetIds(userId, TARGET_TYPE.POST, pagination);
  return rows.map((r) => r.targetId.toString());
}

// ── Comment thumbs up/down ──────────────────────────────────────────────
// Deliberately separate from likeTarget/unlikeTarget above: those two are
// shared with Post likes (a plain boolean like, no dislike concept), and
// entangling that shared path with reaction-type-switching logic would
// risk the post-like flow for a feature posts don't even use. These two
// functions only ever touch COMMENT-targeted Like rows.

function commentReactionCacheBust(commentPostId) {
  return Promise.all([
    postService.invalidatePostCache(commentPostId),
    commentService.invalidateCommentsCache(commentPostId),
  ]);
}

function extractCommentReaction(comment) {
  return {
    likeCount: Math.max(0, comment.likeCount ?? 0),
    dislikeCount: Math.max(0, comment.dislikeCount ?? 0),
  };
}

// type: 'like' | 'dislike'. Three cases:
//  - no existing reaction from this user -> create one, bump that side's counter
//  - existing reaction already the same type -> no-op (idempotent, same as
//    likeTarget's existing-like no-op above)
//  - existing reaction is the *other* type -> flip the row's type in place
//    and move both counters in the same atomic $inc (see
//    comment.repository.js#incrementReactionCounts)
async function reactToComment(userId, commentId, type) {
  const comment = await commentRepository.findById(commentId);
  if (!comment) throw ApiError.notFound("Comment not found");

  // Same atomic-upsert fix as likeTarget above: a double-tap racing two
  // reactToComment calls used to be able to both observe "no reaction yet"
  // via findLike() and both call createLike(), tripping the unique index.
  // createLikeIfAbsent collapses that into one atomic operation.
  const { created, existing } = await likeRepository.createLikeIfAbsent(
    userId,
    TARGET_TYPE.COMMENT,
    commentId,
    type
  );

  if (!created) {
    if (existing.type === type) {
      return extractCommentReaction(comment); // already reacted this way, no-op
    }
    await likeRepository.updateLikeType(existing._id, type);
    const delta =
      type === "like" ? { likeCount: 1, dislikeCount: -1 } : { likeCount: -1, dislikeCount: 1 };
    const updated = await commentRepository.incrementReactionCounts(commentId, delta);
    await commentReactionCacheBust(comment.post);
    return extractCommentReaction(updated);
  }

  const delta = type === "like" ? { likeCount: 1 } : { dislikeCount: 1 };
  const updated = await commentRepository.incrementReactionCounts(commentId, delta);
  await commentReactionCacheBust(comment.post);

  notificationService.notify({
    recipient: comment.author.toString(),
    sender: userId,
    type: NOTIFICATION_TYPE.LIKE,
    post: comment.post,
    comment: commentId,
  });

  return extractCommentReaction(updated);
}

// Clears whatever reaction (like or dislike) this user had on the comment,
// if any. Mirrors unlikeTarget's no-op-if-nothing-to-remove behavior.
async function removeCommentReaction(userId, commentId) {
  const comment = await commentRepository.findById(commentId);
  if (!comment) throw ApiError.notFound("Comment not found");

  const existing = await likeRepository.deleteLike(userId, TARGET_TYPE.COMMENT, commentId);
  if (!existing) {
    return extractCommentReaction(comment);
  }

  const delta = existing.type === "like" ? { likeCount: -1 } : { dislikeCount: -1 };
  const updated = await commentRepository.incrementReactionCounts(commentId, delta);
  await commentReactionCacheBust(comment.post);
  return extractCommentReaction(updated);
}

module.exports = {
  likeTarget,
  unlikeTarget,
  listLikedPosts,
  listLikedIds,
  reactToComment,
  removeCommentReaction,
};