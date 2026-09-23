const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const commentService = require("./comment.service");

const listComments = asyncHandler(async (req, res) => {
  const { comments, meta } = await commentService.listComments(req.params.postId, req.query);
  ApiResponse.success(res, { message: "Comments fetched", data: { comments }, meta });
});

const addComment = asyncHandler(async (req, res) => {
  const comment = await commentService.addComment(req.body.userId, req.params.postId, req.body);
  ApiResponse.success(res, { statusCode: 201, message: "Comment added", data: { comment } });
});

const deleteComment = asyncHandler(async (req, res) => {
  await commentService.deleteComment(req.body.userId, req.params.postId, req.params.commentId);
  ApiResponse.success(res, { message: "Comment deleted", data: {} });
});

const updateComment = asyncHandler(async (req, res) => {
  const comment = await commentService.updateComment(
    req.body.userId,
    req.params.postId,
    req.params.commentId,
    req.body.text
  );
  ApiResponse.success(res, { message: "Comment updated", data: { comment } });
});

module.exports = { listComments, addComment, deleteComment, updateComment };