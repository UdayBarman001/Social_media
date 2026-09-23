import { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Pressable,
  Text,
  ScrollView,
  Dimensions,
  StatusBar,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import ProgressiveImage from "./ProgressiveImage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * Fullscreen swipeable image viewer.
 *
 * Usage:
 *   <ImageLightbox
 *     visible={lightboxOpen}
 *     images={["uri1", "uri2"]}
 *     initialIndex={0}
 *     onClose={() => setLightboxOpen(false)}
 *   />
 */
export default function ImageLightbox({
  visible,
  images = [],
  initialIndex = 0,
  onClose,
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setActiveIndex(initialIndex);
      // Jump to the tapped image without animating from index 0.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          x: initialIndex * SCREEN_WIDTH,
          animated: false,
        });
      });
    }
  }, [visible, initialIndex]);

  if (!images || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar barStyle="light-content" />

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x / SCREEN_WIDTH
            );
            setActiveIndex(idx);
          }}
        >
          {images.map((uri, i) => (
            <View
              key={i}
              style={{
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ProgressiveImage
                uri={uri}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                contentFit="contain"
                crop={false}
                // The lightbox is the one place someone is deliberately
                // looking closely at the image — worth prioritizing its
                // "full" stage's fetch over anything else competing for
                // bandwidth at that moment.
                priority="high"
              />
            </View>
          ))}
        </ScrollView>

        {/* Close button */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close image viewer"
          style={{
            position: "absolute",
            top: 48,
            right: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.15)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="x" size={22} color="#fff" />
        </Pressable>

        {/* Index counter */}
        {images.length > 1 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 56,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                {activeIndex + 1} / {images.length}
              </Text>
            </View>
          </View>
        )}

        {/* Dots */}
        {images.length > 1 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: 40,
              left: 0,
              right: 0,
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {images.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor:
                    i === activeIndex ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}