import { useQuery } from '@tanstack/react-query';
import { listComments } from '../services/api';

export function useListCommentsQuery(postId) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: () => listComments(postId),
    enabled: !!postId,
  });
}
