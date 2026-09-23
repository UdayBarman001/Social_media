import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePost } from '../services/api';

export function useUpdatePostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    // `imageState` is `{ keepUrls, newImageUris }` or null/undefined for a
    // text-only edit — matches api.js's updatePost(id, fields, imageState,
    // userId) signature exactly. Previously this passed (imageUri,
    // removeImage, userId) as three separate positional args against a
    // four-arg function, which silently shifted every value one slot to
    // the left: updatePost's `userId` param received the `removeImage`
    // boolean instead, and the real userId was dropped entirely — so
    // saved edits were sent as anonymous/invalid requests, and imageState
    // was a bare string/boolean instead of an object, so the multi-image
    // branch never ran and image edits never actually reached the server.
    mutationFn: ({ id, fields, imageState, userId }) =>
      updatePost(id, fields, imageState, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', variables.id] });
      // Edit is author-only, so variables.userId is this post's author —
      // same ['userPosts', authorId] cache the other post mutations keep
      // in sync (see useCreatePostMutation/useDeletePostMutation).
      if (variables?.userId) {
        queryClient.invalidateQueries({ queryKey: ['userPosts', variables.userId] });
      }
    },
  });
}