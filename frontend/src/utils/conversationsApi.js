import { apiFetch } from "./api";

/**
 * AI conversation history API (MongoDB, student-owned).
 */

export async function listConversations(q = "") {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return apiFetch(`/api/ai/conversations${query}`);
}

export async function getConversation(id) {
  return apiFetch(`/api/ai/conversations/${id}`);
}

export async function deleteConversation(id) {
  return apiFetch(`/api/ai/conversations/${id}`, {
    method: "DELETE",
  });
}

export function formatConversationDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
