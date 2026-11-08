import { adminFetch, getAdminApiBaseUrl, getAdminToken } from "./adminApi";
import { uploadFormWithProgress } from "./uploadFormWithProgress";

export function adminCommunityFileUrl(messageId, { download = false } = {}) {
  const suffix = download ? "?download=1" : "";
  return `${getAdminApiBaseUrl()}/api/admin/community/messages/${messageId}/file${suffix}`;
}

export function fetchAdminCommunityOverview() {
  return adminFetch("/api/admin/community/overview");
}

export function fetchAdminCommunity(level) {
  return adminFetch(`/api/admin/community/${level}`);
}

export function fetchAdminCommunityMessages(level, { before } = {}) {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  const query = params.toString();
  return adminFetch(
    `/api/admin/community/${level}/messages${query ? `?${query}` : ""}`
  );
}

export function postAdminAnnouncement(level, text) {
  return adminFetch(`/api/admin/community/${level}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function uploadAdminAnnouncement({ level, file, text = "", onProgress }) {
  const form = new FormData();
  form.append("file", file);
  if (text) form.append("text", text);
  return uploadFormWithProgress({
    url: `${getAdminApiBaseUrl()}/api/admin/community/${level}/messages/upload`,
    method: "POST",
    form,
    credentials: "include",
    headers: {
      ...(getAdminToken() ? { Authorization: `Bearer ${getAdminToken()}` } : {}),
    },
    onProgress,
  });
}

export function searchAdminCommunityMessages({ q, level } = {}) {
  const params = new URLSearchParams({ q });
  if (level) params.set("level", level);
  return adminFetch(`/api/admin/community/search?${params.toString()}`);
}

export function fetchAdminCommunityReports({ level, status = "open" } = {}) {
  const params = new URLSearchParams({ status });
  if (level) params.set("level", level);
  return adminFetch(`/api/admin/community/reports?${params.toString()}`);
}

export function reviewAdminCommunityReport(id, { status, note } = {}) {
  return adminFetch(`/api/admin/community/reports/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });
}

export function deleteAdminCommunityMessage(id) {
  return adminFetch(`/api/admin/community/messages/${id}`, {
    method: "DELETE",
  });
}

export function setAdminCommunityAccess(studentId, { restricted, reason } = {}) {
  return adminFetch(`/api/admin/community/students/${studentId}/access`, {
    method: "PATCH",
    body: JSON.stringify({ restricted, reason }),
  });
}

export function fetchAdminCommunityAttachments(level, { kind } = {}) {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  const query = params.toString();
  return adminFetch(
    `/api/admin/community/${level}/attachments${query ? `?${query}` : ""}`
  );
}

export function fetchAdminCommunityLog({ level } = {}) {
  const params = new URLSearchParams();
  if (level) params.set("level", level);
  const query = params.toString();
  return adminFetch(
    `/api/admin/community/moderation-log${query ? `?${query}` : ""}`
  );
}
