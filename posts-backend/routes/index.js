// Single place where every feature's router is mounted. app.js only needs
// to know about this one file — adding a new feature means adding one line
// here, not touching app.js.

const express = require("express");
const router = express.Router();

router.use("/users", require("../features/users/user.routes"));
router.use("/posts", require("../features/posts/post.routes"));
router.use("/follows", require("../features/follows/follow.routes"));
router.use("/bookmarks", require("../features/bookmarks/bookmark.routes"));
router.use("/likes", require("../features/likes/like.routes"));
router.use("/notifications", require("../features/notifications/notification.routes"));
router.use("/reports", require("../features/reports/report.routes"));
router.use("/health", require("./health.routes"));

module.exports = router;