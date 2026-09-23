import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addBookmark } from '../services/api';

export function useAddBookmarkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, userId }) => addBookmark(postId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks', variables.userId] });
      // Profile screen's "Saved" tab reads full post objects from a
      // separate query key (same endpoint, different shape) — keep it in
      // sync too or a freshly-bookmarked post won't show up there.
      queryClient.invalidateQueries({ queryKey: ['savedPosts', variables.userId] });
    },
  });
}