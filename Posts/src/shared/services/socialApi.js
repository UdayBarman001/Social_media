import { normalize, request } from "./client";

// Follows a user
export async function followUser(targetUserId, userId) {
  await request(`/follows/${targetUserId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

// Unfollows a user
export async function unfollowUser(targetUserId, userId) {
  await request(`/follows/${targetUserId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

// Fetches IDs of users that userId follows
export async function fetchFollowingIds(userId) {
  const data = await request(`/follows/${userId}/following`);
  const list = data.users ?? data.following ?? [];
  return list.map((u) => (typeof u === "string" ? u : u.id ?? u.followingId ?? u._id));
}

// Fetches follower and following counts for profile header
export async function fetchFollowCounts(userId) {
  const data = await request(`/follows/${userId}/counts`);
  return {
    followers: data.followers ?? 0,
    following: data.following ?? 0,
  };
}

// Bookmarks a post
export async function addBookmark(postId, userId) {
  await request(`/bookmarks/${postId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

// Removes a bookmark from a post
export async function removeBookmark(postId, userId) {
  await request(`/bookmarks/${postId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

// Fetches IDs of posts bookmarked by userId
export async function fetchBookmarkedIds(userId) {
  const data = await request(`/bookmarks?userId=${encodeURIComponent(userId)}`);
  const list = data.posts ?? [];
  return list.map((p) => (typeof p === "string" ? p : p.id));
}

// Fetches full post objects bookmarked by userId
export async function fetchSavedPosts(userId) {
  const data = await request(`/bookmarks?userId=${encodeURIComponent(userId)}`);
  return (data.posts ?? []).map(normalize);
}

// Fetches posts liked by userId
export async function fetchLikedPosts(userId) {
  const data = await request(`/likes/${encodeURIComponent(userId)}/posts`);
  return (data.posts ?? []).map(normalize);
}

// Fetches IDs of posts liked by userId
export async function fetchLikedIds(userId) {
  const data = await request(`/likes/${encodeURIComponent(userId)}/liked`);
  return data.liked ?? [];
}
