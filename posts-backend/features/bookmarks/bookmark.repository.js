const Bookmark = require("./bookmark.model");

function findBookmark(userId, postId) {
  return Bookmark.findOne({ user: userId, post: postId });
}
function createBookmark(userId, postId) {
  return Bookmark.create({ user: userId, post: postId });
}

// Atomic "insert only if not already bookmarked" — same race fix as
// like.repository.js#createLikeIfAbsent, for the same reason: a double-tap
// firing two addBookmark requests used to be able to both pass the
// findBookmark() "not found" check before either wrote, and the second
// create() would hit the { user, post } unique index (bookmark.model.js)
// and throw E11000, surfacing as a client-facing 409 instead of the silent
// no-op a repeat bookmark should be.
async function createBookmarkIfAbsent(userId, postId) {
  const result = await Bookmark.findOneAndUpdate(
    { user: userId, post: postId },
    { $setOnInsert: { user: userId, post: postId } },
    { upsert: true, new: false, includeResultMetadata: true, setDefaultsOnInsert: true }
  );
  return { created: !!result?.lastErrorObject?.upserted };
}
function deleteBookmark(userId, postId) {
  return Bookmark.findOneAndDelete({ user: userId, post: postId });
}
function listByUser(userId, { skip, limit }) {
  // `author` on Post is a real ObjectId ref to User (see post.model.js),
  // same as every other post read path (post.repository.js's
  // AUTHOR_POPULATE). A bare `.populate("post")` only populates the post
  // itself, not post.author nested inside it — so post.author stayed an
  // unpopulated ObjectId, post.service.js#toClientPost's
  // populated-vs-not check failed, and every post returned from this
  // endpoint came back with authorName/authorAvatar/authorVerified all
  // undefined. Populating the nested path fixes that and matches
  // AUTHOR_POPULATE's shape everywhere else.
  return Bookmark.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({ path: "post", populate: { path: "author", select: "name avatarUrl verified" } })
    .lean();
}
function countByUser(userId) {
  return Bookmark.countDocuments({ user: userId });
}

// Removes every bookmark of a post — used to cascade-delete when the post
// itself is deleted, so no Bookmark row is left pointing at a deleted post.
// (listByUser already filters out unpopulated posts defensively, but this
// stops the rows from accumulating in the first place.)
function deleteByPost(postId, session) {
  const q = Bookmark.deleteMany({ post: postId });
  if (session) q.session(session);
  return q;
}

module.exports = {
  findBookmark,
  createBookmark,
  createBookmarkIfAbsent,
  deleteBookmark,
  listByUser,
  countByUser,
  deleteByPost,
};