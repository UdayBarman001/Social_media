import { memo } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Image } from "expo-image";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "../../../shared/theme/colors";

/**
 * PostCardHeader: Renders author avatar, name, verification, location/time,
 * follow toggle button (for non-authors), and options menu trigger.
 */
const PostCardHeader = memo(function PostCardHeader({
  postId,
  avatarUri,
  name,
  isVerified,
  location,
  timeAgo,
  isAuthor,
  isFollowing,
  onProfilePress,
  onFollow,
  onMenu,
  followScaleAnim,
  menuScaleAnim,
  onFollowPressIn,
  onFollowPressOut,
  onMenuPressIn,
}) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <View className="flex-row items-center px-4 pt-3.5 pb-3">
      {avatarUri ? (
        <Pressable onPress={onProfilePress} className="mr-3">
          <Image
            source={{ uri: avatarUri }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: COLORS.surfaceGray,
            }}
            recyclingKey={postId}
            cachePolicy="memory-disk"
            transition={150}
          />
        </Pressable>
      ) : (
        <Pressable
          onPress={onProfilePress}
          className="mr-3 items-center justify-center w-10 h-10 rounded-full"
          style={{ backgroundColor: COLORS.accentGreen }}
        >
          <Text className="text-[13px] text-white font-poppins-semibold">
            {initials}
          </Text>
        </Pressable>
      )}

      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="text-[15px] font-poppins-semibold"
            style={{ color: COLORS.textPrimary }}
            numberOfLines={1}
          >
            {name}
          </Text>
          {isVerified && (
            <MaterialCommunityIcons
              name="check-decagram"
              size={14}
              color={COLORS.accentGreen}
            />
          )}
        </View>
        <View className="flex-row items-center gap-1 mt-0.5">
          {location ? (
            <Feather
              name="map-pin"
              size={10}
              color={COLORS.placeholderText}
            />
          ) : null}
          <Text
            className="text-[11px] font-poppins-medium"
            style={{ color: COLORS.placeholderText }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {location ? `${location} · ` : ""}
            {timeAgo}
          </Text>
        </View>
      </View>

      {!isAuthor && (
        <Pressable
          onPress={onFollow}
          onPressIn={onFollowPressIn}
          onPressOut={onFollowPressOut}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={
            isFollowing ? `Unfollow ${name}` : `Follow ${name}`
          }
          accessibilityState={{ selected: isFollowing }}
        >
          <Animated.View
            className="flex-row items-center rounded-full"
            style={{
              transform: [{ scale: followScaleAnim }],
              gap: 4,
              paddingHorizontal: 12,
              height: 32,
              borderWidth: isFollowing ? 1 : 0,
              borderColor: COLORS.borderDefault,
              backgroundColor: isFollowing
                ? "transparent"
                : COLORS.accentGreen,
            }}
          >
            <Text
              className="text-[12px] font-poppins-bold"
              style={{
                color: isFollowing ? COLORS.textSecondary : "#fff",
              }}
            >
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </Animated.View>
        </Pressable>
      )}

      <Pressable
        onPress={onMenu}
        onPressIn={onMenuPressIn}
        hitSlop={14}
        className="ml-2.5 items-center justify-center rounded-full w-8 h-8"
        style={{ backgroundColor: COLORS.surfaceGray }}
        accessibilityRole="button"
        accessibilityLabel="Post options"
      >
        <Animated.View style={{ transform: [{ scale: menuScaleAnim }] }}>
          <MaterialCommunityIcons
            name="dots-vertical"
            size={20}
            color={COLORS.iconLight}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
});

export default PostCardHeader;
