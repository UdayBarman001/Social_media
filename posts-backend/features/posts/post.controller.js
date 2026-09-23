const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const postService = require("./post.service");

const getFeed = asyncHandler(async (req, res) => {
  const { posts, meta } = await postService.getFeed(req.query);
  ApiResponse.success(res, { message: "Feed fetched", data: { posts }, meta });
});

const getPostById = asyncHandler(async (req, res) => {
  const post = await postService.getPostById(req.params.id);
  ApiResponse.success(res, { message: "Post fetched", data: { post } });
});

const createPost = asyncHandler(async (req, res) => {
  const post = await postService.createPost(req.body.userId, req.body, req.files || []);
  ApiResponse.success(res, { statusCode: 201, message: "Post created", data: { post } });
});

const updatePost = asyncHandler(async (req, res) => {
  const post = await postService.updatePost(req.body.userId, req.params.id, req.body, req.files || []);
  ApiResponse.success(res, { message: "Post updated", data: { post } });
});

// POST /posts/:id/images — appends one more image to an existing post.
// Called repeatedly by the client to build up a multi-image post beyond
// the first image sent with the original create request.
const addImage = asyncHandler(async (req, res) => {
  const post = await postService.addImage(req.body.userId, req.params.id, req.file);
  ApiResponse.success(res, { statusCode: 201, message: "Image added", data: { post } });
});

const deletePost = asyncHandler(async (req, res) => {
  await postService.deletePost(req.body.userId, req.params.id);
  ApiResponse.success(res, { statusCode: 200, message: "Post deleted", data: {} });
});

const searchPosts = asyncHandler(async (req, res) => {
  const posts = await postService.searchPosts(req.query.q);
  ApiResponse.success(res, { message: "Posts fetched", data: { posts } });
});

module.exports = { getFeed, getPostById, createPost, updatePost, addImage, deletePost, searchPosts };