import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import COLORS from "../../../shared/theme/colors";
import { useUser } from "../../../shared/context/LocalUserContext";
import {
  useNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "../../../shared/queries/useNotificationsQuery";
import NotificationRow from "../components/NotificationRow";

function SkeletonRow() {
  return (
    <View className="flex-row items-center px-4 py-3.5 border-b border-borderDefault bg-white">
      <View className="w-[46px] h-[46px] rounded-full bg-surfaceGray mr-3" />
      <View className="flex-1 mr-2">
        <View className="w-3/4 h-3.5 rounded bg-surfaceGray mb-2" />
        <View className="w-1/2 h-3 rounded bg-surfaceGray mb-1.5" />
        <View className="w-1/4 h-2.5 rounded bg-surfaceGray" />
      </View>
      <View className="w-11 h-11 rounded-lg bg-surfaceGray" />
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { userId } = useUser();
  const [filter, setFilter] = useState("all"); // "all" | "unread"

  const { data, isLoading, isFetching, refetch } = useNotificationsQuery(userId);
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const markOneReadMutation = useMarkNotificationReadMutation();

  const notifications = data?.notifications || [];
  const unreadCount = data?.meta?.unreadCount || 0;

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  const handleMarkAllRead = useCallback(() => {
    if (userId && unreadCount > 0) {
      markAllReadMutation.mutate({ userId });
    }
  }, [userId, unreadCount, markAllReadMutation]);

  const handlePressNotification = useCallback(
    (notification) => {
      if (!notification.read && userId) {
        markOneReadMutation.mutate({
          userId,
          notificationId: notification.id,
        });
      }

      const postId = notification.post?.id ?? notification.post?._id;
      const senderId = notification.sender?.id ?? notification.sender?._id;

      if (postId) {
        router.push(`/post/${postId}`);
      } else if (notification.type === "follow" && senderId) {
        router.push(`/profile/${encodeURIComponent(senderId)}`);
      }
    },
    [userId, markOneReadMutation, router]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const renderItem = useCallback(
    ({ item }) => {
      if (!item) return null;
      return (
        <NotificationRow
          notification={item}
          onPress={handlePressNotification}
        />
      );
    },
    [handlePressNotification]
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-borderDefault bg-white">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            hitSlop={12}
            className="w-10 h-10 rounded-full items-center justify-center mr-2 active:bg-surfaceGray"
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Feather name="arrow-left" size={22} color={COLORS.textPrimary} />
          </Pressable>
          <Text className="text-[19px] font-poppins-bold text-textPrimary">
            Notifications
          </Text>
        </View>

        {unreadCount > 0 && (
          <Pressable
            onPress={handleMarkAllRead}
            disabled={markAllReadMutation.isPending}
            className="flex-row items-center px-3 py-1.5 rounded-full bg-categoryBg active:opacity-70 gap-1"
          >
            <Feather
              name="check-circle"
              size={13}
              color={COLORS.accentGreen}
            />
            <Text className="text-[12px] font-poppins-semibold text-accentGreen">
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <View className="flex-row px-4 py-2.5 bg-surfaceGray/50 border-b border-borderDefault gap-2">
        <Pressable
          onPress={() => setFilter("all")}
          className={`px-4 py-1.5 rounded-full ${
            filter === "all" ? "bg-accentGreen" : "bg-white border border-borderDefault"
          }`}
        >
          <Text
            className={`text-[12.5px] font-poppins-medium ${
              filter === "all" ? "text-white font-poppins-semibold" : "text-textSecondary"
            }`}
          >
            All
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilter("unread")}
          className={`flex-row items-center px-4 py-1.5 rounded-full ${
            filter === "unread" ? "bg-accentGreen" : "bg-white border border-borderDefault"
          }`}
        >
          <Text
            className={`text-[12.5px] font-poppins-medium ${
              filter === "unread" ? "text-white font-poppins-semibold" : "text-textSecondary"
            }`}
          >
            Unread
          </Text>
          {unreadCount > 0 && (
            <View
              className={`ml-1.5 px-1.5 py-0.2 rounded-full ${
                filter === "unread" ? "bg-white/30" : "bg-accentGreen/10"
              }`}
            >
              <Text
                className={`text-[11px] font-poppins-bold ${
                  filter === "unread" ? "text-white" : "text-accentGreen"
                }`}
              >
                {unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Notifications List */}
      {isLoading ? (
        <View className="flex-1">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View className="flex-1 items-center justify-center py-24 px-6">
          <View className="w-16 h-16 rounded-full bg-categoryBg items-center justify-center mb-4">
            <Feather name="bell-off" size={28} color={COLORS.accentGreen} />
          </View>
          <Text className="text-[16px] font-poppins-semibold text-textPrimary text-center mb-1">
            {filter === "unread"
              ? "No unread notifications"
              : "No notifications yet"}
          </Text>
          <Text className="text-[13px] font-poppins text-placeholderText text-center max-w-[260px]">
            {filter === "unread"
              ? "You've read all your recent notifications."
              : "When someone likes, comments, or mentions you, you'll see it here."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={COLORS.accentGreen}
              colors={[COLORS.accentGreen]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
