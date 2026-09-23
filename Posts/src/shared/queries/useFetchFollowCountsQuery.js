import { useQuery } from '@tanstack/react-query';
import { fetchFollowCounts } from '../services/api';

export function useFetchFollowCountsQuery(id) {
  return useQuery({
    queryKey: ['follows', id, 'counts'],
    queryFn: () => fetchFollowCounts(id),
    enabled: !!id,
  });
}