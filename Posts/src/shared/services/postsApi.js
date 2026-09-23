import * as FileSystem from "expo-file-system/legacy";
import {
  API_URL,
  UPLOAD_TIMEOUT_MS,
  normalize,
  request,
  requestWithMeta,
  uploadWithTimeout,
} from "./client";

// Fetches global posts
export async function fetchPosts() {
  const data = await request("/posts");
  return (data.posts ?? []).map(normalize);
}

// Scoped author posts for profile view
export async function fetchUserPosts(authorId) {
  const data = await request(`/posts?authorId=${encodeURIComponent(authorId)}&limit=100`);
  return (data.posts ?? []).map(normalize);
}

// Paginated feed fetch supporting page-based and cursor-based loading
export async function fetchPostsPage({ page = 1, limit = 20, cursor = null, tag = null } = {}) {
  const tagQs = tag ? `&tag=${encodeURIComponent(tag)}` : "";
  const qs = cursor
    ? `cursor=${encodeURIComponent(cursor)}&limit=${limit}${tagQs}`
    : `page=${page}&limit=${limit}${tagQs}`;
  const { data, meta } = await requestWithMeta(`/posts?${qs}`);
  return { posts: (data.posts ?? []).map(normalize), meta };
}

// Fetches a single post by ID
export async function fetchPostById(id) {
  const data = await request(`/posts/${id}`);
  return normalize(data.post);
}

// Likes a post
export async function likePost(id, userId) {
  const data = await request(`/posts/${id}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return normalize(data.post);
}

// Unlikes a post
export async function unlikePost(id, userId) {
  const data = await request(`/posts/${id}/unlike`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return normalize(data.post);
}

// Deletes a post
export async function deletePost(id, userId) {
  await request(`/posts/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

// Appends a single image to an existing post
export async function addPostImage(postId, imageUri, userId) {
  const result = await uploadWithTimeout(
    `${API_URL}/api/v1/posts/${postId}/images`,
    imageUri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "image",
      mimeType: "image/jpeg",
      parameters: { userId },
    },
    UPLOAD_TIMEOUT_MS
  );

  if (result.status < 200 || result.status >= 300) {
    let message = `Request failed (${result.status})`;
    try {
      message = JSON.parse(result.body)?.message || message;
    } catch {}
    throw new Error(message);
  }

  return JSON.parse(result.body).data.post;
}

// Updates post text and retains/adds images
export async function updatePost(id, fields, imageState, userId) {
  const { keepUrls = null, newImageUris = [] } = imageState || {};
  const isLocalFile = (uri) => /^(file|content|ph|assets-library):/.test(uri);
  const localUris = newImageUris.filter(isLocalFile);

  if (localUris.length > 0) {
    const [firstUri, ...restUris] = localUris;

    const result = await uploadWithTimeout(
      `${API_URL}/api/v1/posts/${id}`,
      firstUri,
      {
        httpMethod: "PATCH",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "images",
        mimeType: "image/jpeg",
        parameters: {
          userId,
          ...(keepUrls !== null ? { keepImageUrls: JSON.stringify(keepUrls) } : {}),
          ...(fields.description !== undefined ? { description: fields.description } : {}),
        },
      },
      UPLOAD_TIMEOUT_MS
    );

    if (result.status < 200 || result.status >= 300) {
      let message = `Request failed (${result.status})`;
      try {
        message = JSON.parse(result.body)?.message || message;
      } catch {}
      throw new Error(message);
    }

    let post = JSON.parse(result.body).data.post;

    for (const uri of restUris) {
      post = await addPostImage(post.id, uri, userId);
    }

    return normalize(post);
  }

  const data = await request(`/posts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...fields,
      userId,
      ...(keepUrls !== null ? { keepImageUrls: keepUrls } : {}),
    }),
  });
  return normalize(data.post);
}

// Creates a post with support for multi-image sequential uploads and resume
export async function createPost(fields, imageUris, userId, options = {}) {
  const { existingPostId = null, onPostCreated, onImageUploaded } = options;
  const uris = (Array.isArray(imageUris) ? imageUris : imageUris ? [imageUris] : []).filter(Boolean);
  const isLocalFile = (uri) => /^(file|content|ph|assets-library):/.test(uri);
  const localUris = uris.filter(isLocalFile);

  // Resume partial upload attempt
  if (existingPostId) {
    let post = null;
    for (const uri of localUris) {
      post = await addPostImage(existingPostId, uri, userId);
      onImageUploaded?.(uri);
    }
    if (!post) {
      post = await fetchPostById(existingPostId);
      return post;
    }
    return normalize(post);
  }

  if (localUris.length > 0) {
    const [firstUri, ...restUris] = localUris;

    const result = await uploadWithTimeout(
      `${API_URL}/api/v1/posts`,
      firstUri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "images",
        mimeType: "image/jpeg",
        parameters: {
          userId,
          author: userId,
          description: fields.description ?? "",
          ...(fields.location ? { location: fields.location } : {}),
          audience: fields.audience ?? "Public",
          tags: JSON.stringify(fields.tags ?? []),
        },
      },
      UPLOAD_TIMEOUT_MS
    );

    if (result.status < 200 || result.status >= 300) {
      let message = `Request failed (${result.status})`;
      try {
        message = JSON.parse(result.body)?.message || message;
      } catch {}
      throw new Error(message);
    }

    let post = JSON.parse(result.body).data.post;
    onPostCreated?.(post.id);
    onImageUploaded?.(firstUri);

    for (const uri of restUris) {
      post = await addPostImage(post.id, uri, userId);
      onImageUploaded?.(uri);
    }

    return normalize(post);
  }

  const data = await request("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, userId, author: userId }),
  });
  onPostCreated?.(data.post.id);
  return normalize(data.post);
}
