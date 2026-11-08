import { objectUrlForBlob, typedBlob } from "./fileBlobs";
import { uploadFormWithProgress } from "./uploadFormWithProgress";

/**
 * Admin API helpers.
 * Auth: HTTP-only cookie (credentials) + optional Bearer token backup.
 * Admin role is always verified by the backend on protected routes.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const ADMIN_TOKEN_KEY = "agrilearn_admin_token";
const ADMIN_KEY = "agrilearn_admin";
const ADMIN_HINT_KEY = "agrilearn_admin_session";

export function getAdminApiBaseUrl() {
  return API_BASE_URL.replace(/\/$/, "");
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getStoredAdmin() {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Soft hint only — never used alone to grant access. */
export function hasAdminSessionHint() {
  return (
    localStorage.getItem(ADMIN_HINT_KEY) === "1" || Boolean(getAdminToken())
  );
}

export function setAdminSession(token, admin) {
  localStorage.setItem(ADMIN_HINT_KEY, "1");
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  if (admin) localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
  localStorage.removeItem(ADMIN_HINT_KEY);
}

export async function adminFetch(path, options = {}) {
  const url = `${getAdminApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const token = getAdminToken();
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      (data && data.message) || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function uploadAdminNote(form, { onProgress } = {}) {
  const url = `${getAdminApiBaseUrl()}/api/admin/notes`;
  const token = getAdminToken();

  if (typeof onProgress === "function") {
    return uploadFormWithProgress({
      url,
      method: "POST",
      form,
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      onProgress,
    });
  }

  return adminFetch("/api/admin/notes", {
    method: "POST",
    body: form,
  });
}

export function adminNoteFileUrl(noteId, fileIndex = 0, { download = false } = {}) {
  const suffix = download ? "?download=1" : "";
  return `${getAdminApiBaseUrl()}/api/admin/notes/${noteId}/files/${fileIndex}/file${suffix}`;
}

export async function fetchAdminNotePageBlob(noteId, fileIndex = 0, options = {}) {
  const token = getAdminToken();
  const response = await fetch(adminNoteFileUrl(noteId, fileIndex, options), {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Could not open file (${response.status})`);
  }
  const blob = await response.blob();
  const mime = response.headers.get("Content-Type") || blob.type;
  return typedBlob(blob, mime);
}

export async function fetchAdminNotePreviewUrls(note) {
  const count = Math.max(
    1,
    Number(note?.pageCount) || (Array.isArray(note?.files) ? note.files.length : 1)
  );
  const mime =
    note?.format === "images" || note?.fileType === "Images"
      ? undefined
      : "application/pdf";
  const urls = [];
  for (let index = 0; index < count; index += 1) {
    const blob = await fetchAdminNotePageBlob(note.id, index);
    urls.push(objectUrlForBlob(blob, mime || blob.type));
  }
  return urls;
}

export async function downloadAdminNote(note) {
  const count = Math.max(
    1,
    Number(note?.pageCount) || (Array.isArray(note?.files) ? note.files.length : 1)
  );
  const isImages = note?.format === "images" || count > 1;
  for (let index = 0; index < count; index += 1) {
    const blob = await fetchAdminNotePageBlob(note.id, index, { download: true });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download =
      note.files?.[index]?.originalName ||
      note.originalName ||
      (isImages ? `page-${index + 1}` : "notes.pdf");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    if (!isImages) break;
  }
}
