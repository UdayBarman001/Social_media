// Multipart form-data fields are always strings — the frontend's
// FileSystem.uploadAsync path JSON.stringifies `tags` before sending
// since there's no way to send a real array through multipart params.
// This middleware parses it back into an array before validation checks
// its type, on BOTH create and update (a multipart update with tags used
// to skip this and fail validation with a confusing "tags must be an
// array" error).
//
// IMPORTANT: a malformed/corrupted tags payload is a client bug or a
// dropped/garbled network write — it must surface as a 400 to the caller,
// not disappear into a silent `[]`. Silently discarding it meant a user's
// tags could vanish with no error and no way to know why.

const ApiError = require("../../utils/ApiError");

function parseMultipartTags(req, res, next) {
  if (typeof req.body.tags !== "string") return next();

  // Multipart clients that don't send tags at all still get an empty
  // string field from some form-data encoders — treat that as "no tags",
  // not an error.
  if (req.body.tags.trim() === "") {
    req.body.tags = [];
    return next();
  }

  try {
    const parsed = JSON.parse(req.body.tags);
    if (!Array.isArray(parsed)) {
      throw new Error("tags must be a JSON array");
    }
    req.body.tags = parsed;
    return next();
  } catch {
    return next(ApiError.badRequest("Invalid tags format — expected a JSON array of strings"));
  }
}

module.exports = parseMultipartTags;