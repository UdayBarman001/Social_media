import { useEffect, useState } from "react";
import { useSearchPostsQuery } from "../../../shared/queries/useSearchPostsQuery";

const DEBOUNCE_MS = 350;

/**
 * Debounced search-as-you-type against GET /posts/search. Same shape as
 * useUserSearch (same debounce window, same "keep stale results visible
 * while refetching" behavior) so People/Posts tabs feel identical.
 */
export function usePostSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const { data, isFetching, error } = useSearchPostsQuery(debouncedQuery);

  const posts = data ?? [];
  const loading = isFetching;
  const errorMessage = error?.message ?? null;

  return { query, setQuery, posts, loading, error: errorMessage };
}