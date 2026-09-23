const { body } = require("express-validator");

const updateProfileValidation = [
  body("handle").optional().trim().toLowerCase().matches(/^[a-z0-9_]{3,20}$/).withMessage("Handle must be 3-20 chars: letters, numbers, underscore"),
  body("name").optional().trim().isLength({ min: 1, max: 80 }).withMessage("Name must be 1-80 characters"),
  body("bio").optional().trim().isLength({ max: 300 }).withMessage("Bio must be under 300 characters"),
  body("location").optional().trim().isLength({ max: 100 }).withMessage("Location must be under 100 characters"),
];

const deviceLoginValidation = [
  body("deviceId").isString().trim().isLength({ min: 8, max: 128 }).withMessage("deviceId is required"),
  body("handle").optional().trim().toLowerCase().matches(/^[a-z0-9_]{3,20}$/).withMessage("Handle must be 3-20 chars: letters, numbers, underscore"),
  body("name").optional().isString().trim().isLength({ max: 80 }),
];

module.exports = { updateProfileValidation, deviceLoginValidation };