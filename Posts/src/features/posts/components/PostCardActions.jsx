import { memo } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "../../../shared/theme/colors";
import { count } from "../../../shared/utils/format";

/**
 * PostCardActions: Renders bottom action buttons (Like, Comment, Share, Bookmark)
 * with animated scale bounces and formatted engagement counts.
 */
const PostCardActions = memo(function PostCardActions({
  isLiked,
  likeCount,
  onLikePress,
  onLikePressIn,
  commentCount,
  onComment,
  onShare,
  onSharePressIn,
  isSaved,
  onBookmark,
  onBookmarkPressIn,
  likeScaleAnim,
  commentScaleAnim,
  shareScaleAnim,
  bookmarkScaleAnim,
  showComment = true,
}) {
  return (
    <View
      className="flex-row items-center gap-2.5 px-4 pb-4 pt-2 border-t"
      style={{ borderColor: COLORS.borderDefault }}
    >
      <Pressable
        onPress={onLikePress}
        onPressIn={onLikePressIn}
        hitSlop={8}
        className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 active:opacity-80 active:scale-95"
        style={{ backgroundColor: COLORS.surfaceGray }}
        accessibilityRole="button"
        accessibilityLabel={isLiked ? "Unlike post" : "Like post"}
      >
        <Animated.View style={{ transform: [{ scale: likeScaleAnim }] }}>
          <MaterialCommunityIcons
            name="leaf"
            size={19}
            color={isLiked ? COLORS.accentGreen : COLORS.iconLight}
          />
        </Animated.View>
        <Text
          className="text-[12.5px] font-poppins-bold"
          style={{ color: isLiked ? COLORS.accentGreen : COLORS.iconLight }}
        >
          {count(likeCount)}
        </Text>
      </Pressable>

      {showComment && !!onComment && (
        <Pressable
          onPress={onComment}
          hitSlop={8}
          className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2"
          style={{ backgroundColor: COLORS.surfaceGray }}
          accessibilityRole="button"
          accessibilityLabel="View comments"
        >
          <Animated.View style={{ transform: [{ scale: commentScaleAnim }] }}>
            <Ionicons name="chatbubble-outline" size={19} color="#1A181B" />
          </Animated.View>
          <Text
            className="text-[12.5px] font-poppins-bold"
            style={{ color: COLORS.iconLight }}
          >
            {count(commentCount)}
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={onShare}
        onPressIn={onSharePressIn}
        hitSlop={10}
        className="items-center justify-center rounded-full w-9 h-9"
        style={{ backgroundColor: COLORS.surfaceGray }}
        accessibilityRole="button"
        accessibilityLabel="Share post"
      >
        <Animated.View style={{ transform: [{ scale: shareScaleAnim }] }}>
          <MaterialCommunityIcons
            name="share-outline"
            size={19}
            color={COLORS.iconLight}
          />
        </Animated.View>
      </Pressable>

      <View className="flex-1" />

      <Pressable
        onPress={onBookmark}
        onPressIn={onBookmarkPressIn}
        hitSlop={10}
        className="items-center justify-center rounded-full w-9 h-9"
        style={{ backgroundColor: COLORS.surfaceGray }}
        accessibilityRole="button"
        accessibilityLabel={isSaved ? "Remove bookmark" : "Bookmark post"}
      >
        <Animated.View style={{ transform: [{ scale: bookmarkScaleAnim }] }}>
          <MaterialCommunityIcons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={19}
            color={isSaved ? COLORS.accentGreen : COLORS.iconLight}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
});

export default PostCardActions;
