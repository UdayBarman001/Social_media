import AsyncStorage from "@react-native-async-storage/async-storage";
import { dehydrate, hydrate } from "@tanstack/react-query";

const CACHE_STORAGE_KEY = "KRISHIVERSE_QUERY_CACHE_V1";
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours TTL
const SAVE_THROTTLE_MS = 1200; // Debounce disk writes to protect flash storage

/**
 * Whitelist of queries that should be persisted to disk.
 * Skips error states, mutations, and non-essential ephemeral queries.
 */
function shouldDehydrateQuery(query) {
  if (query.state.status !== "success") return false;
  const rootKey = query.queryKey[0];
  const PERSISTED_QUERY_KEYS = [
    "feed",
    "userPosts",
    "savedPosts",
    "userProfile",
    "notifications",
    "post",
  ];
  return PERSISTED_QUERY_KEYS.includes(rootKey);
}

/**
 * Restores dehydrated query cache from AsyncStorage into queryClient.
 * Provides instant 0ms offline startup by populating in-memory query cache
 * before the first network request fires.
 *
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @returns {Promise<boolean>} True if valid cache was restored, false otherwise
 */
export async function restoreQueryCache(queryClient) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return false;

    const payload = JSON.parse(raw);
    if (!payload?.timestamp || !payload?.clientState) return false;

    // Check if cache exceeded maximum age
    if (Date.now() - payload.timestamp > MAX_CACHE_AGE_MS) {
      AsyncStorage.removeItem(CACHE_STORAGE_KEY).catch(() => {});
      return false;
    }

    hydrate(queryClient, payload.clientState);
    return true;
  } catch (error) {
    console.warn("Failed to restore query cache from AsyncStorage:", error?.message || error);
    return false;
  }
}

/**
 * Subscribes to QueryCache changes and periodically serializes fresh
 * successful query state to AsyncStorage.
 *
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @returns {() => void} Unsubscribe cleanup function
 */
export function setupQueryCachePersistence(queryClient) {
  let debounceTimer = null;

  const persistToDisk = async () => {
    try {
      const clientState = dehydrate(queryClient, {
        shouldDehydrateQuery,
      });

      if (!clientState?.queries || clientState.queries.length === 0) return;

      const payload = {
        timestamp: Date.now(),
        clientState,
      };

      await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("Failed to persist query cache to disk:", error?.message || error);
    }
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    // Only debounce write when a query successfully resolves with fresh data
    if (event?.type === "updated" && event.action?.type === "success") {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(persistToDisk, SAVE_THROTTLE_MS);
    }
  });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    unsubscribe();
  };
}
