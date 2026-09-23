import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Dimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

const SCREEN_HEIGHT = Dimensions.get("window").height;

// Same spring config CommentSheet uses for both the settle-back-open and
// the initial open animation.
const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

// Same flick threshold CommentSheet uses — a fast-enough downward flick
// dismisses regardless of how far the sheet has actually traveled.
const DISMISS_VELOCITY = 900; // px/s

// Same fraction of the sheet's height CommentSheet uses to decide whether
// a drag that ends mid-way (not a flick) has gone far enough to dismiss.
const DISMISS_DISTANCE_FRACTION = 0.28;

// Same rubber-banding factor CommentSheet applies when the user drags
// upward past the resting position (translateY < 0).
const OVERDRAG_RESISTANCE = 0.15;

/**
 * Drag-to-dismiss mechanics extracted from CommentSheet.jsx so other bottom
 * sheets can reuse the exact same feel — same spring/timing constants, same
 * velocity + distance thresholds, same overdrag rubber-banding — without
 * duplicating the gesture code.
 *
 * CommentSheet has a fixed, known-up-front SHEET_HEIGHT, so its off-screen
 * resting position and its dismiss-distance threshold are both derived
 * from that one constant. MenuSheet and EditProfileSheet size themselves
 * to their content instead, so this hook takes a measured `contentHeight`
 * (wire a sheet's outer View's onLayout to setContentHeight) and:
 *   - always parks the sheet fully off-screen at SCREEN_HEIGHT (guaranteed
 *     taller than any sheet's content, so this is a drop-in replacement
 *     for CommentSheet's `translateY.value = SHEET_HEIGHT` resets), and
 *   - derives DISMISS_DISTANCE from contentHeight once it's known, falling
 *     back to a reasonable pre-layout estimate so the very first frame
 *     (before onLayout fires) still has a sane threshold.
 *
 * @param {boolean} visible
 * @param {() => void} onClose - called once the close animation finishes
 * @param {number} [contentHeight] - measured sheet height, once known
 * @param {boolean} [disabled] - when true the pan gesture is inert (e.g.
 *   EditProfileSheet's "don't allow dismiss while saving" requirement) —
 *   tap-backdrop-to-close is a separate concern and is left to the caller
 * @param {number} [maxBackdropOpacity] - each sheet keeps its own backdrop
 *   darkness (MenuSheet/EditProfileSheet didn't match CommentSheet's 0.55)
 */
export function useDragToDismiss({
  visible,
  onClose,
  contentHeight,
  disabled = false,
  maxBackdropOpacity = 0.55,
}) {
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropProgress = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  const dismissDistance =
    (contentHeight || SCREEN_HEIGHT * 0.5) * DISMISS_DISTANCE_FRACTION;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const doClose = useCallback(() => {
    onCloseRef.current?.();
  }, []);

  const animateOpen = useCallback(() => {
    translateY.value = reduceMotion
      ? withTiming(0, { duration: 120 })
      : withSpring(0, SPRING);
    backdropProgress.value = withTiming(1, { duration: 220 });
  }, [translateY, backdropProgress, reduceMotion]);

  const animateClose = useCallback(
    (onDone) => {
      const duration = reduceMotion ? 100 : 200;
      translateY.value = withTiming(SCREEN_HEIGHT, { duration }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      });
      backdropProgress.value = withTiming(0, { duration: Math.max(duration - 20, 80) });
    },
    [translateY, backdropProgress, reduceMotion],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = SCREEN_HEIGHT;
      backdropProgress.value = 0;
      requestAnimationFrame(animateOpen);
    } else if (mounted) {
      animateClose(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleClose = useCallback(() => {
    animateClose(doClose);
  }, [animateClose, doClose]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .onStart(() => {
          dragStartY.value = translateY.value;
        })
        .onUpdate((e) => {
          const next = dragStartY.value + e.translationY;
          translateY.value = next < 0 ? next * OVERDRAG_RESISTANCE : next;
          backdropProgress.value = interpolate(
            translateY.value,
            [0, contentHeight || SCREEN_HEIGHT * 0.5],
            [1, 0],
            Extrapolation.CLAMP,
          );
        })
        .onEnd((e) => {
          const shouldDismiss =
            translateY.value > dismissDistance || e.velocityY > DISMISS_VELOCITY;
          if (shouldDismiss) {
            translateY.value = withTiming(SCREEN_HEIGHT, { duration: 180 }, (finished) => {
              if (finished) runOnJS(doClose)();
            });
            backdropProgress.value = withTiming(0, { duration: 160 });
          } else {
            translateY.value = withSpring(0, SPRING);
            backdropProgress.value = withTiming(1, { duration: 160 });
          }
        }),
    [translateY, backdropProgress, dragStartY, doClose, disabled, dismissDistance, contentHeight],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(backdropProgress.value, [0, 1], [0, maxBackdropOpacity], Extrapolation.CLAMP),
  }));

  return { mounted, reduceMotion, panGesture, sheetStyle, backdropStyle, handleClose };
}