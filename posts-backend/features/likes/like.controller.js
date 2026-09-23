// Mounted directly on post.routes.js as POST /posts/:id/like and
// POST /posts/:id/unlike (see post.routes.js for why: matching the
// existing frontend contract instead of a single toggle endpoint).

const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const likeService = require("./like.service");
const postService = require("../posts/post.service");
const postRepository = require("../posts/post.repository");
const { getPagination } = require("../../utils/pagination");
const { TARGET_TYPE, PAGINATION } = require("../../constants");

const likePost = asyncHandler(async (req, res) => {
  await likeService.likeTarget(req.body.userId, TARGET_TYPE.POST, req.params.id);
  const post = postService.toClientPost(await postRepository.findById(req.params.id));
  ApiResponse.success(res, { message: "Post liked", data: { post } });
});

const unlikePost = asyncHandler(async (req, res) => {
  await likeService.unlikeTarget(req.body.userId, TARGET_TYPE.POST, req.params.id);
  const post = postService.toClientPost(await postRepository.findById(req.params.id));
  ApiResponse.success(res, { message: "Post unliked", data: { post } });
});

// GET /likes/:userId/posts — powers the profile screen's "Likes" tab.
const listLikedPosts = asyncHandler(async (req, res) => {
  const posts = await likeService.listLikedPosts(req.params.userId, getPagination(req.query));
  ApiResponse.success(res, {
    message: "Liked posts fetched",
    data: { posts: posts.map(postService.toClientPost) },
  });
});

const listLikedIds = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query, {
    defaultLimit: PAGINATION.SYNC_DEFAULT_LIMIT,
    maxLimit: PAGINATION.SYNC_MAX_LIMIT,
  });
  const liked = await likeService.listLikedIds(req.params.userId, pagination);
  ApiResponse.success(res, { message: "Liked ids fetched", data: { liked } });
});

module.exports = { likePost, unlikePost, listLikedPosts, listLikedIds };