import { View, Text, Pressable, Image } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "../../../shared/theme/colors";
import Avatar from "../../../shared/ui/Avatar";
import { timeAgo } from "../../../shared/utils/format";

const DEFAULT_META = {
  icon: "bell",
  color: COLORS.accentGreen,
  badgeBgClass: "bg-categoryBg",
  actionText: "interacted with you",
};

const NOTIFICATION_META = {
  like: {
    icon: "leaf",
    color: "#EF4444",
    badgeBgClass: "bg-red-100",
    actionText: "liked your post",
  },
  comment: {
    icon: "message-circle",
    color: "#0284C7",
    badgeBgClass: "bg-sky-100",
    actionText: "commented on your post",
  },
  follow: {
    icon: "user-plus",
    color: COLORS.accentGreen,
    badgeBgClass: "bg-categoryBg",
    actionText: "started following you",
  },
  mention: {
    icon: "at-sign",
    color: "#8B5CF6",
    badgeBgClass: "bg-purple-100",
    actionText: "mentioned you in a comment",
  },
};

function getNotificationMeta(type) {
  if (!type || typeof type !== "string") return DEFAULT_META;
  return NOTIFICATION_META[type.toLowerCase()] || DEFAULT_META;
}

export default function NotificationRow({ notification, onPress }) {
  if (!notification || !notification.id) return null;

  const meta = getNotificationMeta(notification?.type) || DEFAULT_META;
  const actionText =
    typeof meta?.actionText === "string"
      ? meta.actionText
      : typeof meta?.actionText === "function"
      ? meta.actionText()
      : "interacted with you";

  const sender = notification?.sender || {};
  const post = notification?.post || null;
  const isRead = !!notification?.read;
  const timeText = notification?.createdAt ? timeAgo(notification.createdAt) : null;
  const postImageUrl =
    typeof post?.image === "string"
      ? post.image
      : typeof post?.image?.url === "string"
      ? post.image.url
      : typeof post?.images?.[0] === "string"
      ? post.images[0]
      : typeof post?.images?.[0]?.url === "string"
      ? post.images[0].url
      : null;

  return (
    <Pressable
      onPress={() => onPress?.(notification)}
      className={`flex-row items-center px-4 py-3.5 border-b border-borderDefault active:bg-black/[0.03] ${
        isRead ? "bg-white" : "bg-[#F0FDF4]"
      }`}
    >
      {/* Avatar with Badge overlay */}
      <View className="relative mr-3">
        <Avatar uri={sender.avatarUrl} name={sender.name || "User"} size={46} />
        <View
          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full items-center justify-center border-2 border-white ${
            meta.badgeBgClass || "bg-categoryBg"
          }`}
        >
          {meta.icon === "leaf" ? (
            <MaterialCommunityIcons
              name="leaf"
              size={11}
              color={meta.color || "#EF4444"}
            />
          ) : (
            <Feather
              name={meta.icon || "bell"}
              size={10}
              color={meta.color || COLORS.accentGreen}
            />
          )}
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 mr-2">
        <Text className="text-[13.5px] font-poppins text-textPrimary leading-5">
          <Text className="font-poppins-semibold text-textPrimary">
            {sender.name || "Someone"}
          </Text>
          <Text className="text-textSecondary"> {actionText}</Text>
        </Text>

        {/* Post snippet if present */}
        {post?.description ? (
          <Text
            numberOfLines={1}
            className="text-[12px] font-poppins text-placeholderText mt-0.5"
          >
            "{post.description}"
          </Text>
        ) : null}

        {timeText ? (
          <Text className="text-[11px] font-poppins text-placeholderText mt-1">
            {timeText}
          </Text>
        ) : null}
      </View>

      {/* Right side thumbnail if post has image */}
      {Boolean(postImageUrl) && (
        <Image
          source={{ uri: postImageUrl }}
          className="w-11 h-11 rounded-lg bg-surfaceGray mr-2"
          resizeMode="cover"
        />
      )}

      {/* Unread indicator dot */}
      {!isRead && (
        <View className="w-2.5 h-2.5 rounded-full bg-accentGreen ml-1" />
      )}
    </Pressable>
  );
}
