/**
 * Keeps every already-mounted React Query representation of a user aligned
 * with the canonical User object returned by the profile mutation.
 *
 * Posts/comments are intentionally NOT rewritten in MongoDB: their `author`
 * field is a User ObjectId and their display fields are read-time populated
 * snapshots. Updating the query cache here gives the current session an
 * immediate UI update; subsequent API reads get the same canonical data from
 * MongoDB.
 */
export function syncUserInQueryCache(queryClient, user) {
  if (!queryClient || !user) return;

  const userId = String(user._id ?? user.id);
  if (!userId) return;

  const patchAuthor = (value) => {
    if (!value || typeof value !== "object") return value;

    const authorId =
      value.author != null
        ? String(typeof value.author === "object" ? value.author._id ?? value.author.id : value.author)
        : null;

    if (authorId === userId) {
      return {
        ...value,
        authorName: user.name,
        authorAvatar: user.avatarUrl ?? null,
        authorVerified: !!user.verified,
      };
    }

    if (String(value._id ?? value.id ?? "") === userId && "name" in value) {
      return { ...value, ...user };
    }

    return value;
  };

  const patchData = (data) => {
    if (Array.isArray(data)) return data.map((item) => patchData(item));
    if (!data || typeof data !== "object") return data;

    const patched = patchAuthor(data);

    // Handle FeedContext's cached page shape: { posts, meta }.
    if (Array.isArray(patched.posts)) {
      patched.posts = patched.posts.map((post) => patchAuthor(post));
    }

    // Handle any nested common API/query containers without assuming a
    // particular endpoint response shape.
    if (Array.isArray(patched.comments)) {
      patched.comments = patched.comments.map((comment) => patchAuthor(comment));
    }
    if (Array.isArray(patched.users)) {
      patched.users = patched.users.map((item) => patchAuthor(item));
    }

    return patched;
  };

  // Current user's profile query becomes the canonical server response.
  queryClient.setQueryData(["user", userId], user);

  // Patch all mounted/cached query results that embed this user's display
  // fields. This avoids network refetches while still covering:
  // feed pages, single posts, comments, saved posts, search results, etc.
  queryClient.getQueriesData().forEach(([queryKey, data]) => {
    if (!data || !Array.isArray(queryKey)) return;

    const root = queryKey[0];
    if (
      root === "feed" ||
      root === "post" ||
      root === "comments" ||
      root === "users" ||
      root === "posts" ||
      root === "savedPosts" ||
      root === "bookmarks"
    ) {
      queryClient.setQueryData(queryKey, patchData(data));
    }
  });
}
