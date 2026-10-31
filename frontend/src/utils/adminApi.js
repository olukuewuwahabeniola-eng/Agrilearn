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
