import { useQuery } from '@tanstack/react-query';
import { fetchUserPosts } from '../services/api';

/**
 * Fetches all posts authored by a specific user (via GET /posts?authorId=<id>&limit=100).
 * Powers the ProfileScreen's authored posts feed, ensuring all posts by the user
 * are fetched rather than client-filtering the global latest 20 posts feed.
 */
export function useFetchUserPostsQuery(authorId) {
  return useQuery({
    queryKey: ['userPosts', authorId],
    queryFn: () => fetchUserPosts(authorId),
    enabled: !!authorId,
  });
}
