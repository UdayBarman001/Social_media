const express = require("express");
const router = express.Router();

const controller = require("./post.controller");
const { createPostValidation, updatePostValidation } = require("./post.validation");
const validate = require("../../middleware/validateRequest");
const upload = require("../../middleware/uploadMiddleware");

const commentRoutes = require("../comments/comment.routes");
const likeController = require("../likes/like.controller");
const parseMultipartTags = require("./parseMultipartTags");

router.get("/search", controller.searchPosts);
router.get("/", controller.getFeed);
router.get("/:id", controller.getPostById);

router.post(
  "/",
  upload.array("images", 6),
  parseMultipartTags,
  validate(createPostValidation),
  controller.createPost
);
router.patch(
  "/:id",
  upload.array("images", 6),
  parseMultipartTags,
  validate(updatePostValidation),
  controller.updatePost
);

// Appends a single image to an existing post — see post.controller.js for why.
router.post("/:id/images", upload.single("image"), controller.addImage);

router.delete("/:id", controller.deletePost);

// Explicit like/unlike actions to match the existing frontend contract
// (POST /posts/:id/like, POST /posts/:id/unlike). A REST-style DELETE
// alternative is also provided for future clients.
router.post("/:id/like", likeController.likePost);
router.post("/:id/unlike", likeController.unlikePost);
router.delete("/:id/like", likeController.unlikePost);

// Nested resource: comments always belong to a post.
router.use("/:postId/comments", commentRoutes);

module.exports = router;