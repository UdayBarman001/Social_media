const express = require("express");
const router = express.Router();

const controller = require("./user.controller");
const { updateProfileValidation, deviceLoginValidation } = require("./user.validation");
const validate = require("../../middleware/validateRequest");
const upload = require("../../middleware/uploadMiddleware");

// Identity bootstrap — must come before "/:handle" so it isn't swallowed
// by that catch-all route.
router.post("/device", validate(deviceLoginValidation), controller.loginDevice);

router.get("/me", controller.getMe);
router.patch("/me", validate(updateProfileValidation), controller.updateMe);
router.patch("/me/avatar", upload.single("avatar"), controller.updateAvatar);

router.get("/search", controller.searchUsers);
// Fetch by Mongo _id — needed by screens (e.g. profile) that only have the
// author's ObjectId (from a post/comment) and not their @handle.
router.get("/id/:id", controller.getUserById);
router.get("/:handle", controller.getUserByHandle);

module.exports = router;