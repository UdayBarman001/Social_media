import { normalize, request } from "./client";

// Lists comments for a post
export async function listComments(postId) {
  const data = await request(`/posts/${postId}/comments`);
  return data.comments ?? [];
}

// Adds a comment or reply to a post
export async function addComment(postId, userId, text, parentComment) {
  const data = await request(`/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      author: userId,
      text,
      ...(parentComment ? { parentComment } : {}),
    }),
  });
  return normalize(data.comment);
}

// Reacts to a comment (like/dislike/none)
export async function reactToComment(postId, commentId, reaction, userId) {
  const data = await request(`/posts/${postId}/comments/${commentId}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reaction, userId }),
  });
  return { post: normalize(data.post), comment: data.comment };
}

// Updates an existing comment's text
export async function updateComment(postId, commentId, userId, text) {
  const data = await request(`/posts/${postId}/comments/${commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, text }),
  });
  return data.comment;
}

// Deletes a comment
export async function deleteComment(postId, commentId, userId) {
  await request(`/posts/${postId}/comments/${commentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}
