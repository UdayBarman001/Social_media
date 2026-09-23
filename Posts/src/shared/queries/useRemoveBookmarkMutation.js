import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeBookmark } from '../services/api';

export function useRemoveBookmarkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, userId }) => removeBookmark(postId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['savedPosts', variables.userId] });
    },
  });
}