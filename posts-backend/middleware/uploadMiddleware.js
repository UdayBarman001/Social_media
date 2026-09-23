// Multer configured for memory storage — files are held in a buffer just
// long enough to stream to ImageKit, never written to disk. Keeps the
// container filesystem stateless (important for horizontal scaling).

const multer = require("multer");
const ApiError = require("../utils/ApiError");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) return cb(null, true);
  cb(ApiError.badRequest("Only image files are allowed"));
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 6 }, // 10MB per file, up to 6 files
  fileFilter,
});

module.exports = upload;
