const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const followService = require("./follow.service");

const followUser = asyncHandler(async (req, res) => {
  await followService.follow(req.body.userId, req.params.userId);
  ApiResponse.success(res, { message: "Followed user", data: {} });
});

const unfollowUser = asyncHandler(async (req, res) => {
  await followService.unfollow(req.body.userId, req.params.userId);
  ApiResponse.success(res, { message: "Unfollowed user", data: {} });
});

const listFollowers = asyncHandler(async (req, res) => {
  const followers = await followService.listFollowers(req.params.userId, req.query);
  ApiResponse.success(res, { message: "Followers fetched", data: { followers } });
});

const listFollowing = asyncHandler(async (req, res) => {
  const following = await followService.listFollowing(req.params.userId, req.query);
  ApiResponse.success(res, { message: "Following fetched", data: { following } });
});

const getFollowCounts = asyncHandler(async (req, res) => {
  const counts = await followService.getFollowCounts(req.params.userId);
  ApiResponse.success(res, { message: "Follow counts fetched", data: counts });
});

module.exports = { followUser, unfollowUser, listFollowers, listFollowing, getFollowCounts };