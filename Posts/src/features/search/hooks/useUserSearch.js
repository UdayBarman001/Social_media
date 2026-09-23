import { useEffect, useState } from "react";
import { useSearchUsersQuery } from "../../../shared/queries/useSearchUsersQuery";

const DEBOUNCE_MS = 350;

/**
 * Debounced search-as-you-type against GET /users/search. Keeps the last
 * results on screen while a new query is in flight so the list doesn't
 * flash empty between keystrokes.
 */
export function useUserSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const { data, isFetching, error } = useSearchUsersQuery(debouncedQuery);

  const users = data ?? [];
  const loading = isFetching;
  const errorMessage = error?.message ?? null;

  return { query, setQuery, users, loading, error: errorMessage };
}
