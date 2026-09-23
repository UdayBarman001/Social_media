import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unlikePost } from '../services/api';

export function useUnlikePostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }) => unlikePost(id, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', variables.id] });
    },
  });
}
