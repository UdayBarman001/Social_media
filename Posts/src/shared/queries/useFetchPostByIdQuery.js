import { useQuery } from '@tanstack/react-query';
import { fetchPostById } from '../services/api';

export function useFetchPostByIdQuery(id) {
  return useQuery({
    queryKey: ['post', id],
    queryFn: () => fetchPostById(id),
    enabled: !!id,
  });
}