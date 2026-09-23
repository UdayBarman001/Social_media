import { useQuery } from '@tanstack/react-query';
import { fetchPosts } from '../services/api';

export function useFetchPostsQuery() {
  return useQuery({
    queryKey: ['feed'],
    queryFn: fetchPosts,
  });
}
