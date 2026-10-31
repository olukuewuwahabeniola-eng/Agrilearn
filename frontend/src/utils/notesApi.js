import { apiFetch, getApiBaseUrl, getToken } from "./api";

/**
 * Notes & Resources API helpers (level-gated on the backend).
 * library: "official" (General Materials) | "personal" (My Personal Uploads)
 */

export function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatNoteDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export async function listNotes({
  library = "official",
  courseCode = "",
  q = "",
} = {}) {
  const params = new URLSearchParams();
  params.set("library", library);
  if (courseCode) params.set("courseCode", courseCode);
  if (q) params.set("q", q);
  return apiFetch(`/api/notes?${params.toString()}`);
}

export async function getNote(noteId) {
  return apiFetch(`/api/notes/${noteId}`);
}

export async function uploadNote({
  file,
  courseCode,
  title = "",
  description = "",
}) {
  const form = new FormData();
  form.append("pdf", file);
  form.append("courseCode", courseCode);
  if (title) form.append("title", title);
  if (description) form.append("description", description);
  return apiFetch("/api/notes", {
    method: "POST",
    body: form,
  });
}

export async function deleteNote(noteId) {
  return apiFetch(`/api/notes/${noteId}`, {
    method: "DELETE",
  });
}

export async function downloadNoteFile(noteId, filename = "notes.pdf") {
  const token = getToken();
  const url = `${getApiBaseUrl()}/api/notes/${noteId}/file`;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = `Download failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
