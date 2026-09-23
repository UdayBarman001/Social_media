// Controllers only translate HTTP <-> service calls. No business logic here.

const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const { getPagination } = require("../../utils/pagination");
const userService = require("./user.service");

const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.body.userId);
  ApiResponse.success(res, { message: "Profile fetched", data: { user } });
});

const getUserByHandle = asyncHandler(async (req, res) => {
  const user = await userService.getProfileByHandle(req.params.handle);
  ApiResponse.success(res, { message: "User fetched", data: { user } });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.params.id);
  ApiResponse.success(res, { message: "User fetched", data: { user } });
});

// POST /users/device — the app's identity bootstrap. Called once on first
// launch (and cheaply again on every launch after) with a device-generated
// id + whatever display name is currently set; returns the real User
// document (creating it on first sight) so the client can use its Mongo
// _id — not the typed name — as the actual author/like/follow identity.
const loginDevice = asyncHandler(async (req, res) => {
  const user = await userService.getOrCreateByDevice(req.body.deviceId, req.body.name);
  ApiResponse.success(res, { message: "Device identity resolved", data: { user } });
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.body.userId, req.body);
  ApiResponse.success(res, { message: "Profile updated", data: { user } });
});

const updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, { statusCode: 400, message: "Image file is required" });
  const user = await userService.updateAvatar(req.body.userId, req.file);
  ApiResponse.success(res, { message: "Avatar updated", data: { user } });
});

const searchUsers = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const users = await userService.searchUsers(req.query.q, pagination);
  ApiResponse.success(res, { message: "Users fetched", data: { users } });
});

module.exports = { getMe, getUserByHandle, getUserById, loginDevice, updateMe, updateAvatar, searchUsers };