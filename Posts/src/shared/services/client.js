import * as FileSystem from "expo-file-system/legacy";
import { API_URL } from "./config";

export { API_URL };

// Timeouts: JSON requests get 15s; multipart image uploads get 45s
export const JSON_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 45_000;

// fetch() wrapper with timeout signal
export async function fetchWithTimeout(url, options = {}, timeoutMs = JSON_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// FileSystem.uploadAsync wrapper with timeout race
export function uploadWithTimeout(url, fileUri, options, timeoutMs = UPLOAD_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Upload timed out. Please check your connection and try again."));
    }, timeoutMs);

    FileSystem.uploadAsync(url, fileUri, options)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Normalizes post response to guarantee commentCount and non-negative counts
export function normalize(raw) {
  if (!raw) return raw;
  return {
    ...raw,
    likeCount: Math.max(0, raw.likeCount ?? 0),
    commentCount: Math.max(0, raw.commentCount ?? raw.comments?.length ?? 0),
  };
}

// Base request returning data envelope
export async function request(path, options) {
  const res = await fetchWithTimeout(`${API_URL}/api/v1${path}`, options, JSON_TIMEOUT_MS);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return body.data;
}

// Request returning both data and pagination meta
export async function requestWithMeta(path, options) {
  const res = await fetchWithTimeout(`${API_URL}/api/v1${path}`, options, JSON_TIMEOUT_MS);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return { data: body.data, meta: body.meta };
}
