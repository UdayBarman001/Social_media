// App-wide constant values. Anything that would otherwise be a "magic string"
// repeated across features belongs here — enum-like values, roles, limits.

const ROLES = Object.freeze({
  USER: "user",
  FARMER: "farmer",
  ADMIN: "admin",
});

const AUDIENCE = Object.freeze({
  PUBLIC: "Public",
  FARMERS_ONLY: "Farmers only",
  ONLY_ME: "Only me",
});

const TARGET_TYPE = Object.freeze({
  POST: "Post",
  COMMENT: "Comment",
});

const NOTIFICATION_TYPE = Object.freeze({
  LIKE: "like",
  COMMENT: "comment",
  FOLLOW: "follow",
  MENTION: "mention",
});

const REPORT_STATUS = Object.freeze({
  PENDING: "pending",
  REVIEWED: "reviewed",
  DISMISSED: "dismissed",
});

const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  // Used only by "full sync" bulk-id endpoints (e.g. GET /likes/:userId/liked)
  // that FeedContext calls once on launch to hydrate a local Set — not by
  // regular paginated lists (feed, following/followers, the Likes profile
  // tab). Those intentionally keep the smaller DEFAULT_LIMIT/MAX_LIMIT above.
  SYNC_DEFAULT_LIMIT: 200,
  SYNC_MAX_LIMIT: 500,
});

const POST_LIMITS = Object.freeze({
  MAX_IMAGES: 6, // matches the multer .array("images", 6) cap in post.routes.js
});

module.exports = {
  ROLES,
  AUDIENCE,
  TARGET_TYPE,
  NOTIFICATION_TYPE,
  REPORT_STATUS,
  PAGINATION,
  POST_LIMITS,
};