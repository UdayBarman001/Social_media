import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPost } from '../services/api';

export function useCreatePostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    // `options` (existingPostId/onPostCreated/onImageUploaded) is passed
    // straight through to createPost() — see api.js's createPost comment
    // for why this exists (resuming a partially-uploaded post on retry
    // instead of creating a duplicate).
    mutationFn: ({ fields, imageUris, userId, options }) => createPost(fields, imageUris, userId, options),
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      // ProfileScreen reads a separate ['userPosts', authorId] cache (see
      // useFetchUserPostsQuery) — without this it wouldn't show a just-
      // created post until something else happened to refetch it.
      if (post?.author) {
        queryClient.invalidateQueries({ queryKey: ['userPosts', post.author] });
      }
    },
  });
}