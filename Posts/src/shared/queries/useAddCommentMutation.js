import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addComment } from '../services/api';

export function useAddCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, userId, text, parentComment }) =>
      addComment(postId, userId, text, parentComment),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.postId] });
    },
  });
}
