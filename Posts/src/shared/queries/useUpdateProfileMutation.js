import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Alert } from 'react-native';
import { updateUserProfile } from '../services/api';
import { useUser } from '../context/LocalUserContext';
import { syncUserInQueryCache } from '../utils/userCache';

/**
 * Profile writes are serialized per hook instance so two rapid saves cannot
 * overlap and allow an older server response to overwrite a newer edit.
 *
 * Optimistic: onMutate applies the edited fields to local state and every
 * mounted query the instant Save is tapped — the caller (EditProfileSheet)
 * doesn't await the network round-trip at all, it fires this and closes
 * immediately. The actual PATCH still happens, validates uniqueness, etc.
 * in the background; its response is authoritative and overwrites this
 * guess on success (onSuccess), or the guess is rolled back on failure
 * (onError) since by then the sheet is long closed and can't just show a
 * validation error inline the way it used to.
 */
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const { user, updateUser, setOptimisticUser } = useUser();
  const queueRef = useRef(Promise.resolve());

  return useMutation({
    mutationFn: async ({ userId, fields }) => {
      const previous = queueRef.current.catch(() => {});
      let release;
      queueRef.current = new Promise((resolve) => {
        release = resolve;
      });

      await previous;
      try {
        return await updateUserProfile(userId, fields);
      } finally {
        release();
      }
    },
    onMutate: async ({ fields }) => {
      const previousUser = user;
      if (previousUser) {
        // Memory-only — same reasoning as useUpdateAvatarMutation's
        // onMutate: these fields haven't been confirmed by the server yet
        // (e.g. a handle could still turn out to be taken), so they must
        // not be written to AsyncStorage until they actually are. See
        // useLocalUser.js's setOptimisticUser for the full explanation.
        //
        // BUG FIX: EditProfileSheet's handleSave used to unconditionally
        // fire this mutation alongside updateAvatar's, even on an
        // avatar-only edit (fields here would just be the person's
        // unchanged existing name/handle/bio/location). The old code
        // built its optimistic value as `{...previousUser, ...fields}`
        // from `previousUser`, a value captured by closure at the render
        // that created this hook — a stale snapshot that had no idea
        // updateAvatar's onMutate had *just* set a new avatarUrl. That
        // merge silently carried the OLD avatarUrl forward, so this
        // mutation's setOptimisticUser call overwrote the just-applied
        // new avatar back to the old one — visible as the picked photo
        // reverting, until the avatar upload's onSuccess eventually
        // arrived (after the network round-trip) and set it again for
        // real. Using setOptimisticUser's updater form instead means this
        // merges onto whatever the LIVE state actually is when React
        // applies it — including any avatarUrl updateAvatar's onMutate
        // already set — so the two optimistic updates compose instead of
        // one clobbering the other, regardless of which mutation's
        // onMutate happens to run first.
        let mergedUser = null;
        setOptimisticUser((current) => {
          mergedUser = current ? { ...current, ...fields } : current;
          return mergedUser;
        });
        if (mergedUser) syncUserInQueryCache(queryClient, mergedUser);
      }
      return { previousUser };
    },
    onError: async (err, _vars, context) => {
      // The network write actually failed (e.g. handle taken) after the UI
      // had already moved on — roll every optimistic view back to what the
      // server still actually has, and only now surface it to the person.
      if (context?.previousUser) {
        await updateUser(context.previousUser);
        syncUserInQueryCache(queryClient, context.previousUser);
      }
      Alert.alert(
        "Couldn't save profile changes",
        err?.message || "Please check your connection and try again.",
      );
    },
    onSuccess: async (updatedUser) => {
      // API response is authoritative — replaces the optimistic guess with
      // the server's real (e.g. case-normalized) values.
      await updateUser(updatedUser);
      syncUserInQueryCache(queryClient, updatedUser);
    },
  });
}