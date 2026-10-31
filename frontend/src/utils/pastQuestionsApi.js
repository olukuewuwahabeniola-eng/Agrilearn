import { apiFetch, getApiBaseUrl, getToken } from "./api";

export function formatPastQuestionDate(value) {
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

export async function listPastQuestions({
  courseCode = "",
  examYear = "",
  q = "",
} = {}) {
  const params = new URLSearchParams();
  if (courseCode) params.set("courseCode", courseCode);
  if (examYear) params.set("examYear", examYear);
  if (q) params.set("q", q);
  const query = params.toString();
  return apiFetch(`/api/past-questions${query ? `?${query}` : ""}`);
}

export async function getPastQuestion(id) {
  return apiFetch(`/api/past-questions/${id}`);
}

export function pastQuestionFileUrl(pastQuestionId, fileIndex, { download = false } = {}) {
  const base = getApiBaseUrl();
  const suffix = download ? "?download=1" : "";
  return `${base}/api/past-questions/${pastQuestionId}/files/${fileIndex}/file${suffix}`;
}

export async function fetchPastQuestionFileBlob(pastQuestionId, fileIndex, options = {}) {
  const token = getToken();
  const url = pastQuestionFileUrl(pastQuestionId, fileIndex, options);
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
  return response.blob();
}

export async function downloadPastQuestionFile(
  pastQuestionId,
  fileIndex,
  filename = "past-question"
) {
  const blob = await fetchPastQuestionFileBlob(pastQuestionId, fileIndex, {
    download: true,
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
