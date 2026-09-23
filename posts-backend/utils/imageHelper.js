// Wraps ImageKit upload/delete so every feature (posts, avatars, ...) handles
// images the same way, stores only the metadata it needs, and cleans up
// properly when a resource is deleted or replaced.

const imagekit = require("../config/imagekit");
const ApiError = require("./ApiError");
const logger = require("../config/logger");

/**
 * Uploads a base64 or buffer image to ImageKit.
 * @param {Buffer|string} file - file buffer or base64 string
 * @param {string} fileName
 * @param {string} folder - e.g. "/posts", "/avatars"
 * @returns {Promise<{url: string, fileId: string, thumbnailUrl: string}>}
 */
async function uploadImage(file, fileName, folder = "/misc") {
  if (!imagekit) throw ApiError.internal("Image service is not configured");
  try {
    const result = await imagekit.upload({
      file,
      fileName,
      folder,
      useUniqueFileName: true,
    });
    return {
      url: result.url,
      fileId: result.fileId,
      thumbnailUrl: result.thumbnailUrl || result.url,
    };
  } catch (err) {
    logger.error("ImageKit upload failed", err);
    throw ApiError.internal("Image upload failed");
  }
}

/**
 * Deletes an image from ImageKit by fileId. Never throws — deletion failures
 * are logged but shouldn't block the parent resource's own delete/update.
 */
async function deleteImage(fileId) {
  if (!imagekit || !fileId) return;
  try {
    await imagekit.deleteFile(fileId);
  } catch (err) {
    logger.warn(`Failed to delete ImageKit file ${fileId}`, err.message);
  }
}

module.exports = { uploadImage, deleteImage };
