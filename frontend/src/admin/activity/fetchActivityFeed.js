import { adminFetch } from "../../utils/adminApi";
import {
  buildActivityParams,
  mapEventRow,
  mapQuizAttempt,
} from "./activityUtils";

/**
 * Load activity rows for the admin Student Activity dashboard.
 */
export async function fetchActivityFeed({
  filterId,
  page,
  limit,
  level,
  courseCode,
  studentQ,
  from,
  to,
}) {
  const tab = filterId || "all";

  if (tab === "quizzes") {
    const params = buildActivityParams({
      page,
      limit,
      level,
      courseCode,
      studentQ,
      from,
      to,
    });
    const quizData = await adminFetch(
      `/api/admin/activity/quizzes?${params.toString()}`
    );
    const attempts = Array.isArray(quizData.attempts)
      ? quizData.attempts.map(mapQuizAttempt)
      : [];

    if (attempts.length) {
      return {
        items: attempts,
        total: quizData.total ?? attempts.length,
        totalPages: quizData.totalPages ?? 1,
        featureStatus: quizData.featureStatus || "",
      };
    }

    const aiQuizParams = buildActivityParams({
      page,
      limit,
      level,
      courseCode,
      studentQ,
      from,
      to,
      type: "ai_quiz",
    });
    const aiRows = await adminFetch(
      `/api/admin/activity/recent?${aiQuizParams.toString()}`
    );
    const items = Array.isArray(aiRows.activity)
      ? aiRows.activity.map(mapEventRow)
      : [];
    return {
      items,
      total: aiRows.total ?? items.length,
      totalPages: aiRows.totalPages ?? 1,
      featureStatus:
        quizData.featureStatus ||
        "Showing AI-generated practice quizzes until graded quiz attempts are recorded.",
    };
  }

  const tabMeta = {
    all: { category: "" },
    logins: { category: "login" },
    ai: { category: "ai" },
    materials: { category: "material" },
    uploads: { category: "upload" },
  };

  const category = tabMeta[tab]?.category ?? "";

  const params = buildActivityParams({
    page,
    limit,
    category,
    level,
    courseCode,
    studentQ,
    from,
    to,
  });

  const data = await adminFetch(
    `/api/admin/activity/recent?${params.toString()}`
  );
  const items = Array.isArray(data.activity)
    ? data.activity.map(mapEventRow)
    : [];

  return {
    items,
    total: data.total ?? items.length,
    totalPages: data.totalPages ?? 1,
    featureStatus: "",
  };
}

export function canLoadMore({ total, loadedCount }) {
  return loadedCount < total;
}

export async function fetchActivityOverview() {
  const data = await adminFetch("/api/admin/activity/overview");
  return data.overview || null;
}

export async function fetchActiveStudentsToday() {
  const data = await adminFetch("/api/admin/students?activeToday=1");
  return Array.isArray(data.students) ? data.students : [];
}
