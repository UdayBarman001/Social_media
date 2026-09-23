const { param } = require("express-validator");
const followParamsValidation = [param("userId").isMongoId().withMessage("Invalid user id")];
module.exports = { followParamsValidation };
