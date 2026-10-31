import { apiFetch } from "./api";

let overviewCache = null;
let overviewInflight = null;
const OVERVIEW_CACHE_MS = 8000;

/** Shared overview fetch so Overview + right rail do not double-hit the API. */
export async function getDashboardOverview({ force = false } = {}) {
  const now = Date.now();
  if (
    !force &&
    overviewCache &&
    now - overviewCache.at < OVERVIEW_CACHE_MS
  ) {
    return overviewCache.data;
  }
  if (!force && overviewInflight) {
    return overviewInflight;
  }

  overviewInflight = apiFetch("/api/dashboard/overview")
    .then((data) => {
      overviewCache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      overviewInflight = null;
    });

  return overviewInflight;
}

export function invalidateDashboardOverview() {
  overviewCache = null;
}

export async function getDashboardProgress(courseCode = "") {
  const params = new URLSearchParams();
  if (courseCode) params.set("courseCode", courseCode);
  const query = params.toString();
  return apiFetch(`/api/dashboard/progress${query ? `?${query}` : ""}`);
}

export async function getDashboardActivity(limit = 20) {
  return apiFetch(`/api/dashboard/activity?limit=${limit}`);
}

export async function recordCourseAccess(courseCode) {
  const data = await apiFetch("/api/dashboard/course-access", {
    method: "POST",
    body: JSON.stringify({ courseCode }),
  });
  invalidateDashboardOverview();
  return data;
}

export async function completeTopic(noteId) {
  const data = await apiFetch(`/api/dashboard/topics/${noteId}/complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  invalidateDashboardOverview();
  return data;
}

export async function completeQuiz({
  courseCode,
  quizTitle = "",
  score = null,
  maxScore = null,
}) {
  const data = await apiFetch("/api/dashboard/quizzes/complete", {
    method: "POST",
    body: JSON.stringify({ courseCode, quizTitle, score, maxScore }),
  });
  invalidateDashboardOverview();
  return data;
}

export async function listCompletedQuizzes() {
  return apiFetch("/api/dashboard/quizzes");
}

export function formatUploadDate(value) {
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
