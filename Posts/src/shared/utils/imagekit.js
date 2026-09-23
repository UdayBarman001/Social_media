import { PixelRatio } from "react-native";

function isTransformable(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function appendTransform(url, transform) {
  return url.includes("?") ? `${url}&${transform}` : `${url}?${transform}`;
}

const clampDim = (n) => Math.max(1, Math.round(n));

/**
 * A single small, compressed square crop — for avatar-sized contexts
 * (feed post header, comment rows) where the image is small enough on
 * screen that a 3-stage blur-up buys nothing but an extra request or
 * two: one right-sized fetch is both simpler and cheaper here.
 */
export function getThumbnailUrl(url, size = 80, quality = 60) {
  if (!url) return url;
  if (!isTransformable(url)) return url;

  const px = clampDim(size);
  // fo-face centers the crop on a detected face when there is one, so a
  // square avatar crop doesn't randomly cut off someone's head.
  // dpr-2 covers standard and @2x/@3x screens from a single request —
  // still a fraction of the original's size, since the source is being
  // downscaled + recompressed either way.
  return appendTransform(url, `tr=w-${px},h-${px},fo-face,q-${quality},dpr-2`);
}

export function getProgressiveStages(url, width, height = width, { crop = true } = {}) {
  if (!url || !isTransformable(url)) {
    return { blur: url, medium: url, full: url };
  }

  const w = clampDim(width);
  const h = clampDim(height);
  const aspect = h / w;
  const blurW = 24;
  const blurH = clampDim(blurW * aspect);
  const medW = clampDim(w / 3);
  const medH = clampDim(h / 3);
  // `c-at_max` (used for `contentFit="contain"` contexts like the
  // lightbox) fits the image within the given box without cropping or
  // padding — the default crop-to-exact-box behavior is right for
  // avatars/thumbnails, but would slice off part of a photo whose aspect
  // ratio doesn't match the viewport it's shown "contain"ed in.
  const fit = crop ? "" : ",c-at_max";
  const dpr = Math.min(PixelRatio.get() || 2, 3);

  return {
    blur: appendTransform(url, `tr=w-${blurW},h-${blurH},bl-25,q-20${fit}`),
    medium: appendTransform(url, `tr=w-${medW},h-${medH},bl-3,q-45${fit}`),
    full: appendTransform(url, `tr=w-${clampDim(w * dpr)},h-${clampDim(h * dpr)},q-80${fit}`),
  };
}