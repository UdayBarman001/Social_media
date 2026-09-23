import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  Platform,
  BackHandler,
  AccessibilityInfo,
  Keyboard,
} from "react-native";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useSheetPortal } from "../../../shared/components/SheetHost";
import { SkeletonRow } from "./SkeletonRow";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import COLORS from "../../../shared/theme/colors";
import { CommentRow } from "./CommentRow";
import { CommentComposer } from "./CommentComposer";
import { nestComments } from "../utils/nestComments";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;
const DISMISS_DISTANCE = SHEET_HEIGHT * 0.28; // drag-down distance that counts as "let go"
const DISMISS_VELOCITY = 900; // px/s flick that counts as "let go" regardless of distance

const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

// A resend within this window is treated as a duplicate tap rather than a
// genuinely new comment — see handleSend below.
const DUPLICATE_SEND_WINDOW_MS = 500;

// ─────────────────────────────────────────────────────────────────────────
// Main sheet
// ─────────────────────────────────────────────────────────────────────────

export default function CommentSheet({
  visible,
  onClose,
  comments = [],
  onSubmit,
  onLikeComment,
  // Accepted for backward compatibility with existing call sites, but
  // intentionally unused: the composer is decoupled from network state.
  // The button is never disabled and never shows a spinner just because a
  // request is in flight — per-row "sending…" state (see CommentRow's
  // isPending) is where submission feedback belongs, so multiple comments
  // can be sent back to back without waiting on a round trip.
  submitting = false,
  // Optional — a parent can pass these to get real loading/error states.
  // Both default to "off" so existing call sites work unchanged.
  loading = false,
  error = null,
  onRetryLoad,
  // Optional — called with a failed comment (comment.failed === true) when
  // the user taps "Retry". Comments never carry `failed` unless the parent
  // sets it, so this path is inert until a caller opts in.
  onRetryComment,
  // Three-dot "…" menu — mirrors PostDetailScreen's comment menu. Optional
  // so existing call sites without it simply don't render the button (see
  // CommentRow's `onOpenMenu &&` guard).
  onOpenMenu,
  // Inline-edit passthrough — parent owns which comment is being edited
  // and its draft text, same shape as PostDetailScreen's own state.
  editingCommentId,
  editText,
  onChangeEditText,
  onSaveEdit,
  onCancelEdit,
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Track live keyboard height so the FlatList's bottom padding always
  // reserves exactly enough room for the composer + the open keyboard.
  // useReanimatedKeyboardAnimation gives us a shared value that animates
  // in sync with the native keyboard frame — no JS-thread polling needed.
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

  const [replyingTo, setReplyingTo] = useState(null);
  const [localReactions, setLocalReactions] = useState({}); // id -> { reaction, likeCount, dislikeCount }
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);

  const translateY = useSharedValue(SHEET_HEIGHT);
  const backdropProgress = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  // ── Reduced-motion preference ──────────────────────────────────────────
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(setReduceMotion)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => sub?.remove?.();
  }, []);

  // ── Open / close orchestration ─────────────────────────────────────────
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const doClose = useCallback(() => {
    inputRef.current?.blur();
    setReplyingTo(null);
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
      translateY.value = withTiming(SHEET_HEIGHT, { duration }, (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      });
      backdropProgress.value = withTiming(0, {
        duration: Math.max(duration - 20, 80),
      });
    },
    [translateY, backdropProgress, reduceMotion],
  );

  useEffect(() => {
    if (visible) {
      // Dismiss any keyboard that's already open from wherever the user
      // tapped from (a search bar elsewhere on the feed, another comment
      // sheet, etc.) before this sheet's own composer even mounts. Without
      // this, a keyboard that's still mid-close-animation from a
      // previously focused input collides with this sheet's own open
      // animation + the comments loading skeleton — Android draws a native
      // blur/dim over content while a keyboard resize-transition is in
      // flight, and with two transitions overlapping, that blur visibly
      // smears across the newly-mounted composer/send button. Forcing any
      // stray keyboard closed first removes the overlap entirely; this
      // sheet's own composer never opens a keyboard on mount (only on
      // Reply/Send/focus — see the .focus() call sites elsewhere in this
      // file), so this can't cut off a keyboard the sheet itself wanted.
      Keyboard.dismiss();
      setMounted(true);
      translateY.value = SHEET_HEIGHT;
      backdropProgress.value = 0;
      requestAnimationFrame(animateOpen);
    } else if (mounted) {
      inputRef.current?.blur();
      animateClose(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== "android" || !visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleClose = useCallback(() => {
    animateClose(doClose);
  }, [animateClose, doClose]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          dragStartY.value = translateY.value;
        })
        .onUpdate((e) => {
          const next = dragStartY.value + e.translationY;
          translateY.value = next < 0 ? next * 0.15 : next;
          backdropProgress.value = interpolate(
            translateY.value,
            [0, SHEET_HEIGHT],
            [1, 0],
            Extrapolation.CLAMP,
          );
        })
        .onEnd((e) => {
          const shouldDismiss =
            translateY.value > DISMISS_DISTANCE ||
            e.velocityY > DISMISS_VELOCITY;
          if (shouldDismiss) {
            translateY.value = withTiming(
              SHEET_HEIGHT,
              { duration: 180 },
              (finished) => {
                if (finished) runOnJS(doClose)();
              },
            );
            backdropProgress.value = withTiming(0, { duration: 160 });
          } else {
            translateY.value = withSpring(0, SPRING);
            backdropProgress.value = withTiming(1, { duration: 160 });
          }
        }),
    [translateY, backdropProgress, dragStartY, doClose],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      backdropProgress.value,
      [0, 1],
      [0, 0.55],
      Extrapolation.CLAMP,
    ),
  }));

  useEffect(() => {
    if (visible) setLocalReactions({});
  }, [visible]);

  const reactionFor = useCallback(
    (c) => localReactions[c.id]?.reaction ?? (c.likedByMe ? "like" : undefined),
    [localReactions],
  );
  const likeCountFor = useCallback(
    (c) => localReactions[c.id]?.likeCount ?? c.likeCount ?? 0,
    [localReactions],
  );
  const dislikeCountFor = useCallback(
    (c) => localReactions[c.id]?.dislikeCount ?? c.dislikeCount ?? 0,
    [localReactions],
  );

  const reactionEpochRef = useRef({});

  // type: 'like' | 'dislike'. Same tri-state toggle as
  // PostDetailScreen.jsx's handleReactToComment: tapping the reaction
  // you already have clears it, tapping the other one switches to it and
  // moves both counters in the same update.
  const handleReact = useCallback(
    (comment, type) => {
      const current = reactionFor(comment);
      const nextReaction = current === type ? "none" : type;
      // Captured as plain values *before* the optimistic update below —
      // reading them back out of localReactions inside the catch (after
      // setLocalReactions has already run) would return the already-
      // updated numbers, making the "rollback" a no-op instead of an
      // actual revert.
      const originalLikeCount = likeCountFor(comment);
      const originalDislikeCount = dislikeCountFor(comment);
      let likeCount = originalLikeCount;
      let dislikeCount = originalDislikeCount;
      if (current === "like") likeCount = Math.max(0, likeCount - 1);
      if (current === "dislike") dislikeCount = Math.max(0, dislikeCount - 1);
      if (nextReaction === "like") likeCount += 1;
      if (nextReaction === "dislike") dislikeCount += 1;

      const epoch = (reactionEpochRef.current[comment.id] || 0) + 1;
      reactionEpochRef.current[comment.id] = epoch;
      setLocalReactions((prev) => ({
        ...prev,
        [comment.id]: { reaction: nextReaction === "none" ? undefined : nextReaction, likeCount, dislikeCount },
      }));

      Promise.resolve(onLikeComment?.(comment.id, nextReaction)).catch(() => {
        if (reactionEpochRef.current[comment.id] !== epoch) return;
        setLocalReactions((prev) => ({
          ...prev,
          [comment.id]: {
            reaction: current,
            likeCount: originalLikeCount,
            dislikeCount: originalDislikeCount,
          },
        }));
      });
    },
    [reactionFor, likeCountFor, dislikeCountFor, onLikeComment],
  );

  const handleReply = useCallback((comment) => {
    setReplyingTo(comment);
    inputRef.current?.focus();
  }, []);

  // Builds the two-level (top-level + replies) thread tree from the flat
  // list — not relied on from the backend or the parent screen, so the
  // sheet shows the right shape regardless of what order `comments`
  // arrives in, and stays correct the instant an optimistic comment
  // (today's Date.now()-based createdAt) is appended by the parent.
  const topLevelComments = useMemo(() => nestComments(comments), [comments]);

  // { name, id } for every author in this thread — the id is what lets a
  // mention hyperlink to a real profile instead of just being colored
  // text (see mention.js / CommentText.jsx).
  const authorNames = useMemo(
    () =>
      comments
        .map((c) => ({ name: c.authorName || c.author, id: c.author }))
        .filter((a) => a.name),
    [comments],
  );

  // Tapping an @mention navigates straight to that author's profile,
  // Instagram-style, then closes the sheet behind it (matching how any
  // other profile-press elsewhere in the app leaves the sheet it was
  // opened from).
  const handleMentionPress = useCallback(
    (authorId) => {
      if (!authorId) return;
      handleClose();
      router.push(`/profile/${authorId}`);
    },
    [handleClose, router],
  );

  // Same "close then navigate" behavior as handleMentionPress above,
  // for tapping a comment's avatar/name instead of an @mention. Passed
  // down as CommentRow's onProfilePress — without it, CommentRow falls
  // back to a plain navigate that leaves this sheet open behind the
  // profile screen.
  const handleProfilePress = useCallback(
    (authorId) => {
      if (!authorId) return;
      handleClose();
      router.push(`/profile/${authorId}`);
    },
    [handleClose, router],
  );

  const commentsReady = !(loading && comments.length === 0);
  const lastSentRef = useRef({ text: "", replyId: null, time: 0 });
  const pendingAutoScrollRef = useRef(false);

  const handleSend = useCallback(
    (trimmed, target) => {
      const replyId = target?.id ?? target?.threadRootId ?? null;
      const now = Date.now();
      const isDuplicateTap =
        lastSentRef.current.text === trimmed &&
        lastSentRef.current.replyId === replyId &&
        now - lastSentRef.current.time < DUPLICATE_SEND_WINDOW_MS;
      if (isDuplicateTap) return;
      lastSentRef.current = { text: trimmed, replyId, time: now };

      pendingAutoScrollRef.current = !target;
      onSubmit?.(trimmed, target);
      setReplyingTo(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
    [onSubmit]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <CommentRow
        comment={item}
        reactionFor={reactionFor}
        likeCountFor={likeCountFor}
        dislikeCountFor={dislikeCountFor}
        onReact={handleReact}
        onReply={handleReply}
        onRetry={onRetryComment}
        onMentionPress={handleMentionPress}
        onOpenMenu={onOpenMenu}
        onProfilePress={handleProfilePress}
        authors={authorNames}
        reduceMotion={reduceMotion}
        editingCommentId={editingCommentId}
        editText={editText}
        onChangeEditText={onChangeEditText}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
      />
    ),
    [
      reactionFor,
      likeCountFor,
      dislikeCountFor,
      handleReact,
      handleReply,
      onRetryComment,
      handleMentionPress,
      onOpenMenu,
      handleProfilePress,
      authorNames,
      reduceMotion,
      editingCommentId,
      editText,
      onChangeEditText,
      onSaveEdit,
      onCancelEdit,
    ],
  );

  const keyExtractor = useCallback((item) => String(item.id), []);

  const handleScrollToIndexFailed = useCallback((info) => {
    listRef.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: true,
    });
  }, []);

  // Was scrollToEnd() — correct when new comments were appended at the
  // bottom (oldest-first order). Now that the sheet sorts newest-on-top
  // (see topLevelComments above), a new top-level comment lands at the
  // START of the list, not the end, so scroll there instead (replies skip
  // this entirely — see the pendingAutoScrollRef assignment in handleSend).
  const handleListContentSizeChange = useCallback(() => {
    if (!pendingAutoScrollRef.current) return;
    pendingAutoScrollRef.current = false;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, []);

  const composerBarHeight =
    40 + 20 + Math.max(insets.bottom, 10) + (replyingTo ? 34 : 0);
  const listBottomPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: composerBarHeight + Math.abs(keyboardHeight.value),
  }));
  // FIX: the previous version passed this same padding logic via
  // `contentContainerAnimatedStyle={listBottomPaddingStyle}` on the
  // Animated.FlatList below. That prop does not exist anywhere in
  // react-native-reanimated's API — there is no supported way to animate
  // FlatList's contentContainerStyle directly, and an unrecognized prop
  // on a host component is silently dropped by React Native. So the
  // dynamic bottom padding meant to keep the last few comments visible
  // above the keyboard/composer was never actually being applied —
  // comments near the bottom could end up hidden behind the composer once
  // the keyboard opened. A ListFooterComponent spacer, sized by the same
  // shared value, is the actually-supported way to get an animated bottom
  // inset on a FlatList — see footerSpacerStyle + ListFooterComponent
  // below.
  const footerSpacerStyle = useAnimatedStyle(() => ({
    height: composerBarHeight + Math.abs(keyboardHeight.value),
  }));

  const sheetId = useId();

  const sheetContent = mounted ? (
    <>
      <Pressable
        onPress={handleClose}
        className="absolute inset-0"
        accessibilityLabel="Close comments"
        accessibilityRole="button"
      >
        {/* Animated.View is not in react-native-css-interop's registered
            component list (neither RN core's Animated nor Reanimated's
            wrapper is) — className is a no-op here, so the whole style,
            including the static backgroundColor, has to stay inline
            together with the animated opacity. */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#0F1710",
            },
            backdropStyle,
          ]}
        />
      </Pressable>

      {/* Animated.View again — same reason as the backdrop above, this
          whole style object (including the shadow/elevation pair, which
          per rule 2 stays inline as one unit regardless) has to stay
          inline since the component isn't className-registered and the
          transform is shared-value-driven. */}
      <Animated.View
        style={[
          sheetStyle,
          {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: COLORS.surfaceWhite,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: SCREEN_HEIGHT * 0.9,
            height: SHEET_HEIGHT,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.14,
            shadowRadius: 22,
            elevation: 24,
            overflow: "hidden",
          },
        ]}
      >
        <GestureDetector gesture={panGesture}>
          <View>
            <View
              className="w-[40px] h-[4px] rounded-[2px] bg-borderDefault self-center mt-[10px] mb-[6px]"
            />
            <View
              className="flex-row items-center justify-between px-[18px] pb-[12px] border-b border-b-dividerLight"
            >
              <Text
                className="text-[15px] font-poppins-sb text-textPrimary"
                accessibilityRole="header"
              >
                Comments{comments.length > 0 ? ` (${comments.length})` : ""}
              </Text>
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                className="w-[30px] h-[30px] rounded-[15px] items-center justify-center bg-surfaceGray"
                accessibilityRole="button"
                accessibilityLabel="Close comments"
              >
                <Feather name="x" size={16} color={COLORS.iconLight} />
              </Pressable>
            </View>
          </View>
        </GestureDetector>

        {/* Guard on comments.length here too, not just `loading` — the
            screenshot that prompted this showed "Comments (9)" in the
            header (comments.length is real, non-zero data) while the body
            still rendered skeletons forever. Header count and this branch
            read two different props (comments vs loading); if whatever
            manages `loading` upstream doesn't clear it reliably, this
            sheet has no way to know that from `loading` alone. Once
            comments have actually arrived, always show them — a stale
            `loading=true` should never be able to hide data the sheet is
            already holding. */}
        {loading && comments.length === 0 ? (
          <Animated.View
            style={[{ paddingTop: 8 }, listBottomPaddingStyle]}
            entering={reduceMotion ? undefined : FadeIn.duration(160)}
            exiting={reduceMotion ? undefined : FadeOut.duration(120)}
            layout={
              reduceMotion
                ? undefined
                : LinearTransition.springify().damping(24)
            }
          >
            {[0, 1, 2, 3].map((i) => (
              <SkeletonRow key={i} delay={i * 100} />
            ))}
          </Animated.View>
        ) : error ? (
          // BUG FIX: className was previously set directly on this
          // Animated.View ("flex-1 items-center justify-center
          // px-[32px]") — Animated.View isn't in the css-interop
          // registered-components list, so that className was silently
          // dead code and this block was never actually centered/padded.
          // Moved into the style array alongside the animated
          // listBottomPaddingStyle (has to stay inline as one object
          // either way, since the component itself isn't registered).
          <Animated.View
            style={[
              {
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 32,
              },
              listBottomPaddingStyle,
            ]}
            entering={reduceMotion ? undefined : FadeIn.duration(180)}
            layout={
              reduceMotion
                ? undefined
                : LinearTransition.springify().damping(24)
            }
          >
            <View
              className="items-center justify-center mb-[12px] w-[56px] h-[56px] rounded-[28px] bg-surfaceGray"
            >
              <Feather name="alert-circle" size={22} color={COLORS.error} />
            </View>
            <Text
              className="text-[14px] font-poppins-sb text-textPrimary"
            >
              Couldn't load comments
            </Text>
            <Text
              className="text-[12.5px] font-poppins mt-[4px] mb-[16px] text-center text-placeholderText"
            >
              {typeof error === "string"
                ? error
                : "Check your connection and try again."}
            </Text>
            {onRetryLoad && (
              <Pressable
                onPress={onRetryLoad}
                className="px-[18px] py-[9px] rounded-pill bg-accentGreen"
                accessibilityRole="button"
                accessibilityLabel="Retry loading comments"
              >
                <Text className="text-[13px] font-poppins-sb text-white">
                  Retry
                </Text>
              </Pressable>
            )}
          </Animated.View>
        ) : comments.length === 0 ? (
          // Same className-on-Animated.View bug as the error block above;
          // same fix.
          <Animated.View
            style={[
              {
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 32,
              },
              listBottomPaddingStyle,
            ]}
            entering={reduceMotion ? undefined : FadeIn.duration(180)}
            layout={
              reduceMotion
                ? undefined
                : LinearTransition.springify().damping(24)
            }
          >
            <View
              className="items-center justify-center mb-[12px] w-[56px] h-[56px] rounded-[28px] bg-surfaceGray"
            >
              <Feather
                name="message-circle"
                size={22}
                color={COLORS.placeholderText}
              />
            </View>
            <Text
              className="text-[14px] font-poppins-sb text-textPrimary"
            >
              No comments yet
            </Text>
            <Text
              className="text-[12.5px] font-poppins mt-[4px] text-center text-placeholderText"
            >
              Be the first to share your thoughts.
            </Text>
          </Animated.View>
        ) : (
          <Animated.FlatList
            ref={listRef}
            data={topLevelComments}
            entering={reduceMotion ? undefined : FadeIn.duration(180)}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            keyboardShouldPersistTaps="always"
            // Animated.FlatList wraps FlatList in Reanimated's Animated,
            // which — like Animated.View — isn't in the css-interop
            // registered list, so contentContainerClassName wouldn't
            // reach the actual host view here; contentContainerStyle
            // stays inline.
            contentContainerStyle={{ paddingVertical: 4 }}
            // See footerSpacerStyle above for why this replaces the old
            // (non-existent) contentContainerAnimatedStyle prop.
            ListFooterComponent={<Animated.View style={footerSpacerStyle} />}
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            onContentSizeChange={handleListContentSizeChange}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews={Platform.OS !== "web"}
            updateCellsBatchingPeriod={50}
          />
        )}

        <CommentComposer
          inputRef={inputRef}
          onSubmit={handleSend}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          commentsReady={commentsReady}
          reduceMotion={reduceMotion}
          insets={insets}
        />
      </Animated.View>
    </>
  ) : null;

  useSheetPortal(sheetId, mounted, sheetContent);

  return null;
}