import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followUser } from '../services/api';

export function useFollowUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetUserId, userId }) => followUser(targetUserId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['following', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['follows', variables.userId, 'counts'] });
      queryClient.invalidateQueries({ queryKey: ['follows', variables.targetUserId, 'counts'] });
    },
  });
}