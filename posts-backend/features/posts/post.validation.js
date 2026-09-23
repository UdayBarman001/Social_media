const { body } = require("express-validator");
const { AUDIENCE } = require("../../constants");

const createPostValidation = [
  body("description").optional().isString().isLength({ max: 2000 }),
  body("location").optional().isString().isLength({ max: 100 }),
  body("audience").optional().isIn(Object.values(AUDIENCE)),
  body("tags").optional().isArray({ max: 10 }),
];

const updatePostValidation = [
  body("description").optional().isString().isLength({ max: 2000 }),
  body("location").optional().isString().isLength({ max: 100 }),
  body("audience").optional().isIn(Object.values(AUDIENCE)),
  body("tags").optional().isArray({ max: 10 }),
  body("removeImage").optional().isBoolean(),
];

module.exports = { createPostValidation, updatePostValidation };
