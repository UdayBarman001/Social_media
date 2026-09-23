import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import COLORS from "../theme/colors";

/**
 * Absolute-fill shimmer placeholder, meant to sit on top of an expo-image
 * while it's still loading (via its onLoadStart/onLoadEnd/onError
 * callbacks) and fade out once real content is ready.
 *
 * This replaces a flat, static grey box: the plain backgroundColor fix
 * killed the "transparent hole" bug (a real image not yet fetched showing
 * whatever sat behind the card), but a static box still reads as "did this
 * just stall?" on a slow connection. A pulsing shimmer is the same visual
 * language used everywhere else already-loading content is shown in this
 * app (see SkeletonCard.jsx, SkeletonRow.jsx) — this is that same pattern,
 * sized to whatever box it's dropped into instead of a fixed card shape.
 *
 * Plain Animated (not Reanimated) is used here deliberately: this lives
 * inside PostCard, and native-driver Animated (already used for every
 * other micro-interaction in PostCard — likeScaleAnim, burstAnim, etc.)
 * keeps this off the JS thread just as well without pulling in a second
 * animation library for one pulse.
 */
export default function ImageSkeleton({ visible, style }) {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;
  const loopRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      // If a loop was already running (visible just flipped true -> false
      // mid-pulse), stop it and reset the value back to the base dim
      // state. Without this, a skeleton that later becomes visible again
      // (e.g. onError re-shows it after a retry) could otherwise pick up
      // mid-animation from wherever the previous run's .stop() froze it.
      loopRef.current?.stop();
      pulseAnim.setValue(0.35);
      return undefined;
    }
    // Reset to the base dim value before every (re)start, since a prior
    // .stop() call can freeze pulseAnim mid-cycle. Without this reset, the
    // first sequence step (animate toward 0.85) can start from a value
    // already near 0.85, which reads as the shimmer freezing for the
    // first ~650ms before it visibly moves again.
    pulseAnim.setValue(0.35);
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    loopRef.current.start();
    return () => loopRef.current?.stop();
  }, [visible, pulseAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: COLORS.dividerLight, opacity: pulseAnim },
        style,
      ]}
    />
  );
}