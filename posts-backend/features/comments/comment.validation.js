const { body } = require("express-validator");

const addCommentValidation = [
  body("text").trim().notEmpty().withMessage("Comment text is required").isLength({ max: 500 }),
  body("parentComment").optional().isMongoId().withMessage("Invalid parent comment id"),
];

const editCommentValidation = [
  body("text").trim().notEmpty().withMessage("Comment text is required").isLength({ max: 500 }),
  body("userId").isMongoId().withMessage("Valid userId is required"),
];

module.exports = { addCommentValidation, editCommentValidation };