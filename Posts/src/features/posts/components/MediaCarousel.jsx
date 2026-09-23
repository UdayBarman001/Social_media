import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import ImageSkeleton from "../../../shared/ui/ImageSkeleton";
import COLORS from "../../../shared/theme/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const MEDIA_WIDTH = SCREEN_WIDTH - 32;
const MEDIA_HEIGHT = 320;

/** Paged, swipeable image carousel for a post's media. Taps open the
 *  lightbox at the tapped index via `onOpenLightbox`.
 *
 *  Renders a plain expo-image `<Image source={{uri}}/>` + `ImageSkeleton`
 *  overlay — the exact same pair PostCard.jsx's own carousel uses for the
 *  feed (same props: contentFit, priority, recyclingKey, cachePolicy,
 *  transition, and onLoad/onError/onLoadEnd all clearing the skeleton
 *  directly) — not the ProgressiveImage blur→medium→full pipeline this
 *  used before. That pipeline made 3 sequential network requests per
 *  image, but ImageSkeleton sat on top of *all three* stages and only
 *  cleared once the final "full" stage finished, so none of the
 *  intermediate blur/medium previews were ever visible — post detail's
 *  images looked like they took 3x longer to load than the identical
 *  image already showing in the feed, which loads with one request. This
 *  now matches the feed's loading behavior exactly, not a separate,
 *  slower code path for the same image. */
export default function MediaCarousel({ media, onOpenLightbox }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState(() => new Set());
  const markLoaded = useCallback(
    (uri) =>
      setLoadedImages((prev) => (prev.has(uri) ? prev : new Set(prev).add(uri))),
    []
  );

  if (!media.length) return null;

  return (
    <View className="mb-3 overflow-hidden rounded-2xl">
      <ScrollView
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={MEDIA_WIDTH}
        snapToAlignment="center"
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / MEDIA_WIDTH);
          setActiveIndex(idx);
        }}
      >
        {media.map((uri, i) => (
          <Pressable
            key={`${uri}-${i}`}
            onPress={() => onOpenLightbox(i)}
            className="active:opacity-[0.92]"
            style={{ position: "relative", width: MEDIA_WIDTH, height: MEDIA_HEIGHT }}
          >
            <Image
              source={{ uri }}
              // Same instant-paint fallback PostCard's carousel uses for
              // the gap before the fetch completes — this box had no
              // background before, so a first-ever view of this post
              // (nothing cached yet) briefly showed whatever sat behind
              // it instead of a neutral surface.
              style={{
                width: MEDIA_WIDTH,
                height: MEDIA_HEIGHT,
                backgroundColor: COLORS.surfaceGray,
              }}
              contentFit="cover"
              // Matches PostCard: first image is the one actually visible
              // the instant this screen mounts, the rest are a swipe away.
              priority={i === 0 ? "high" : "normal"}
              recyclingKey={uri}
              cachePolicy="memory-disk"
              transition={150}
              onLoad={() => markLoaded(uri)}
              onError={() => markLoaded(uri)}
              // Cache-hit safety net — see PostCard.jsx's identical
              // onLoadEnd comment: a cached image can paint natively
              // without onLoad ever firing, which would otherwise leave
              // this skeleton stuck on-screen forever over a fully
              // loaded photo.
              onLoadEnd={() => markLoaded(uri)}
            />
            <ImageSkeleton
              visible={!loadedImages.has(uri)}
              style={{ position: "absolute", width: MEDIA_WIDTH, height: MEDIA_HEIGHT }}
            />
          </Pressable>
        ))}
      </ScrollView>


      {media.length > 1 && (
        <>
          <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
            {media.map((uri, i) => (
              <View
                key={`dot-${uri}-${i}`}
                className={`rounded-full h-[6px] ${i === activeIndex ? "w-[18px]" : "w-[6px]"}`}
                // Translucent white overlay with no config token — a
                // one-off badge/indicator tint, not a reusable design
                // token (see rule in the task doc). Also: this codebase
                // has already tried bg-white/[opacity] elsewhere
                // (ProfileScreen.jsx cover overlays) and reverted it —
                // NativeWind v4 here doesn't reliably support stacked
                // arbitrary color+opacity modifiers, so it silently
                // dropped the styling. Keeping this inline avoids
                // repeating that bug.
                style={{
                  backgroundColor: i === activeIndex ? "#fff" : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </View>
          <View
            className="absolute top-3 right-3 rounded-lg w-7 h-7 items-center justify-center"
            // One-off translucent black badge overlay, not a reusable
            // design token. Note this can't safely become bg-black/50
            // either: the project's "black" config token is #1A181B (a
            // near-black charcoal, not pure #000000), and since
            // theme.extend.colors.black overrides Tailwind's own default
            // black, bg-black/50 would tint this a warmer near-black
            // rather than reproduce this literal rgba(0,0,0,0.5). Keeping
            // it inline preserves the exact original color.
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <MaterialCommunityIcons name="image-multiple" size={14} color="#fff" />
            <Text className="absolute font-poppins-sb text-[9px] text-white mt-px">
              {media.length}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}