import { adminFetch, getAdminApiBaseUrl, getAdminToken } from "./adminApi";
import { objectUrlForBlob, typedBlob } from "./fileBlobs";

export async function listAdminPastQuestions(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value != null) search.set(key, String(value));
  });
  const query = search.toString();
  return adminFetch(`/api/admin/past-questions${query ? `?${query}` : ""}`);
}

export async function createAdminPastQuestion(formData) {
  return adminFetch("/api/admin/past-questions", {
    method: "POST",
    body: formData,
  });
}

export async function updateAdminPastQuestion(id, body) {
  return adminFetch(`/api/admin/past-questions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function replaceAdminPastQuestionFiles(id, formData) {
  return adminFetch(`/api/admin/past-questions/${id}/files`, {
    method: "PUT",
    body: formData,
  });
}

export async function deleteAdminPastQuestion(id) {
  return adminFetch(`/api/admin/past-questions/${id}`, {
    method: "DELETE",
  });
}

export function adminPastQuestionFileUrl(id, fileIndex, { download = false } = {}) {
  const suffix = download ? "?download=1" : "";
  return `${getAdminApiBaseUrl()}/api/admin/past-questions/${id}/files/${fileIndex}/file${suffix}`;
}

export async function fetchAdminPastQuestionFileBlob(id, fileIndex, options = {}) {
  const token = getAdminToken();
  const response = await fetch(adminPastQuestionFileUrl(id, fileIndex, options), {
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

export async function fetchAdminPastQuestionPreviewUrls(item) {
  const count = Math.max(1, Number(item?.pageCount) || 1);
  const mime = item?.format === "images" ? undefined : "application/pdf";
  const urls = [];
  for (let index = 0; index < count; index += 1) {
    const blob = await fetchAdminPastQuestionFileBlob(item.id, index);
    urls.push(objectUrlForBlob(blob, mime || blob.type));
  }
  return urls;
}

export async function downloadAdminPastQuestion(item) {
  const count = Math.max(1, Number(item?.pageCount) || 1);
  for (let index = 0; index < count; index += 1) {
    const blob = await fetchAdminPastQuestionFileBlob(item.id, index, {
      download: true,
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download =
      item.files?.[index]?.originalName ||
      `${item.courseCode || "past-question"}-${index + 1}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
