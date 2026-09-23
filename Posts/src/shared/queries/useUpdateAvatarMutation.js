import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Alert } from 'react-native';
import { updateUserAvatar } from '../services/api';
import { useUser } from '../context/LocalUserContext';
import { syncUserInQueryCache } from '../utils/userCache';

/**
 * Avatar upload returns the complete canonical User. It is committed to the
 * same global user state/cache as text profile edits, so the UI has one
 * synchronization path regardless of which editable field changed.
 *
 * Optimistic: the locally-picked image URI is applied to local state and
 * every mounted query immediately in onMutate — the picked photo shows up
 * everywhere (feed, profile) right away, rather than the person staring at
 * their old avatar for however long the multipart upload + ImageKit
 * processing actually takes. onSuccess swaps that local file:// URI for
 * the real CDN url once the upload actually finishes in the background;
 * onError rolls back to the previous avatar and only then reports the
 * failure, since the sheet that started this is already closed.
 *
 * Stale-response guard: EditProfileSheet fires this mutation and closes
 * immediately without awaiting it (see its handleSave comment), so a
 * person can reopen the sheet and save a *different* photo again before
 * the first upload has finished. Nothing here can cancel the previous
 * upload — expo-file-system's legacy uploadAsync has no AbortSignal
 * support — so both requests genuinely run concurrently, and network
 * jitter means they can settle in either order. Without a guard, whichever
 * one *finishes* last would win, which can silently overwrite a newer,
 * already-confirmed avatar with an older one (and a late failure could
 * roll back past a newer success). requestIdRef is a monotonically
 * increasing counter: each mutate() call captures "its" id in onMutate,
 * and onSuccess/onError only apply their result if no newer avatar save
 * has started since — a stale result is silently dropped instead of
 * clobbering a newer one.
 */
export function useUpdateAvatarMutation() {
  const queryClient = useQueryClient();
  const { user, updateUser, setOptimisticUser } = useUser();
  const requestIdRef = useRef(0);

  return useMutation({
    mutationFn: ({ userId, imageUri }) => updateUserAvatar(userId, imageUri),
    onMutate: async ({ imageUri }) => {
      const requestId = ++requestIdRef.current;
      const previousUser = user;
      if (previousUser) {
        // Memory-only — this imageUri is still just a local device file
        // path, not the real uploaded CDN url yet. Persisting it here
        // (the old bug) meant a closed/crashed app before the upload
        // finished left AsyncStorage holding a dead local file path
        // forever, with no error and no retry. See useLocalUser.js's
        // setOptimisticUser for the full explanation.
        //
        // Captures the actual merged value via the updater's return, so
        // syncUserInQueryCache (which patches feed/post/comment caches —
        // e.g. this user's avatar on their own post cards) reflects the
        // same live-merged result the context itself just got, instead of
        // independently re-deriving it from the same stale `previousUser`
        // snapshot that caused the original race (see setOptimisticUser
        // in useLocalUser.js for the full race explanation).
        let mergedUser = null;
        setOptimisticUser((current) => {
          mergedUser = current ? { ...current, avatarUrl: imageUri } : current;
          return mergedUser;
        });
        if (mergedUser) syncUserInQueryCache(queryClient, mergedUser);
      }
      return { previousUser, requestId };
    },
    onError: async (err, _vars, context) => {
      // A newer save has started since this one — this result is stale,
      // don't let it roll back (or otherwise clobber) that newer attempt.
      if (context?.requestId !== requestIdRef.current) return;

      if (context?.previousUser) {
        // Rolling back to the last server-confirmed user — this was
        // already the persisted value before the optimistic update, so
        // going through the real (persisting) updateUser here is correct
        // and safe, not a repeat of the bug above.
        await updateUser(context.previousUser);
        syncUserInQueryCache(queryClient, context.previousUser);
      }
      Alert.alert(
        "Couldn't update avatar",
        err?.message || "Please check your connection and try again.",
      );
    },
    onSuccess: async (updatedUser, _vars, context) => {
      // Same staleness check as onError — an older upload finishing after
      // a newer one must not overwrite the newer (possibly already-
      // confirmed) avatar.
      if (context?.requestId !== requestIdRef.current) return;

      // Server-confirmed — safe to actually persist now.
      await updateUser(updatedUser);
      syncUserInQueryCache(queryClient, updatedUser);
    },
  });
}