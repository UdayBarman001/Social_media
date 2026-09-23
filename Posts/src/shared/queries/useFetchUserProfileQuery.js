import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile } from '../services/api';

export function useFetchUserProfileQuery(id) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUserProfile(id),
    enabled: !!id,
  });
}