import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteComment } from '../services/api';

export function useDeleteCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, commentId, userId }) =>
      deleteComment(postId, commentId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
    },
  });
}