import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

/**
 * Checks if a URI is a local device file that requires compression.
 * Remote URLs (http/https) should never be processed.
 */
function isLocalDeviceFile(uri) {
  if (!uri || typeof uri !== "string") return false;
  return /^(file|content|ph|assets-library):/.test(uri);
}

/**
 * Compresses and resizes a single image.
 *
 * Modern smartphones shoot 12MP to 48MP photos (3000x4000+), resulting in 4MB-8MB files.
 * Clamping max dimension to 1440px and JPEG quality to 0.78 preserves crisp display on high-DPI
 * retina mobile screens while shrinking file size by ~85-92% (from ~6MB down to ~300KB).
 *
 * @param {string} uri - Local file URI
 * @param {object} options - Compression options
 * @param {number} [options.maxWidth=1440] - Maximum width constraint
 * @param {number} [options.quality=0.78] - JPEG compression quality (0.0 to 1.0)
 * @returns {Promise<string>} Compressed local file URI or original URI if compression fails
 */
export async function compressImage(uri, { maxWidth = 1440, quality = 0.78 } = {}) {
  if (!isLocalDeviceFile(uri)) return uri;

  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      {
        compress: quality,
        format: SaveFormat.JPEG,
      }
    );
    return result?.uri || uri;
  } catch (error) {
    // Non-fatal: if compression fails (corrupt metadata, unsupported format),
    // fall back cleanly to original file rather than blocking the user.
    console.warn("Client image compression fallback to original:", error?.message || error);
    return uri;
  }
}

/**
 * Concurrently compresses an array of local image URIs.
 *
 * @param {string[]} uris - Array of local image URIs
 * @param {object} options - Compression options
 * @returns {Promise<string[]>} Array of compressed URIs
 */
export async function compressImages(uris, options) {
  if (!Array.isArray(uris) || uris.length === 0) return [];
  return Promise.all(uris.map((uri) => compressImage(uri, options)));
}

/**
 * Specialized lightweight compressor for avatar/profile photos.
 * Avatars are rendered at 100-150px on screen; 500x500 resolution provides
 * sharp 3x pixel density while keeping payload under ~60KB.
 *
 * @param {string} uri - Local avatar image URI
 * @returns {Promise<string>} Compressed avatar URI
 */
export async function compressAvatar(uri) {
  return compressImage(uri, { maxWidth: 500, quality: 0.82 });
}
