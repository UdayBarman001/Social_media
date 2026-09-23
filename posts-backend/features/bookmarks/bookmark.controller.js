const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const bookmarkService = require("./bookmark.service");

const addBookmark = asyncHandler(async (req, res) => {
  await bookmarkService.addBookmark(req.body.userId, req.params.postId);
  ApiResponse.success(res, { message: "Post bookmarked", data: {} });
});

const removeBookmark = asyncHandler(async (req, res) => {
  await bookmarkService.removeBookmark(req.body.userId, req.params.postId);
  ApiResponse.success(res, { message: "Bookmark removed", data: {} });
});

const listBookmarks = asyncHandler(async (req, res) => {
  // GET requests can't reliably carry a JSON body over fetch — the client
  // sends userId as a query param for this endpoint specifically. Body is
  // still checked first for backward compatibility with any other caller.
  const userId = req.body.userId || req.query.userId;
  const { posts, meta } = await bookmarkService.listBookmarks(userId, req.query);
  ApiResponse.success(res, { message: "Bookmarks fetched", data: { posts }, meta });
});

module.exports = { addBookmark, removeBookmark, listBookmarks };