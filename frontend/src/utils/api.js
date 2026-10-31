/**
 * Shared API helper for talking to the AgriLearn backend.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const TOKEN_KEY = "agrilearn_token";
const STUDENT_KEY = "agrilearn_student";

export function getApiBaseUrl() {
  return API_BASE_URL.replace(/\/$/, "");
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthSession(token, student) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (student) localStorage.setItem(STUDENT_KEY, JSON.stringify(student));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(STUDENT_KEY);
}

export function getStoredStudent() {
  try {
    const raw = localStorage.getItem(STUDENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Small wrapper around fetch for backend requests.
 * Automatically attaches the JWT when present.
 */
export async function apiFetch(path, options = {}) {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const token = getToken();
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    headers: {
      // Let the browser set multipart boundary for FormData uploads.
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
