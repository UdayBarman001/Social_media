import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reactToComment } from '../services/api';

export function useLikeCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, commentId, reaction, userId }) =>
      reactToComment(postId, commentId, reaction, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
    },
  });
}