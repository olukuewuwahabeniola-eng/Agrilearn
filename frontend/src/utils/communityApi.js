import { apiFetch, getApiBaseUrl, getToken } from "./api";
import { typedBlob } from "./fileBlobs";
import { uploadFormWithProgress } from "./uploadFormWithProgress";

export function communityFileUrl(messageId, { download = false } = {}) {
  const suffix = download ? "?download=1" : "";
  return `${getApiBaseUrl()}/api/community/messages/${messageId}/file${suffix}`;
}

export function communityAvatarUrl(studentId) {
  return `${getApiBaseUrl()}/api/community/avatars/${studentId}`;
}

export async function fetchCommunity() {
  return apiFetch("/api/community");
}

export async function fetchCommunityMessages({ before } = {}) {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  const query = params.toString();
  return apiFetch(`/api/community/messages${query ? `?${query}` : ""}`);
}

export async function sendCommunityMessage(text) {
  return apiFetch("/api/community/messages", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function uploadCommunityFile({ file, text = "", onProgress }) {
  const form = new FormData();
  form.append("file", file);
  if (text) form.append("text", text);
  return uploadFormWithProgress({
    url: `${getApiBaseUrl()}/api/community/messages/upload`,
    method: "POST",
    form,
    credentials: "same-origin",
    headers: {
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    onProgress,
  });
}

export async function searchCommunityMessages(q) {
  const params = new URLSearchParams({ q });
  return apiFetch(`/api/community/search?${params.toString()}`);
}

export async function reportCommunityMessage(id, reason) {
  return apiFetch(`/api/community/messages/${id}/report`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function uploadProfilePicture(file, onProgress) {
  const form = new FormData();
  form.append("file", file);
  return uploadFormWithProgress({
    url: `${getApiBaseUrl()}/api/community/avatar`,
    method: "POST",
    form,
    credentials: "same-origin",
    headers: {
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    onProgress,
  });
}

export async function fetchAuthorizedBlob(url, { admin = false } = {}) {
  const headers = {};
  if (admin) {
    const token = localStorage.getItem("agrilearn_admin_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  } else {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    headers,
    credentials: admin ? "include" : "same-origin",
  });
  if (!response.ok) {
    throw new Error("Could not load file.");
  }
  const blob = await response.blob();
  const mime = response.headers.get("Content-Type") || blob.type;
  return typedBlob(blob, mime);
}

export function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMessageTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
