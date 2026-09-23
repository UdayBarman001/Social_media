import { useRef, useEffect, useCallback } from "react";
import { Animated } from "react-native";

/**
 * Encapsulates micro-interaction spring animations, double-tap like detection,
 * and leaf burst effects for PostCard.
 *
 * Animated.Value instances use native drivers and can be reused safely across
 * FlashList recycled cells since each sequence resets before playback.
 */
export function usePostAnimations() {
  const likeScaleAnim = useRef(new Animated.Value(1)).current;
  const commentScaleAnim = useRef(new Animated.Value(1)).current;
  const followScaleAnim = useRef(new Animated.Value(1)).current;
  const shareScaleAnim = useRef(new Animated.Value(1)).current;
  const bookmarkScaleAnim = useRef(new Animated.Value(1)).current;
  const menuScaleAnim = useRef(new Animated.Value(1)).current;
  const burstAnim = useRef(new Animated.Value(0)).current;

  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  const playLikePressIn = useCallback(() => {
    likeScaleAnim.stopAnimation();
    Animated.spring(likeScaleAnim, {
      toValue: 0.82,
      friction: 6,
      tension: 240,
      useNativeDriver: true,
    }).start();
  }, [likeScaleAnim]);

  const playLikeBounce = useCallback(() => {
    likeScaleAnim.stopAnimation();
    likeScaleAnim.setValue(0.72);
    Animated.spring(likeScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 3.5,
      tension: 180,
    }).start();
  }, [likeScaleAnim]);

  const playCommentBounce = useCallback(() => {
    commentScaleAnim.setValue(1);
    Animated.sequence([
      Animated.spring(commentScaleAnim, {
        toValue: 1.3,
        useNativeDriver: true,
        speed: 50,
        bounciness: 8,
      }),
      Animated.spring(commentScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
    ]).start();
  }, [commentScaleAnim]);

  const playShareBounce = useCallback(() => {
    shareScaleAnim.setValue(1);
    Animated.sequence([
      Animated.spring(shareScaleAnim, {
        toValue: 1.25,
        useNativeDriver: true,
        speed: 50,
        bounciness: 8,
      }),
      Animated.spring(shareScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
    ]).start();
  }, [shareScaleAnim]);

  const playBookmarkBounce = useCallback(() => {
    bookmarkScaleAnim.setValue(1);
    Animated.sequence([
      Animated.spring(bookmarkScaleAnim, {
        toValue: 1.25,
        useNativeDriver: true,
        speed: 50,
        bounciness: 8,
      }),
      Animated.spring(bookmarkScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
    ]).start();
  }, [bookmarkScaleAnim]);

  const playMenuBounce = useCallback(() => {
    menuScaleAnim.setValue(1);
    Animated.sequence([
      Animated.spring(menuScaleAnim, {
        toValue: 1.2,
        useNativeDriver: true,
        speed: 50,
        bounciness: 8,
      }),
      Animated.spring(menuScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
    ]).start();
  }, [menuScaleAnim]);

  const playFollowPressIn = useCallback(() => {
    Animated.spring(followScaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 6,
    }).start();
  }, [followScaleAnim]);

  const playFollowPressOut = useCallback(() => {
    Animated.spring(followScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 6,
    }).start();
  }, [followScaleAnim]);

  const playBurst = useCallback(() => {
    burstAnim.setValue(0);
    Animated.timing(burstAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [burstAnim]);

  const handleImageTap = useCallback(
    ({ isLiked, onLike, onOpenLightbox }) => {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        if (!isLiked) onLike?.();
        playBurst();
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        onOpenLightbox?.();
      }, 280);
    },
    [playBurst]
  );

  return {
    likeScaleAnim,
    commentScaleAnim,
    followScaleAnim,
    shareScaleAnim,
    bookmarkScaleAnim,
    menuScaleAnim,
    burstAnim,
    playLikePressIn,
    playLikeBounce,
    playCommentBounce,
    playShareBounce,
    playBookmarkBounce,
    playMenuBounce,
    playFollowPressIn,
    playFollowPressOut,
    playBurst,
    handleImageTap,
  };
}
