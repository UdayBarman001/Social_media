const { body } = require("express-validator");
const { TARGET_TYPE } = require("../../constants");

const createReportValidation = [
  body("targetType").isIn(Object.values(TARGET_TYPE)).withMessage("Invalid target type"),
  body("targetId").isMongoId().withMessage("Invalid target id"),
  body("reason").trim().notEmpty().withMessage("Reason is required").isLength({ max: 300 }),
];

module.exports = { createReportValidation };
