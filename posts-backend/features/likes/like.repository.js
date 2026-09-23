const Like = require("./like.model");

function findLike(userId, targetType, targetId) {
  return Like.findOne({ user: userId, targetType, targetId });
}

// `type` defaults to 'like' so every existing caller (post likes, and the
// pre-dislike comment-like flow) is unaffected — only comment.service's
// new reactToComment ever passes 'dislike' explicitly.
function createLike(userId, targetType, targetId, type = "like") {
  return Like.create({ user: userId, targetType, targetId, type });
}

// Atomic "insert only if this user hasn't already reacted to this target"
// — replaces the old findLike()-then-createLike() two-step, which raced
// under a double-tap: two concurrent requests could both pass the
// findLike() "not found" check before either had written its row, and the
// second create() would then hit the { user, targetType, targetId } unique
// index and throw E11000 (surfaced to the client as a confusing 409).
//
// findOneAndUpdate + upsert:true is a single atomic operation at the
// storage engine level — MongoDB guarantees only one of two concurrent
// upserts on the same key ever performs the insert; the other
// transparently matches the just-inserted row instead of erroring. So
// there is no window where both callers can observe "no row exists".
//
// includeResultMetadata:true is required to tell the two outcomes apart in Mongoose 8:
// `existing` is the previously-existing document (null if this call performed the
// insert), and `created` is derived from whether the driver reports an upserted _id.
async function createLikeIfAbsent(userId, targetType, targetId, type = "like") {
  const result = await Like.findOneAndUpdate(
    { user: userId, targetType, targetId },
    { $setOnInsert: { user: userId, targetType, targetId, type } },
    { upsert: true, new: false, includeResultMetadata: true, setDefaultsOnInsert: true }
  );
  const created = !!result?.lastErrorObject?.upserted;
  return { created, existing: created ? null : result?.value || null };
}

function deleteLike(userId, targetType, targetId) {
  return Like.findOneAndDelete({ user: userId, targetType, targetId });
}

// Flips an existing reaction row between 'like' and 'dislike' in place —
// used when a user who already reacted one way taps the other reaction,
// so this stays a single row per user+target (per the unique index)
// instead of ever creating a second one.
function updateLikeType(likeId, type) {
  return Like.findByIdAndUpdate(likeId, { type }, { new: true });
}

// Powers the profile screen's "Likes" tab: most-recently-liked target ids
// first, for a given user + targetType (Post or Comment).
function findLikedTargetIds(userId, targetType, { skip, limit }) {
  return Like.find({ user: userId, targetType })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select("targetId")
    .lean();
}

// Bulk-removes every Like row pointing at any of the given target ids (a
// post, or a batch of comment ids) — used to cascade-delete likes when
// their target (post or comment) is deleted, so no Like row is ever left
// pointing at something that no longer exists.
function deleteByTargets(targetType, targetIds, session) {
  const q = Like.deleteMany({ targetType, targetId: { $in: targetIds } });
  if (session) q.session(session);
  return q;
}

module.exports = {
  findLike,
  createLike,
  createLikeIfAbsent,
  deleteLike,
  updateLikeType,
  findLikedTargetIds,
  deleteByTargets,
};