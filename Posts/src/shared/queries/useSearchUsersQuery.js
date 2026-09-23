import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchUsers } from '../services/api';

export function useSearchUsersQuery(query) {
  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: () => searchUsers(query),
    enabled: query.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
}