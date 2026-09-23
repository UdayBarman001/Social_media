import { request } from "./client";

// Fetches paginated notifications for userId
export async function fetchNotifications(userId, { page = 1, limit = 20 } = {}) {
  const query = new URLSearchParams();
  if (userId) query.set("userId", userId);
  if (page) query.set("page", String(page));
  if (limit) query.set("limit", String(limit));
  const data = await request(`/notifications?${query.toString()}`);
  return {
    notifications: data.notifications || [],
    meta: data.meta || { unreadCount: 0, hasNextPage: false },
  };
}

// Marks all notifications as read for userId
export async function markAllNotificationsRead(userId) {
  await request(`/notifications/read-all`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

// Marks a single notification as read
export async function markNotificationRead(userId, notificationId) {
  await request(`/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}
