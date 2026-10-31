import { adminFetch } from "./adminApi";

export async function listDataResources(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const suffix = query.toString() ? `?${query}` : "";
  return adminFetch(`/api/admin/data-management/resources${suffix}`);
}

export async function previewResourceDeletion(body) {
  return adminFetch("/api/admin/data-management/resources/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function exportResources(body) {
  return adminFetch("/api/admin/data-management/resources/export", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteResources(body) {
  return adminFetch("/api/admin/data-management/resources/delete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listManagedStudents(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const suffix = query.toString() ? `?${query}` : "";
  return adminFetch(`/api/admin/data-management/students${suffix}`);
}

export async function setStudentTestFlag(id, isTestAccount) {
  return adminFetch(`/api/admin/data-management/students/${id}/test-flag`, {
    method: "PATCH",
    body: JSON.stringify({ isTestAccount }),
  });
}

export async function previewStudentDeletion(body) {
  return adminFetch("/api/admin/data-management/students/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function exportStudents(body) {
  return adminFetch("/api/admin/data-management/students/export", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteTestStudents(body) {
  return adminFetch("/api/admin/data-management/students/delete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getActivityCleanupStats() {
  return adminFetch("/api/admin/data-management/activity/stats");
}

export async function previewActivityClear(body) {
  return adminFetch("/api/admin/data-management/activity/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function exportActivity(body) {
  return adminFetch("/api/admin/data-management/activity/export", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function clearActivity(body) {
  return adminFetch("/api/admin/data-management/activity/clear", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listDataAuditLogs() {
  return adminFetch("/api/admin/data-management/audit");
}

export function downloadJsonExport(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
