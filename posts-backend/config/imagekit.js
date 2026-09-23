// Single ImageKit client instance, reused by any feature that uploads
// or deletes images (posts, users/avatars, future features).

const ImageKit = require("imagekit");
const config = require("./env");
const logger = require("./logger");

let imagekit = null;

if (config.imagekit.publicKey && config.imagekit.privateKey && config.imagekit.urlEndpoint) {
  imagekit = new ImageKit({
    publicKey: config.imagekit.publicKey,
    privateKey: config.imagekit.privateKey,
    urlEndpoint: config.imagekit.urlEndpoint,
  });
} else {
  logger.warn("ImageKit credentials not set — image upload/delete will fail until configured.");
}

module.exports = imagekit;
