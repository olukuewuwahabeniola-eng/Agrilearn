const FILTER_TABS = [
  { id: "all", label: "All Activities", category: "" },
  { id: "logins", label: "Logins", category: "login" },
  { id: "ai", label: "AI Assistant", category: "ai" },
  { id: "materials", label: "Materials", category: "material" },
  { id: "quizzes", label: "Quizzes", mode: "quizzes" },
  { id: "uploads", label: "Uploads", category: "upload" },
];

const LEVELS = ["100", "200", "300", "500"];

function buildActivityParams({
  page = 1,
  limit = 10,
  category = "",
  level = "",
  courseCode = "",
  studentQ = "",
  from = "",
  to = "",
  type = "",
} = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  params.set("sortBy", "createdAt");
  params.set("sortDir", "desc");
  if (category) params.set("category", category);
  if (level) params.set("level", level);
  if (courseCode) params.set("courseCode", courseCode);
  if (studentQ.trim()) params.set("studentQ", studentQ.trim());
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (type) params.set("type", type);
  return params;
}

function formatActivityDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function activityIcon(item) {
  const cat = item.category || "";
  const type = item.type || "";
  if (cat === "login" || type === "login") return "🔐";
  if (cat === "ai" || type.startsWith("ai_")) return "✨";
  if (cat === "material") return "📄";
  if (cat === "upload" || type === "personal_upload") return "📤";
  if (cat === "quiz" || type.startsWith("quiz")) return "📝";
  if (type === "registration") return "🎓";
  if (type === "course_access") return "📚";
  return "•";
}

function activityDescription(item) {
  if (item.kind === "quiz") {
    const score =
      item.metadata?.score != null
        ? ` — score ${item.metadata.score}${item.metadata.maxScore != null ? `/${item.metadata.maxScore}` : ""}`
        : "";
    return `${item.title || "Quiz attempt"}${score}`;
  }
  return item.title || item.type || "Activity";
}

function mapEventRow(row) {
  return {
    id: row.id,
    kind: "event",
    category: row.category,
    type: row.type,
    title: row.title,
    level: row.level || row.student?.level,
    courseCode: row.courseCode || "",
    courseTitle: row.courseTitle || "",
    createdAt: row.createdAt,
    metadata: row.metadata || {},
    relatedId: row.relatedId,
    relatedModel: row.relatedModel || "",
    student: row.student || null,
    raw: row,
  };
}

function mapQuizAttempt(attempt) {
  return {
    id: attempt.id,
    kind: "quiz",
    category: "quiz",
    type: "quiz_attempt",
    title: attempt.quizTitle || "Quiz attempt",
    level: attempt.level || attempt.student?.level,
    courseCode: attempt.courseCode || "",
    courseTitle: attempt.courseTitle || "",
    createdAt: attempt.createdAt,
    metadata: {
      score: attempt.score,
      maxScore: attempt.maxScore,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
    },
    relatedId: attempt.id,
    relatedModel: "QuizAttempt",
    student: attempt.student || null,
    raw: attempt,
  };
}

function courseLabel(item) {
  if (item.courseCode && item.courseTitle) {
    return `${item.courseCode} — ${item.courseTitle}`;
  }
  if (item.courseCode) return item.courseCode;
  if (item.metadata?.topicHint) return item.metadata.topicHint;
  return "—";
}

export {
  FILTER_TABS,
  LEVELS,
  buildActivityParams,
  formatActivityDate,
  activityIcon,
  activityDescription,
  mapEventRow,
  mapQuizAttempt,
  courseLabel,
};
