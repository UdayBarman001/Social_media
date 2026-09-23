import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginDevice } from "../services/api";

// Two separate, deliberately-decoupled pieces of state:
//   - DEVICE_ID_KEY: a permanent id generated once, the first time the app
//     is ever opened on this device. Never changes. This — not the name —
//     is what posts/comments/likes/follows are actually linked to.
//   - NAME_KEY: whatever the person typed as their display label. Purely
//     cosmetic; changing it never disconnects them from past posts, since
//     nothing is keyed on it.
const DEVICE_ID_KEY = "local_device_id";
const NAME_KEY = "local_user_name";
const USER_KEY = "local_user_profile";

// RFC4122-ish v4 UUID. No crypto dependency needed — this only has to be
// unique-per-device, not unguessable (this identity model is explicitly
// not a security mechanism, see the migration script's file header).
function generateDeviceId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Resolves the device's real backend identity. Returns:
 *   user     — complete canonical public User object
 *   userId   — backend User Mongo _id derived from that object
 *   name     — current display name derived from that object
 *   isReady  — false until the initial identity resolution attempt finishes
 *   setName  — first-launch/device identity bootstrap
 *   updateUser — replaces the canonical user after a successful profile write
 */
export function useLocalUser() {
  const [user, setUserState] = useState(null);
  const userId = user?.id ?? user?._id ?? null;
  const name = user?.name ?? null;
  const [isReady, setIsReady] = useState(false);

  const persistUser = useCallback(async (nextUser) => {
    if (!nextUser) return;
    try {
      await Promise.all([
        AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser)),
        nextUser.name
          ? AsyncStorage.setItem(NAME_KEY, nextUser.name)
          : Promise.resolve(),
      ]);
    } catch (error) {
      // In-memory state must still become canonical after a successful API
      // write. The next launch will re-resolve the user from the backend.
      console.warn("Failed to persist local user profile:", error);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
          deviceId = generateDeviceId();
          await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        }

        const [cachedProfileRaw, cachedName] = await Promise.all([
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(NAME_KEY),
        ]);

        // Hydrate the full canonical-shaped user immediately when available.
        // The server response below remains authoritative and replaces this
        // snapshot as soon as device identity resolution succeeds.
        if (cachedProfileRaw) {
          try {
            const cachedProfile = JSON.parse(cachedProfileRaw);
            if (cachedProfile?.name) setUserState(cachedProfile);
          } catch {
            // Corrupt persisted profile is ignored; server resolution below
            // will rebuild it.
          }
        }

        if (cachedName) {
          const resolvedUser = await loginDevice(deviceId, cachedName);
          await persistUser(resolvedUser);
          setUserState(resolvedUser);
        }
      } catch {
        // Backend unreachable, etc. — leave userId null; DisplayNamePrompt
        // (or a retry on next launch) will pick it back up.
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setName = useCallback(async (newName) => {
    const trimmed = newName.trim();
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    const resolvedUser = await loginDevice(deviceId, trimmed);
    await persistUser(resolvedUser);
    setUserState(resolvedUser);
  }, [persistUser]);

  // Single canonical user write path for profile mutations. Every successful
  // profile/avatar mutation calls this with the server's complete response.
  const updateUser = useCallback(async (nextUser) => {
    if (!nextUser) return;
    await persistUser(nextUser);
    setUserState(nextUser);
  }, [persistUser]);

  // In-memory-only update — deliberately does NOT persist to AsyncStorage.
  // Used for *optimistic* mutation state (a profile/avatar mutation's
  // onMutate) that hasn't been confirmed by the server yet.
  //
  // Persisting an optimistic guess was a real bug: useUpdateAvatarMutation's
  // onMutate used to call updateUser() with the picked photo's local
  // `file://...` device URI as a stand-in for the not-yet-uploaded CDN
  // url. If the app was closed/crashed before the upload actually finished
  // (easy to do — the edit sheet closes immediately on Save), that local
  // file path got written to AsyncStorage as if it were the real,
  // confirmed avatarUrl. The upload never happened server-side, so on the
  // next launch the app hydrated straight from that stale local path —
  // which Expo's temp file cache may have already cleared, or which never
  // existed anywhere but that one device. Avatar.jsx only checks `if
  // (uri)`, not whether the file is actually reachable, so the person was
  // left with a silently broken avatar and no error, no retry, nothing
  // that explains why — until they happened to edit their profile again.
  //
  // The fix: optimistic updates go through this (memory-only) path, and
  // only a server-confirmed response (onSuccess) — or a rollback to the
  // last known-good, already-persisted user (onError) — goes through the
  // real, persisting updateUser() above. That way AsyncStorage can never
  // hold a value the backend hasn't actually confirmed.
  //
  // Accepts a patch object OR an updater function `(current) => patch`.
  // BUG FIX: EditProfileSheet's Save fires updateAvatar.mutate() and
  // updateProfile.mutate() together — even on an avatar-only edit, since
  // it unconditionally calls both. Each mutation's onMutate used to build
  // its optimistic value as `{...previousUser, ...ownFields}`, where
  // `previousUser` was `user` captured by closure at the moment
  // EditProfileSheet rendered and created these mutation hooks — a single
  // shared, stale snapshot, NOT whatever the other mutation had just
  // applied. So whichever onMutate ran second (order isn't guaranteed —
  // both fire from the same handleSave tick) recomputed its patch from
  // that same stale base and stomped the first mutation's change: e.g.
  // updateAvatar sets {...stale, avatarUrl: new}, then updateProfile
  // (fields unchanged, since the person only touched the photo) sets
  // {...stale, name/handle/bio/location: same-as-before} — which still
  // carries the OLD avatarUrl from the stale snapshot, visibly reverting
  // the just-picked photo back to old until the avatar upload's onSuccess
  // eventually arrives and fixes it for real. Passing an updater function
  // through to setUserState's functional form means each optimistic patch
  // is always applied on top of whatever the CURRENT state actually is
  // when React flushes it, not a stale closure — so the two mutations'
  // optimistic updates compose instead of one clobbering the other,
  // regardless of firing order.
  const setOptimisticUser = useCallback((nextUserOrUpdater) => {
    setUserState((current) => {
      const next =
        typeof nextUserOrUpdater === "function"
          ? nextUserOrUpdater(current)
          : nextUserOrUpdater;
      return next ?? current;
    });
  }, []);

  // Backward-compatible helper for any caller that only needs to synchronize
  // the cached display name. New profile mutations should prefer updateUser().
  const syncLocalName = useCallback(async (newName) => {
    const trimmed = newName.trim();
    setUserState((current) => (current ? { ...current, name: trimmed } : current));
    try {
      await AsyncStorage.setItem(NAME_KEY, trimmed);
      const currentRaw = await AsyncStorage.getItem(USER_KEY);
      if (currentRaw) {
        const current = JSON.parse(currentRaw);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify({ ...current, name: trimmed }));
      }
    } catch (error) {
      console.warn("Failed to sync local user name:", error);
    }
  }, []);

  return { user, userId, name, isReady, setName, updateUser, setOptimisticUser, syncLocalName };
}