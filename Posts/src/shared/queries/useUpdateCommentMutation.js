import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateComment } from '../services/api';

export function useUpdateCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, commentId, userId, text }) =>
      updateComment(postId, commentId, userId, text),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
    },
  });
}