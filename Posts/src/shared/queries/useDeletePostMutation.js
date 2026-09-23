import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deletePost } from '../services/api';

export function useDeletePostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }) => deletePost(id, userId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      // Deleting a post is author-only (backend enforces this), so
      // variables.userId here is always the post's own author — same
      // ['userPosts', authorId] cache useCreatePostMutation invalidates.
      if (variables?.userId) {
        queryClient.invalidateQueries({ queryKey: ['userPosts', variables.userId] });
      }
    },
  });
}