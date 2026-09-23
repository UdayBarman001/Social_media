const express = require("express");
const router = express.Router();
const controller = require("./bookmark.controller");
const { bookmarkParamsValidation } = require("./bookmark.validation");
const validate = require("../../middleware/validateRequest");

router.get("/", controller.listBookmarks);
router.post("/:postId", validate(bookmarkParamsValidation), controller.addBookmark);
router.delete("/:postId", validate(bookmarkParamsValidation), controller.removeBookmark);

module.exports = router;
