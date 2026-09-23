// mergeParams for :postId/:commentId from the parent post/comment routers
const express = require("express");
const router = express.Router({ mergeParams: true });
const { body } = require("express-validator");
const controller = require("./comment-like.controller");
const validate = require("../../middleware/validateRequest");

router.post(
  "/",
  validate([
    body("reaction")
      .isIn(["like", "dislike", "none"])
      .withMessage("reaction must be 'like', 'dislike', or 'none'"),
    body("userId").isMongoId().withMessage("Valid userId is required"),
  ]),
  controller.toggleCommentLike
);

module.exports = router;