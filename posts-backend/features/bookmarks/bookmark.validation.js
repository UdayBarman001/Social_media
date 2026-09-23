const { param } = require("express-validator");
const bookmarkParamsValidation = [param("postId").isMongoId().withMessage("Invalid post id")];
module.exports = { bookmarkParamsValidation };
