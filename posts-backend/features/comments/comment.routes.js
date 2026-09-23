// mergeParams so :postId from the parent post.routes.js router is available here
const express = require("express");
const router = express.Router({ mergeParams: true });

const controller = require("./comment.controller");
const { addCommentValidation, editCommentValidation } = require("./comment.validation");
const validate = require("../../middleware/validateRequest");
const likeRoutes = require("../likes/comment-like.routes");

router.get("/", controller.listComments);
router.post("/", validate(addCommentValidation), controller.addComment);
router.patch("/:commentId", validate(editCommentValidation), controller.updateComment);
router.delete("/:commentId", controller.deleteComment);

router.use("/:commentId/like", likeRoutes);

module.exports = router;