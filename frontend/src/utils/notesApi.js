import { apiFetch, getApiBaseUrl, getToken } from "./api";
import { objectUrlForBlob, typedBlob } from "./fileBlobs";
import { uploadFormWithProgress } from "./uploadFormWithProgress";

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

export function noteFormatLabel(note) {
  if (note?.format === "images" || note?.fileType === "Images") return "Images";
  return "PDF";
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
  files,
  courseCode,
  title = "",
  description = "",
  onProgress,
}) {
  const form = new FormData();
  form.append("courseCode", courseCode);
  if (title) form.append("title", title);
  if (description) form.append("description", description);

  const imageFiles = Array.isArray(files) ? files.filter(Boolean) : [];
  if (imageFiles.length) {
    imageFiles.forEach((item) => form.append("images", item));
  } else if (file) {
    form.append("pdf", file);
  }

  if (typeof onProgress === "function") {
    return uploadFormWithProgress({
      url: `${getApiBaseUrl()}/api/notes`,
      method: "POST",
      form,
      credentials: "same-origin",
      headers: {
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      onProgress,
    });
  }

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

export function notePageFileUrl(noteId, fileIndex = 0, { download = false } = {}) {
  const suffix = download ? "?download=1" : "";
  if (fileIndex > 0) {
    return `${getApiBaseUrl()}/api/notes/${noteId}/files/${fileIndex}/file${suffix}`;
  }
  return `${getApiBaseUrl()}/api/notes/${noteId}/file${suffix}`;
}

export async function fetchNotePageBlob(noteId, fileIndex = 0, { download = false } = {}) {
  const token = getToken();
  const url = notePageFileUrl(noteId, fileIndex, { download });
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = `Could not open file (${response.status})`;
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const mime = response.headers.get("Content-Type") || blob.type;
  return typedBlob(blob, mime);
}

export async function fetchNoteFileBlob(noteId) {
  return fetchNotePageBlob(noteId, 0);
}

export async function fetchNotePreviewUrls(note) {
  const count = Math.max(
    1,
    Number(note?.pageCount) ||
      (Array.isArray(note?.files) ? note.files.length : 1)
  );
  const urls = [];
  const mime =
    note?.format === "images" || note?.fileType === "Images"
      ? undefined
      : "application/pdf";
  for (let index = 0; index < count; index += 1) {
    const blob = await fetchNotePageBlob(note.id, index);
    urls.push(objectUrlForBlob(blob, mime || blob.type));
  }
  return urls;
}

function triggerDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadNoteFile(noteId, filename = "notes.pdf") {
  const blob = await fetchNotePageBlob(noteId, 0, { download: true });
  triggerDownload(blob, filename);
}

export async function downloadNote(note) {
  const pages = Array.isArray(note?.files) && note.files.length
    ? note.files
    : [{ originalName: note?.originalName, index: 0 }];
  const isImages = note?.format === "images" || pages.length > 1;

  if (!isImages) {
    await downloadNoteFile(note.id, note.originalName || "notes.pdf");
    return;
  }

  for (let index = 0; index < pages.length; index += 1) {
    const blob = await fetchNotePageBlob(note.id, index, { download: true });
    triggerDownload(
      blob,
      pages[index]?.originalName || `page-${index + 1}.jpg`
    );
  }
}
