// Like/unlike for posts is mounted directly on post.routes.js (POST
// /posts/:id/like, /unlike) and comment likes on comment-like.routes.js —
// see those files. This router only holds the read endpoints that don't
// belong to a single post: "posts a user has liked" (full post objects,
// for the profile screen) and "liked post ids" (bulk ids only, for
// syncing FeedContext's local likedIds Set with server truth on launch —
// mirrors GET /follows/:userId/following's shape/purpose exactly).

const express = require("express");
const router = express.Router();
const controller = require("./like.controller");

router.get("/:userId/posts", controller.listLikedPosts);
router.get("/:userId/liked", controller.listLikedIds);

module.exports = router;