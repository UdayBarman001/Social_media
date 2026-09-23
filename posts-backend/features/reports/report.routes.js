const express = require("express");
const router = express.Router();
const controller = require("./report.controller");
const { createReportValidation } = require("./report.validation");
const validate = require("../../middleware/validateRequest");

router.post("/", validate(createReportValidation), controller.createReport);

// Moderation queue (open in dev — no auth)
router.get("/", controller.listPending);
router.patch("/:id", controller.resolveReport);

module.exports = router;
