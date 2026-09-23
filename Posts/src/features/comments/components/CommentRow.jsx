import { View, Text, Pressable, TextInput } from "react-native";
import { useCallback, useEffect, useMemo, useState, memo } from "react";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  FadeIn,
  LinearTransition,
} from "react-native-reanimated";
import COLORS from "../../../shared/theme/colors";
import { useUser } from "../../../shared/context/LocalUserContext";
import { timeAgo, accentFor } from "../../../shared/utils/format";
import { getThumbnailUrl } from "../../../shared/utils/imagekit";
import { CommentText, initialsOf } from "./CommentText";

// Indent + connector-line geometry for a 3-stage Facebook-style reply thread
const TOP_LEVEL_AVATAR_SIZE = 34;
const REPLY_AVATAR_SIZE = 26;
const NESTED_REPLY_AVATAR_SIZE = 22;
const THREAD_INDENT = TOP_LEVEL_AVATAR_SIZE + 10;
const THREAD_LINE_PADDING = 12;

// ─────────────────────────────────────────────────────────────────────────
// Comment row — memoized, only re-renders when its own data changes.
// Renders itself, and — if it's a top-level comment with replies — the
// indented, line-connected reply thread underneath it (one level deep;
// see nestComments.js for why replies-to-replies flatten into this).
// ─────────────────────────────────────────────────────────────────────────

