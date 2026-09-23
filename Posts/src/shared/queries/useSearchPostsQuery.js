import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchPosts } from '../services/api';

// BUG FIX: usePostSearch.js's own doc comment promises "keep stale
// results visible while refetching", and SearchScreen.jsx's rendering
// logic (isRefetching = loading && results.length > 0) was written
// assuming exactly that — but nothing here actually told React Query to
// do it. Every debounced keystroke produces a brand-new queryKey
// (['posts','search', <newQuery>]), which React Query v5 treats as a
// fresh query: `data` resets to `undefined` while it fetches, unless
// `placeholderData` says otherwise. That made `results.length` drop to 0
// the instant you typed another character — even though a full page of
// results was already on screen — which flipped SearchScreen's branch
// from the small inline spinner (isRefetching) to isInitialLoad's full
// skeleton-row wipe, on every keystroke, not just the very first search.
// `placeholderData: keepPreviousData` keeps the last successful result
// set visible (and `results.length > 0` true) while the new query is in
// flight, which is what actually makes isRefetching ever fire.
//
// `enabled` also now matches the backend's own minimum — post.service.js
// (searchPosts) returns [] outright for any query under 2 trimmed
// characters. Firing at length 1 was a wasted request that always came
// back empty, and could flash "No posts found for..." for a single
// typed character before the person had even finished typing.
export function useSearchPostsQuery(query) {
  return useQuery({
    queryKey: ['posts', 'search', query],
    queryFn: () => searchPosts(query),
    enabled: query.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
}