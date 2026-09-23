const express = require("express");
const router = express.Router();
const controller = require("./follow.controller");
const { followParamsValidation } = require("./follow.validation");
const validate = require("../../middleware/validateRequest");

router.post("/:userId", validate(followParamsValidation), controller.followUser);
router.delete("/:userId", validate(followParamsValidation), controller.unfollowUser);
router.get("/:userId/followers", controller.listFollowers);
router.get("/:userId/following", controller.listFollowing);
router.get("/:userId/counts", controller.getFollowCounts);

module.exports = router;