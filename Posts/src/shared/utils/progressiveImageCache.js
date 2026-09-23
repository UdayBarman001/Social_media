import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "PROGRESSIVE_IMAGE_FULL_LOADED_V1";
const MAX_ENTRIES = 500;

export const fullyLoadedUris = new Set();
let hydrated = false;
let writeTimer = null;

export async function hydrateFullyLoadedUris() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) JSON.parse(raw).forEach((uri) => fullyLoadedUris.add(uri));
  } catch {}
}

export function markUriFullyLoaded(uri) {
  if (fullyLoadedUris.has(uri)) return;
  fullyLoadedUris.add(uri);
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const list = Array.from(fullyLoadedUris).slice(-MAX_ENTRIES);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)).catch(() => {});
  }, 1000);
}
