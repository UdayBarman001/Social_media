import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/api";

export function useNotificationsQuery(userId) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(userId),
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Poll every 30s in background
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId }) => markAllNotificationsRead(userId),
    onMutate: async ({ userId }) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });
      const previous = queryClient.getQueryData(["notifications", userId]);

      if (previous) {
        queryClient.setQueryData(["notifications", userId], {
          ...previous,
          notifications: (previous.notifications || []).map((n) => ({
            ...n,
            read: true,
          })),
          meta: {
            ...(previous.meta || {}),
            unreadCount: 0,
          },
        });
      }

      return { previous };
    },
    onError: (err, { userId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications", userId], context.previous);
      }
    },
    onSettled: (_, __, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, notificationId }) =>
      markNotificationRead(userId, notificationId),
    onMutate: async ({ userId, notificationId }) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });
      const previous = queryClient.getQueryData(["notifications", userId]);

      if (previous) {
        let unreadDelta = 0;
        const updated = (previous.notifications || []).map((n) => {
          if (n.id === notificationId && !n.read) {
            unreadDelta = 1;
            return { ...n, read: true };
          }
          return n;
        });

        queryClient.setQueryData(["notifications", userId], {
          ...previous,
          notifications: updated,
          meta: {
            ...(previous.meta || {}),
            unreadCount: Math.max(0, (previous.meta?.unreadCount || 0) - unreadDelta),
          },
        });
      }

      return { previous };
    },
    onError: (err, { userId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications", userId], context.previous);
      }
    },
    onSettled: (_, __, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });
}
