import { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import COLORS from "../../../shared/theme/colors";

// ─────────────────────────────────────────────────────────────────────────
// Skeleton loader — shown while the parent is still fetching comments.
//
// Uses the plain RN Animated API (same as feed/components/SkeletonCard),
// not react-native-reanimated. The old reanimated-worklet version could
// silently no-op if the worklets babel plugin wasn't picked up for this
// file, leaving the bars stuck flat instead of pulsing — this avoids that
// failure mode entirely.
// ─────────────────────────────────────────────────────────────────────────

export function SkeletonRow({ delay = 0 }) {
  const bg = COLORS.surfaceGray;
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.75,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    const id = setTimeout(() => loop.start(), delay);

    return () => {
      clearTimeout(id);
      loop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-row px-[16px] py-[10px]">
      <Animated.View
        style={{
          opacity: pulseAnim,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: bg,
        }}
      />
      <View className="flex-1 ml-[10px]">
        <Animated.View
          style={{
            opacity: pulseAnim,
            width: "38%",
            height: 11,
            borderRadius: 4,
            backgroundColor: bg,
          }}
        />
        <Animated.View
          style={{
            opacity: pulseAnim,
            width: "82%",
            height: 12,
            borderRadius: 4,
            backgroundColor: bg,
            marginTop: 8,
          }}
        />
        <Animated.View
          style={{
            opacity: pulseAnim,
            width: "54%",
            height: 12,
            borderRadius: 4,
            backgroundColor: bg,
            marginTop: 5,
          }}
        />
      </View>
    </View>
  );
}