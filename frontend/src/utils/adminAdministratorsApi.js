import { adminFetch } from "./adminApi";

export function listAdministrators(params = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.role) search.set("role", params.role);
  if (params.level) search.set("level", params.level);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return adminFetch(`/api/admin/administrators${suffix}`);
}

export function createAdministrator(body) {
  return adminFetch("/api/admin/administrators", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAdministrator(id, body) {
  return adminFetch(`/api/admin/administrators/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function resetAdministratorAccess(id, body = {}) {
  return adminFetch(`/api/admin/administrators/${id}/reset-access`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteAdministrator(id) {
  return adminFetch(`/api/admin/administrators/${id}`, {
    method: "DELETE",
  });
}
