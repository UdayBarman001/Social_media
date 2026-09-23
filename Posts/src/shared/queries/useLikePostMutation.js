import { useMutation, useQueryClient } from '@tanstack/react-query';
import { likePost } from '../services/api';

export function useLikePostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }) => likePost(id, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', variables.id] });
    },
  });
}
