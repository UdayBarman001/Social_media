const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const notificationService = require("./notification.service");

const listNotifications = asyncHandler(async (req, res) => {
  // GET requests can't reliably carry a JSON body over fetch — the client
  // sends userId as a query param for this endpoint (same pattern as
  // bookmark.controller.js's listBookmarks).
  const userId = req.body.userId || req.query.userId;
  const { notifications, meta } = await notificationService.listNotifications(userId, req.query);
  ApiResponse.success(res, { message: "Notifications fetched", data: { notifications }, meta });
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.body.userId);
  ApiResponse.success(res, { message: "All notifications marked as read", data: {} });
});

const markOneRead = asyncHandler(async (req, res) => {
  await notificationService.markOneRead(req.body.userId, req.params.id);
  ApiResponse.success(res, { message: "Notification marked as read", data: {} });
});

module.exports = { listNotifications, markAllRead, markOneRead };
