import * as FileSystem from "expo-file-system/legacy";
import { API_URL, UPLOAD_TIMEOUT_MS, request, uploadWithTimeout } from "./client";

// Resolves or creates user associated with device
export async function loginDevice(deviceId, name) {
  const data = await request("/users/device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, name }),
  });
  return data.user;
}

// Fetches a user's public profile by Mongo ID
export async function fetchUserProfile(id) {
  const data = await request(`/users/id/${encodeURIComponent(id)}`);
  return data.user;
}

// Updates current user's profile information
export async function updateUserProfile(userId, fields) {
  const data = await request("/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...fields }),
  });
  return data.user;
}

// Uploads a new avatar image via multipart
export async function updateUserAvatar(userId, imageUri) {
  const result = await uploadWithTimeout(
    `${API_URL}/api/v1/users/me/avatar`,
    imageUri,
    {
      httpMethod: "PATCH",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "avatar",
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

  return JSON.parse(result.body).data.user;
}
