import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, ScrollView, Animated, Dimensions } from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ImageSkeleton from "../../../shared/ui/ImageSkeleton";
import ImageLightbox from "../../../shared/ui/ImageLightbox";
import COLORS from "../../../shared/theme/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_HPAD = 72; // Horizontal padding (mx-4 = 16px each side)

function getMappingKey(item, index) {
  return `${item}-${index}`;
}

/**
 * PostCardMedia: Renders paged horizontal image carousel with skeleton placeholders,
 * pagination indicators, double-tap leaf burst animation, and lightbox integration.
 */
const PostCardMedia = memo(function PostCardMedia({
  postId,
  images,
  primaryImageUri,
  burstAnim,
  isLiked,
  onLike,
  triggerImageTap,
}) {
  const mediaList = useMemo(() => {
    if (images && images.length > 0) return images;
    if (primaryImageUri) return [primaryImageUri];
    return [];
  }, [images, primaryImageUri]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loadedImages, setLoadedImages] = useState(() => new Set());
  const prevPostIdRef = useRef(postId);

  // FlashList recycling: reset media view state when slot is recycled
  useLayoutEffect(() => {
    if (prevPostIdRef.current !== postId) {
      prevPostIdRef.current = postId;
      setLoadedImages(new Set());
      setActiveImageIndex(0);
      setLightboxOpen(false);
    }
  }, [postId]);

  const markImageLoaded = useCallback(
    (uri) =>
      setLoadedImages((prev) =>
        prev.has(uri) ? prev : new Set(prev).add(uri),
      ),
    [],
  );

  const handleOpenLightbox = useCallback(() => setLightboxOpen(true), []);
  const handleCloseLightbox = useCallback(() => setLightboxOpen(false), []);

  const handleImageTap = useCallback(() => {
    triggerImageTap?.({
      isLiked,
      onLike,
      onOpenLightbox: handleOpenLightbox,
    });
  }, [triggerImageTap, isLiked, onLike, handleOpenLightbox]);

  if (mediaList.length === 0) return null;

  return (
    <>
      <View className="mx-4 mb-3 rounded-xl overflow-hidden">
        <ScrollView
          key={postId}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - CARD_HPAD),
            );
            setActiveImageIndex(idx);
          }}
        >
          {mediaList.map((uri, i) => (
            <Pressable
              key={getMappingKey(uri, i)}
              onPress={handleImageTap}
              style={{
                position: "relative",
                height: 240,
                width: SCREEN_WIDTH - CARD_HPAD,
              }}
            >
              <Image
                source={{ uri }}
                style={{
                  width: SCREEN_WIDTH - CARD_HPAD,
                  height: 240,
                  backgroundColor: COLORS.surfaceGray,
                }}
                contentFit="cover"
                priority={i === 0 ? "high" : "normal"}
                recyclingKey={`${postId}-${uri}`}
                cachePolicy="memory-disk"
                transition={150}
                onLoad={() => markImageLoaded(uri)}
                onError={() => markImageLoaded(uri)}
                onLoadEnd={() => markImageLoaded(uri)}
              />
              <ImageSkeleton
                visible={!loadedImages.has(uri)}
                style={{
                  position: "absolute",
                  width: SCREEN_WIDTH - CARD_HPAD,
                  height: 240,
                }}
              />
            </Pressable>
          ))}
        </ScrollView>

        {mediaList.length > 1 && (
          <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
            {mediaList.map((uri, i) => (
              <View
                key={getMappingKey(`dot-${uri}`, i)}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor:
                    i === activeImageIndex
                      ? "#fff"
                      : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </View>
        )}

        {mediaList.length > 1 && (
          <Pressable
            onPress={() => setLightboxOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`View all ${mediaList.length} images`}
            className="absolute top-[10px] right-[10px] bg-[rgba(0,0,0,0.45)] rounded-xl w-6 h-6 items-center justify-center"
          >
            <MaterialCommunityIcons
              name="image-multiple"
              size={14}
              color="#fff"
            />
          </Pressable>
        )}

        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            marginLeft: -28,
            marginTop: -28,
            opacity: burstAnim.interpolate({
              inputRange: [0, 0.15, 1],
              outputRange: [0, 1, 0],
            }),
            transform: [
              {
                scale: burstAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1.8],
                }),
              },
            ],
          }}
        >
          <MaterialCommunityIcons name="leaf" size={56} color="#fff" />
        </Animated.View>
      </View>

      <ImageLightbox
        visible={lightboxOpen}
        images={mediaList}
        initialIndex={activeImageIndex}
        onClose={handleCloseLightbox}
      />
    </>
  );
});

export default PostCardMedia;