export const CommentRow = memo(function CommentRow({
  comment,
  reactionFor,
  likeCountFor,
  dislikeCountFor,
  onReact,
  onReply,
  onRetry,
  onMentionPress,
  onOpenMenu,
  onProfilePress,
  authors,
  reduceMotion,
  isReply = false,
  editingCommentId,
  editText,
  onChangeEditText,
  onSaveEdit,
  onCancelEdit,
}) {
  // `author` is the raw ObjectId string; authorName is the resolved
  // display name from the backend populate (see comment.service.js
  // toClientComment). Fall back to the id only if a name never resolved.
  const { user } = useUser();
  const isCurrentUserAuthor =
    String(comment.author) === String(user?.id ?? user?._id);

  const isEditing = editingCommentId === comment.id;

  const displayName = isCurrentUserAuthor
    ? user?.name || comment.authorName || comment.author
    : comment.authorName || comment.author;

  const stage = comment.stage || (isReply ? 2 : 1);
  const isThirdStage = stage === 3;
  const avatarSize =
    stage === 3
      ? NESTED_REPLY_AVATAR_SIZE
      : stage === 2
        ? REPLY_AVATAR_SIZE
        : TOP_LEVEL_AVATAR_SIZE;

  const avatarColor = useMemo(
    () => accentFor(displayName || "?"),
    [displayName],
  );

  // Small, compressed thumbnail — not the full-resolution upload (see
  // shared/utils/imagekit.js). A comment thread can render this avatar
  // dozens of times, so this is the difference between each one costing
  // a few KB versus however many MB the original photo was uploaded at.
  const avatarThumbUrl = useMemo(
    () => getThumbnailUrl(comment.authorAvatar, avatarSize * 2),
    [comment.authorAvatar, avatarSize],
  );

  const router = useRouter();
  // Prefer the parent's onProfilePress (CommentSheet's handleProfilePress),
  // which closes the sheet before navigating — see CommentSheet.jsx's
  // comment on why. This used to always call router.push directly instead,
  // completely ignoring that prop (it wasn't even in this component's
  // destructured props above), so tapping a comment's avatar/name opened
  // the profile screen *on top of* the still-open comment sheet instead of
  // behind it. Falls back to a plain navigate only if a caller doesn't
  // pass onProfilePress at all.
  const handleProfilePress = useCallback(() => {
    if (!comment.author) return;
    if (onProfilePress) onProfilePress(comment.author);
    else router.push(`/profile/${comment.author}`);
  }, [router, comment.author, onProfilePress]);

  const isPending =
    typeof comment.id === "string" && comment.id.startsWith("local-comment-");

  const isFailed = comment.failed === true;

  // Local optimistic reaction state for instant 0ms UI responsiveness
  const [localReaction, setLocalReaction] = useState(null);
  const [localDelta, setLocalDelta] = useState({ like: 0, dislike: 0 });

  useEffect(() => {
    setLocalReaction(null);
    setLocalDelta({ like: 0, dislike: 0 });
  }, [comment.id, comment.likeCount, comment.dislikeCount]);

  const baseReaction = reactionFor(comment);
  const effectiveReaction = localReaction ?? baseReaction;
  const isLiked = effectiveReaction === "like";
  const isDisliked = effectiveReaction === "dislike";

  const baseLikeCount = likeCountFor(comment);
  const baseDislikeCount = dislikeCountFor(comment);
  const likeCount = Math.max(0, baseLikeCount + localDelta.like);
  const dislikeCount = Math.max(0, baseDislikeCount + localDelta.dislike);

  const thumbUpScale = useSharedValue(1);
  const thumbUpStyle = useAnimatedStyle(() => ({
    transform: [{ scale: thumbUpScale.value }],
  }));

  const thumbDownScale = useSharedValue(1);
  const thumbDownStyle = useAnimatedStyle(() => ({
    transform: [{ scale: thumbDownScale.value }],
  }));

  const bumpScale = useCallback(
    (sharedValue) => {
      if (reduceMotion) return;
      sharedValue.value = withSequence(
        withTiming(1.3, { duration: 75 }),
        withSpring(1, { damping: 10, stiffness: 350 })
      );
    },
    [reduceMotion],
  );

  const handleThumbUp = useCallback(() => {
    if (isPending) return;

    bumpScale(thumbUpScale);
    const nextReaction = effectiveReaction === "like" ? "none" : "like";
    let likeDelta = 0;
    let dislikeDelta = 0;
    if (effectiveReaction === "like") likeDelta -= 1;
    if (effectiveReaction === "dislike") dislikeDelta -= 1;
    if (nextReaction === "like") likeDelta += 1;

    setLocalReaction(nextReaction);
    setLocalDelta((prev) => ({
      like: prev.like + likeDelta,
      dislike: prev.dislike + dislikeDelta,
    }));

    onReact(comment, "like");
  }, [comment, onReact, isPending, bumpScale, thumbUpScale, effectiveReaction]);

  const handleThumbDown = useCallback(() => {
    if (isPending) return;

    bumpScale(thumbDownScale);
    const nextReaction = effectiveReaction === "dislike" ? "none" : "dislike";
    let likeDelta = 0;
    let dislikeDelta = 0;
    if (effectiveReaction === "like") likeDelta -= 1;
    if (effectiveReaction === "dislike") dislikeDelta -= 1;
    if (nextReaction === "dislike") dislikeDelta += 1;

    setLocalReaction(nextReaction);
    setLocalDelta((prev) => ({
      like: prev.like + likeDelta,
      dislike: prev.dislike + dislikeDelta,
    }));

    onReact(comment, "dislike");
  }, [comment, onReact, isPending, bumpScale, thumbDownScale, effectiveReaction]);

  const hasReplies = stage < 3 && comment.replies?.length > 0;
  // Collapsed by default — replies only show once toggle is tapped
  const [repliesExpanded, setRepliesExpanded] = useState(false);

  return (
    <Animated.View
      layout={
        reduceMotion ? undefined : LinearTransition.springify().damping(24)
      }
      accessible
      accessibilityLabel={`${displayName}, ${timeAgo(comment.createdAt)}: ${comment.text}${
        likeCount ? `, ${likeCount} likes` : ""
      }`}
    >
      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(180)}>
        <View
          className={`flex-row px-[16px] py-[10px] ${isPending ? "opacity-[0.55]" : "opacity-100"}`}
        >
          <Pressable
            onPress={handleProfilePress}
            disabled={!comment.author || isPending}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${displayName}'s profile`}
            className={`items-center justify-center mr-[10px] mt-[2px] overflow-hidden ${isReply ? "w-[26px] h-[26px] rounded-[13px]" : "w-[34px] h-[34px] rounded-[17px]"}`}
            style={{
              // avatarColor is a per-user computed value from accentFor()
              // (a hash-based color picker), not a fixed design token —
              // must stay a JS value, can't become a className.
              backgroundColor: avatarColor,
            }}
          >
            {avatarThumbUrl ? (
              <Image
                // NOTE: this `Image` is from `expo-image`, not RN core —
                // react-native-css-interop's registered-components list
                // (View/Text/Image/etc.) refers to RN core's `Image`, and
                // I found no cssInterop/remapProps registration for
                // expo-image's Image anywhere in this codebase (see
                // TopBar.jsx / ProfileScreen.jsx comments noting the same
                // gap for other unregistered components). className here
                // would silently be a no-op, so this stays inline style.
                source={{ uri: avatarThumbUrl }}
                cachePolicy="memory-disk"
                transition={120}
                style={{ width: avatarSize, height: avatarSize }}
              />
            ) : (
              <Text
                className="text-[12px] text-white font-poppins-sb"
                allowFontScaling={false}
              >
                {initialsOf(displayName)}
              </Text>
            )}
          </Pressable>

          <View className="flex-1">
            <View className="flex-row items-center">
              <View className="flex-row items-center flex-wrap flex-1">
                <Pressable
                  onPress={handleProfilePress}
                  disabled={!comment.author || isPending}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`${displayName}'s profile`}
                >
                  <Text className="text-[13px] font-poppins-sb text-textPrimary">
                    {displayName}
                  </Text>
                </Pressable>

                <Text className="text-[11px] font-poppins ml-[6px] text-placeholderText">
                  {isFailed
                    ? "failed to send"
                    : isPending
                      ? "sending…"
                      : timeAgo(comment.createdAt)}
                </Text>
              </View>

              {onOpenMenu && (
                <Pressable
                  onPress={() => onOpenMenu(comment)}
                  disabled={isPending}
                  hitSlop={10}
                  className="ml-auto py-[4px] px-[2px]"
                  accessibilityRole="button"
                  accessibilityLabel="More options"
                >
                  <Feather
                    name="more-horizontal"
                    size={16}
                    color={COLORS.placeholderText}
                  />
                </Pressable>
              )}
            </View>

            {isEditing ? (
              <View className="rounded-2xl p-2.5 mt-[4px] bg-surfaceGray">
                <TextInput
                  value={editText}
                  onChangeText={onChangeEditText}
                  autoFocus
                  multiline
                  maxLength={500}
                  // bug fix: "text-text-primary" (kebab-case) doesn't match
                  // any config token and was silently a no-op — the real
                  // token is "textPrimary" (camelCase)
                  className="font-poppins-regular text-[13.5px] text-textPrimary min-h-9 p-0 leading-[20px]"
                />

                <View className="flex-row justify-end gap-3.5 mt-2">
                  <Pressable onPress={onCancelEdit} hitSlop={6}>
                    <Text className="font-poppins-sb text-[12.5px] text-textSecondaryLight">
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable onPress={() => onSaveEdit(comment.id)} hitSlop={6}>
                    {/* bug fix: "font-poppins-semibold" isn't a real class
                        in this config — the correct token is
                        "font-poppins-sb" (used everywhere else in the file) */}
                    <Text className="font-poppins-sb text-[12.5px] text-accentGreen">
                      Save
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <CommentText
                text={comment.text}
                authors={authors}
                // Stage 3 (a reply to a reply — see isThirdStage above):
                // the thread only ever displays 2 visual levels, but the
                // reply still needs to say *who* it's addressing since
                // it's flattened alongside direct replies to the same
                // top-level comment. nestComments.js already resolved
                // that to a name + real author id, Instagram-style — no
                // text parsing needed for this case.
                mention={
                  isThirdStage
                    ? {
                        name: comment.replyingToAuthor,
                        id: comment.replyingToAuthorId,
                      }
                    : undefined
                }
                onMentionPress={onMentionPress}
                // CommentText (./CommentText.jsx) only accepts a `style`
                // prop and passes it straight to an inner <Text> — it
                // doesn't run className through cssInterop itself, so
                // this can't move to a className on this call site
                // without changing CommentText's own API (out of scope
                // per the styling-only conversion rule).
                style={{
                  fontFamily: "Poppins_400Regular",
                  fontSize: 13.5,
                  lineHeight: 19,
                  color: COLORS.textSecondary,
                  marginTop: 2,
                }}
              />
            )}

            {!isEditing && (
              <View className="flex-row items-center gap-[18px] mt-[6px]">
                {isFailed ? (
                  <Pressable
                    onPress={() => onRetry?.(comment)}
                    hitSlop={10}
                    className="py-[4px]"
                    accessibilityRole="button"
                    accessibilityLabel="Retry sending comment"
                  >
                    <Text className="text-[11.5px] font-poppins-sb text-error">
                      Retry
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    {/* Reply is available at all stages (Facebook style) */}
                    <Pressable
                      onPress={() => {
                        if (hasReplies) {
                          setRepliesExpanded(true);
                        }

                        onReply(comment);
                      }}
                      disabled={isPending}
                      hitSlop={10}
                      className="py-[4px] active:opacity-70"
                      accessibilityRole="button"
                      accessibilityLabel={`Reply to ${displayName}`}
                    >
                      <Text className="text-[11.5px] font-poppins-sb text-textSecondaryLight">
                        Reply
                      </Text>
                    </Pressable>

                    {/* ─────────────────────────────────────
                        THUMBS UP
                        Outline when inactive.
                        Fully filled green when active.
                       ───────────────────────────────────── */}
                    <Pressable
                      onPress={handleThumbUp}
                      disabled={isPending}
                      hitSlop={10}
                      className="flex-row items-center gap-[4px] py-[4px]"
                      accessibilityRole="button"
                      accessibilityLabel={
                        isLiked ? "Remove like" : "Like comment"
                      }
                      accessibilityState={{
                        selected: isLiked,
                      }}
                    >
                      <Animated.View style={thumbUpStyle}>
                        <MaterialCommunityIcons
                          name={isLiked ? "thumb-up" : "thumb-up-outline"}
                          size={15}
                          color={
                            isLiked
                              ? COLORS.accentGreen
                              : COLORS.placeholderText
                          }
                        />
                      </Animated.View>

                      {likeCount > 0 && (
                        <Text
                          className={`text-[11.5px] font-poppins-md ${isLiked ? "text-accentGreen" : "text-placeholderText"}`}
                        >
                          {likeCount}
                        </Text>
                      )}
                    </Pressable>

                    {/* ─────────────────────────────────────
                        THUMBS DOWN
                        Outline when inactive.
                        Fully filled red when active.
                       ───────────────────────────────────── */}
                    <Pressable
                      onPress={handleThumbDown}
                      disabled={isPending}
                      hitSlop={10}
                      className="flex-row items-center gap-[4px] py-[4px]"
                      accessibilityRole="button"
                      accessibilityLabel={
                        isDisliked ? "Remove dislike" : "Dislike comment"
                      }
                      accessibilityState={{
                        selected: isDisliked,
                      }}
                    >
                      <Animated.View style={thumbDownStyle}>
                        <MaterialCommunityIcons
                          name={
                            isDisliked ? "thumb-down" : "thumb-down-outline"
                          }
                          size={15}
                          color={
                            isDisliked ? COLORS.error : COLORS.placeholderText
                          }
                        />
                      </Animated.View>

                      {dislikeCount > 0 && (
                        <Text
                          className={`text-[11.5px] font-poppins-md ${isDisliked ? "text-error" : "text-placeholderText"}`}
                        >
                          {dislikeCount}
                        </Text>
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {hasReplies && (
        <View
          className={`${stage === 2 ? "ml-[34px] pl-[8px]" : "ml-[44px] pl-[12px]"}`}
        >
          <Pressable
            onPress={() => setRepliesExpanded((prev) => !prev)}
            hitSlop={10}
            className="flex-row items-center py-[6px]"
            accessibilityRole="button"
            accessibilityLabel={
              repliesExpanded
                ? "Hide replies"
                : `View ${comment.replies.length} ${
                    comment.replies.length === 1 ? "reply" : "replies"
                  }`
            }
            accessibilityState={{
              expanded: repliesExpanded,
            }}
          >
            <Ionicons
              name={repliesExpanded ? "chevron-up" : "chevron-down"}
              size={stage === 2 ? 11 : 13}
              color={COLORS.black}
              style={{ marginRight: 4 }}
            />

            <Text
              className={`${stage === 2 ? "text-[11.5px]" : "text-[12px]"} font-poppins-sb`}
              style={{
                color: COLORS.black,
              }}
            >
              {repliesExpanded
                ? "Hide replies"
                : `View ${comment.replies.length} ${
                    comment.replies.length === 1 ? "reply" : "replies"
                  }`}
            </Text>
          </Pressable>

          {repliesExpanded && (
            <View className="border-l-2 border-l-dividerLight ml-[4px] pl-[8px]">
              {comment.replies.map((reply) => (
                <CommentRow
                  key={reply.id}
                  comment={reply}
                  isReply
                  reactionFor={reactionFor}
                  likeCountFor={likeCountFor}
                  dislikeCountFor={dislikeCountFor}
                  onReact={onReact}
                  onReply={onReply}
                  onRetry={onRetry}
                  onMentionPress={onMentionPress}
                  onOpenMenu={onOpenMenu}
                  onProfilePress={onProfilePress} 
                  authors={authors}
                  reduceMotion={reduceMotion}
                  editingCommentId={editingCommentId}
                  editText={editText}
                  onChangeEditText={onChangeEditText}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
});
