import { useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { getProgressiveStages } from "../utils/imagekit";
import {
  fullyLoadedUris,
  hydrateFullyLoadedUris,
  markUriFullyLoaded,
} from "../utils/progressiveImageCache";

/**
 * Instagram/YouTube-style progressive image: a heavily blurred, tiny
 * placeholder appears first (a handful of KB — effectively instant on
 * any connection), a soft medium-quality preview replaces it once that's
 * actually decoded, and the crisp final image — sized to how large it's
 * actually being displayed, not the raw upload — replaces that in turn.
 *
 * Each stage is only requested once the previous one has loaded, so a
 * slow connection never pays for the full image before the blur has
 * even landed; a fast connection races through all three well under a
 * frame, and on a good network what the person actually sees settles
 * on the same clean, uncompromised image it always would have.
 *
 * All three stages are ImageKit-transformed derivatives of the same
 * original file (see shared/utils/imagekit.js) — nothing is ever
 * re-uploaded or duplicated in storage to make this work.
 */
export default function ProgressiveImage({
  uri,
  width,
  height,
  style,
  contentFit = "cover",
  // Pass false for contentFit="contain" contexts (e.g. the lightbox) so
  // the transformed stages fit within the box instead of being cropped
  // to fill it — see getProgressiveStages' `crop` option.
  crop = true,
  borderRadius,
  cachePolicy = "memory-disk",
  recyclingKey,
  priority,
  onLoad,
  onLoadEnd,
  onError,
}) {
  const stages = useMemo(
    () => getProgressiveStages(uri, width, height, { crop }),
    [uri, width, height, crop],
  );

  const [stage, setStage] = useState(() =>
    fullyLoadedUris.has(uri) ? "full" : "blur",
  );

  useEffect(() => {
    hydrateFullyLoadedUris();
  }, []);

  // Reset per-instance progress if the underlying uri actually changes
  // (a recycled list cell now rendering different content) — without
  // this a reused component instance could keep showing a previous
  // item's fully-loaded image while this one's own stages are still
  // catching up.
  const lastUriRef = useRef(uri);
  if (lastUriRef.current !== uri) {
    lastUriRef.current = uri;
    const next = fullyLoadedUris.has(uri) ? "full" : "blur";
    if (stage !== next) setStage(next);
  }

  if (!uri) return null;

  const activeSource =
    stage === "full" ? stages.full : stage === "medium" ? stages.medium : stages.blur;

  return (
    <Image
      source={{ uri: activeSource }}
      style={[{ width, height, borderRadius }, style]}
      contentFit={contentFit}
      cachePolicy={cachePolicy}
      recyclingKey={recyclingKey}
      priority={priority}
      transition={180}
      onLoad={(e) => {
        if (stage === "blur") {
          setStage("medium");
        } else if (stage === "medium") {
          setStage("full");
        } else {
          markUriFullyLoaded(uri);
          onLoad?.(e);
        }
      }}
      // Only forward onLoadEnd once we're actually on the "full" stage —
      // this prop exists purely as a cache-hit safety net (a fully-cached
      // image can paint without onLoad firing), not as a per-stage signal.
      // Forwarding it unconditionally meant the blur stage's near-instant
      // onLoadEnd cleared the caller's skeleton (see MediaCarousel.jsx)
      // long before the medium/full stages had actually replaced it,
      // exposing the raw blur→medium swap with no placeholder covering it.
      onLoadEnd={(e) => {
        if (stage === "full") onLoadEnd?.(e);
      }}
      onError={onError}
    />
  );
}