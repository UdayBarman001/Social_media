import { normalize, request } from "./client";

// Searches users by query
export async function searchUsers(query) {
  const data = await request(`/users/search?q=${encodeURIComponent(query)}`);
  return data.users ?? [];
}

// Searches posts by query
export async function searchPosts(query) {
  const data = await request(`/posts/search?q=${encodeURIComponent(query)}`);
  return (data.posts ?? []).map(normalize);
}
