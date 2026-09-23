// Facebook-style thumbs up/down on a comment. `reaction` is one of
// 'like' | 'dislike' | 'none' ('none' clears whatever reaction this user
// had). Returns both the parent post (existing contract other callers may
// still rely on) and the specific comment's fresh like/dislike counts, so
// the client can patch that one comment without refetching the whole list.

const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const likeService = require("./like.service");
const postService = require("../posts/post.service");
const postRepository = require("../posts/post.repository");

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { reaction, userId } = req.body;

  const counts =
    reaction === "none"
      ? await likeService.removeCommentReaction(userId, req.params.commentId)
      : await likeService.reactToComment(userId, req.params.commentId, reaction);

  const post = postService.toClientPost(await postRepository.findById(req.params.postId));
  ApiResponse.success(res, {
    message: "Comment reaction updated",
    data: { post, comment: { id: req.params.commentId, ...counts } },
  });
});

module.exports = { toggleCommentLike };