const express = require("express");
const router = express.Router();
const controller = require("./notification.controller");

router.get("/", controller.listNotifications);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markOneRead);

module.exports = router;
