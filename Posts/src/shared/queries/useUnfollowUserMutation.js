import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unfollowUser } from '../services/api';

export function useUnfollowUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetUserId, userId }) => unfollowUser(targetUserId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['following', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['follows', variables.userId, 'counts'] });
      queryClient.invalidateQueries({ queryKey: ['follows', variables.targetUserId, 'counts'] });
    },
  });
}