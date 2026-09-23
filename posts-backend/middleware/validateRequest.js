// Runs express-validator chains and converts failures into a single ApiError
// so every feature's *.validation.js files can share this one middleware.

const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

function validate(validations) {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    const formatted = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    next(ApiError.badRequest("Validation failed", formatted));
  };
}

module.exports = validate;
