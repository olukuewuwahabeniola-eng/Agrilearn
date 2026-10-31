const Student = require("../models/Student");
const StudentActivity = require("../models/StudentActivity");

const VIEW_DEDUPE_MS = 10 * 60 * 1000;

function truncate(text, max = 120) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`;
}

function sanitizeMetadata(meta) {
  if (!meta || typeof meta !== "object") return {};
  const copy = { ...meta };
  delete copy.password;
  delete copy.token;
  delete copy.jwt;
  delete copy.reply;
  delete copy.messages;
  return copy;
}

/**
 * Record a student activity event (non-blocking for callers).
 */
async function logStudentActivity({
  student,
  category,
  type,
  title,
  courseCode = "",
  courseTitle = "",
  relatedId = null,
  relatedModel = "",
  metadata = {},
}) {
  if (!student?._id) return null;

  try {
    const doc = await StudentActivity.create({
      student: student._id,
      level: student.level,
      category,
      type,
      title: truncate(title, 240) || type,
      courseCode: courseCode ? String(courseCode).trim().toUpperCase() : "",
      courseTitle: courseTitle ? String(courseTitle).trim() : "",
      relatedId,
      relatedModel,
      metadata: sanitizeMetadata(metadata),
    });
    return doc;
  } catch (error) {
    console.error("Activity log warning:", error.message);
    return null;
  }
}

async function touchStudentLastActive(studentId) {
  if (!studentId) return;
  try {
    await Student.findByIdAndUpdate(studentId, {
      lastActiveAt: new Date(),
    });
  } catch {
    /* ignore */
  }
}

/**
 * Debounced material view — one log per note per 10 minutes per student.
 */
async function logMaterialDownloadIfNeeded(student, note) {
  if (!student?._id || !note?._id) return;
  const since = new Date(Date.now() - VIEW_DEDUPE_MS);
  const recent = await StudentActivity.findOne({
    student: student._id,
    type: "material_download",
    relatedId: note._id,
    createdAt: { $gte: since },
  }).select("_id");

  if (recent) return;

  await logStudentActivity({
    student,
    category: "material",
    type: "material_download",
    title: `Downloaded lecture notes ${note.title || note.originalName || ""}`.trim(),
    courseCode: note.courseCode,
    courseTitle: note.courseTitle,
    relatedId: note._id,
    relatedModel: "NoteResource",
    metadata: {
      source: note.source || "unknown",
      fileName: note.originalName,
      topicTitle: note.title,
      delivery: "inline_stream",
    },
  });
  await touchStudentLastActive(student._id);
}

async function logMaterialViewIfNeeded(student, note) {
  if (!student?._id || !note?._id) return;
  const since = new Date(Date.now() - VIEW_DEDUPE_MS);
  const recent = await StudentActivity.findOne({
    student: student._id,
    type: "material_view",
    relatedId: note._id,
    createdAt: { $gte: since },
  }).select("_id");

  if (recent) return;

  await logStudentActivity({
    student,
    category: "material",
    type: "material_view",
    title: `Viewed lecture notes ${note.title || note.originalName || ""}`.trim(),
    courseCode: note.courseCode,
    courseTitle: note.courseTitle,
    relatedId: note._id,
    relatedModel: "NoteResource",
    metadata: {
      source: note.source || "unknown",
      fileName: note.originalName,
      topicTitle: note.title,
    },
  });
  await touchStudentLastActive(student._id);
}

async function recordStudentLogin(student) {
  if (!student?._id) return;
  const now = new Date();
  try {
    await Student.findByIdAndUpdate(student._id, {
      $inc: { loginCount: 1 },
      lastLoginAt: now,
      lastActiveAt: now,
    });
    await logStudentActivity({
      student,
      category: "login",
      type: "login",
      title: "Student logged in",
      metadata: { loginCountIncrement: 1 },
    });
  } catch (error) {
    console.error("Login activity warning:", error.message);
  }
}

async function recordStudentRegistration(student) {
  if (!student?._id) return;
  const now = new Date();
  try {
    await Student.findByIdAndUpdate(student._id, {
      loginCount: 0,
      lastLoginAt: null,
      lastActiveAt: now,
    });
    await logStudentActivity({
      student,
      category: "platform",
      type: "registration",
      title: "Student account registered",
    });
  } catch (error) {
    console.error("Registration activity warning:", error.message);
  }
}

async function logCourseAccessIfNeeded(student, course) {
  if (!student?._id || !course?.code) return;
  const since = new Date(Date.now() - VIEW_DEDUPE_MS);
  const recent = await StudentActivity.findOne({
    student: student._id,
    type: "course_access",
    courseCode: String(course.code).trim().toUpperCase(),
    createdAt: { $gte: since },
  }).select("_id");

  if (recent) return;

  await logStudentActivity({
    student,
    category: "platform",
    type: "course_access",
    title: `Opened course ${course.code}`,
    courseCode: course.code,
    courseTitle: course.title || "",
  });
  // title kept short; student UI formats with formatStudentActivity()
  await touchStudentLastActive(student._id);
}

async function recordPersonalUpload(student, note, { via = "notes" } = {}) {
  if (!student?._id || !note?._id) return;
  await logStudentActivity({
    student,
    category: "upload",
    type: "personal_upload",
    title: `Uploaded ${note.title || note.originalName || "PDF"}`,
    courseCode: note.courseCode,
    courseTitle: note.courseTitle,
    relatedId: note._id,
    relatedModel: "NoteResource",
    metadata: {
      fileName: note.originalName,
      size: note.size,
      source: "personal",
      via,
      status: note.approvalStatus || "approved",
    },
  });
  await touchStudentLastActive(student._id);
}

const AI_ACTION_TYPES = {
  ask: "ai_question",
  summarise: "ai_summarise",
  quiz: "ai_quiz",
};

async function logAiInteraction({
  student,
  action,
  question,
  course,
  conversationId,
  isNewConversation,
}) {
  if (!student?._id) return;
  const type = AI_ACTION_TYPES[action] || "ai_question";
  const topicHint = truncate(question, 120);

  await logStudentActivity({
    student,
    category: "ai",
    type,
    title: topicHint || `AI ${action}`,
    courseCode: course?.code || "",
    courseTitle: course?.title || "",
    relatedId: conversationId || null,
    relatedModel: conversationId ? "AiConversation" : "",
    metadata: {
      action,
      topicHint,
      newConversation: Boolean(isNewConversation),
    },
  });
  await touchStudentLastActive(student._id);
}

async function logPastQuestionAccessIfNeeded(
  student,
  pastQuestion,
  { download = false } = {}
) {
  if (!student?._id || !pastQuestion?._id) return;
  const type = download ? "material_download" : "material_view";
  const since = new Date(Date.now() - VIEW_DEDUPE_MS);
  const recent = await StudentActivity.findOne({
    student: student._id,
    type,
    relatedId: pastQuestion._id,
    relatedModel: "PastQuestion",
    createdAt: { $gte: since },
  }).select("_id");

  if (recent) return;

  const label = `${pastQuestion.courseCode || "Course"} ${
    pastQuestion.examYear || ""
  }`.trim();

  await logStudentActivity({
    student,
    category: "material",
    type,
    title: download
      ? `Downloaded past questions ${label}`
      : `Viewed past questions ${label}`,
    courseCode: pastQuestion.courseCode,
    courseTitle: pastQuestion.courseTitle || "",
    relatedId: pastQuestion._id,
    relatedModel: "PastQuestion",
    metadata: {
      examYear: pastQuestion.examYear,
      format: pastQuestion.format,
      delivery: download ? "download" : "view",
    },
  });
  await touchStudentLastActive(student._id);
}

async function logQuizCompleted(student, attempt) {
  if (!student?._id || !attempt?._id) return;
  await logStudentActivity({
    student,
    category: "quiz",
    type: "quiz_completed",
    title: `Completed quiz ${attempt.quizTitle || ""}`.trim(),
    courseCode: attempt.courseCode,
    courseTitle: attempt.courseTitle || "",
    relatedId: attempt._id,
    relatedModel: "QuizAttempt",
    metadata: {
      quizTitle: attempt.quizTitle,
      score: attempt.score,
      maxScore: attempt.maxScore,
      attemptNumber: attempt.attemptNumber,
    },
  });
  await touchStudentLastActive(student._id);
}

async function logLearningCompleted(student, completion) {
  if (!student?._id || !completion?._id) return;
  await logStudentActivity({
    student,
    category: "platform",
    type: "learning_completed",
    title: `Marked ${completion.topicTitle || "topic"} as completed`,
    courseCode: completion.courseCode,
    courseTitle: completion.courseTitle || "",
    relatedId: completion.note,
    relatedModel: "NoteResource",
    metadata: {
      topicTitle: completion.topicTitle,
      completionId: completion._id.toString(),
    },
  });
  await touchStudentLastActive(student._id);
}

function startOfTodayUtc() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

module.exports = {
  logStudentActivity,
  logMaterialViewIfNeeded,
  logMaterialDownloadIfNeeded,
  logCourseAccessIfNeeded,
  logPastQuestionAccessIfNeeded,
  logQuizCompleted,
  logLearningCompleted,
  recordPersonalUpload,
  logAiInteraction,
  touchStudentLastActive,
  recordStudentLogin,
  recordStudentRegistration,
  startOfTodayUtc,
  truncate,
};
