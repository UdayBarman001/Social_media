const bookmarkRepository = require("./bookmark.repository");
const postRepository = require("../posts/post.repository");
const postService = require("../posts/post.service");
const ApiError = require("../../utils/ApiError");
const { getPagination, buildMeta } = require("../../utils/pagination");

async function addBookmark(userId, postId) {
  const post = await postRepository.findById(postId);
  if (!post) throw ApiError.notFound("Post not found");

  // Atomic upsert closes the double-tap race the old findBookmark()-then-
  // createBookmark() two-step had — see bookmark.repository.js for why.
  await bookmarkRepository.createBookmarkIfAbsent(userId, postId); // no-op if already bookmarked
}

async function removeBookmark(userId, postId) {
  await bookmarkRepository.deleteBookmark(userId, postId);
}

async function listBookmarks(userId, query) {
  const pagination = getPagination(query);
  const [rows, total] = await Promise.all([
    bookmarkRepository.listByUser(userId, pagination),
    bookmarkRepository.countByUser(userId),
  ]);
  const posts = rows.filter((r) => r.post).map((r) => postService.toClientPost(r.post));
  return { posts, meta: buildMeta({ ...pagination, total }) };
}

module.exports = { addBookmark, removeBookmark, listBookmarks };