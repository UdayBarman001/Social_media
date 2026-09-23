import { useQuery } from '@tanstack/react-query';
import { fetchSavedPosts } from '../services/api';

// enabled: !!userId lets callers pass undefined to skip fetching (e.g. only
// load this when the "Saved" tab is actually active on the profile screen).
export function useFetchSavedPostsQuery(userId) {
  return useQuery({
    queryKey: ['savedPosts', userId],
    queryFn: () => fetchSavedPosts(userId),
    enabled: !!userId,
  });
}