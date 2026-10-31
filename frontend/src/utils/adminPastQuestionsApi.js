import { adminFetch, getAdminApiBaseUrl, getAdminToken } from "./adminApi";

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

export function adminPastQuestionFileUrl(id, fileIndex) {
  return `${getAdminApiBaseUrl()}/api/admin/past-questions/${id}/files/${fileIndex}/file`;
}

export async function fetchAdminPastQuestionFileBlob(id, fileIndex) {
  const token = getAdminToken();
  const response = await fetch(adminPastQuestionFileUrl(id, fileIndex), {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Could not open file (${response.status})`);
  }
  return response.blob();
}
