const mongoose = require("mongoose");
const NoteResource = require("../models/NoteResource");
const PastQuestion = require("../models/PastQuestion");
const QuizAttempt = require("../models/QuizAttempt");
const StudentActivity = require("../models/StudentActivity");
const TopicCompletion = require("../models/TopicCompletion");
const { findCourseForStudent } = require("../data/coursesByLevel");
const {
  buildLibraryFilter,
  resolveNoteSource,
  studentCanAccessNote,
} = require("../utils/noteAccess");
const {
  logCourseAccessIfNeeded,
  logLearningCompleted,
  logQuizCompleted,
} = require("../utils/activityTracker");
const {
  formatRelativeTime,
  formatStudentActivity,
} = require("../utils/studentActivityCopy");

function percent(completed, total) {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.round((completed / total) * 100));
}

/** Same official-library rules as Notes & Resources (includes legacy admin notes). */
function officialNotesFilter(student, courseCode = "") {
  const filter = buildLibraryFilter(student, "official");
  if (courseCode) {
    filter.courseCode = String(courseCode).trim().toUpperCase();
  }
  return filter;
}

async function getOfficialNotesForStudent(student, courseCode = "") {
  return NoteResource.find(officialNotesFilter(student, courseCode)).sort({
    createdAt: -1,
  });
}

async function countQuizzesByCourse(student, courseCode = "") {
  const match = {
    student: student._id,
    status: "completed",
  };
  if (courseCode) {
    match.courseCode = String(courseCode).trim().toUpperCase();
  }

  const rows = await QuizAttempt.aggregate([
    { $match: match },
    { $group: { _id: "$courseCode", count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [String(row._id || "").toUpperCase(), row.count]));
}

async function buildProgressSnapshot(student, courseCode = "") {
  const notes = await getOfficialNotesForStudent(student, courseCode);
  const noteIds = notes.map((n) => n._id);
  const [completions, quizByCourse] = await Promise.all([
    noteIds.length
      ? TopicCompletion.find({
          student: student._id,
          note: { $in: noteIds },
        })
      : Promise.resolve([]),
    countQuizzesByCourse(student, courseCode),
  ]);
  const completedSet = new Set(completions.map((c) => String(c.note)));
  const totalTopics = notes.length;
  const completedTopics = notes.filter((n) =>
    completedSet.has(String(n._id))
  ).length;

  const byCourseMap = new Map();
  for (const note of notes) {
    const code = String(note.courseCode || "").toUpperCase();
    if (!byCourseMap.has(code)) {
      byCourseMap.set(code, {
        courseCode: code,
        courseTitle: note.courseTitle || "",
        totalTopics: 0,
        completedTopics: 0,
        topics: [],
      });
    }
    const row = byCourseMap.get(code);
    const done = completedSet.has(String(note._id));
    row.totalTopics += 1;
    if (done) row.completedTopics += 1;
    row.topics.push({
      id: note._id.toString(),
      title: note.title,
      courseCode: note.courseCode,
      courseTitle: note.courseTitle,
      completed: done,
      createdAt: note.createdAt,
    });
  }

  for (const [code] of quizByCourse) {
    if (!code || byCourseMap.has(code)) continue;
    const catalog = findCourseForStudent(student.level, code);
    byCourseMap.set(code, {
      courseCode: code,
      courseTitle: catalog?.title || "",
      totalTopics: 0,
      completedTopics: 0,
      topics: [],
    });
  }

  const courses = [...byCourseMap.values()].map((row) => ({
    ...row,
    quizzesCompleted: quizByCourse.get(row.courseCode) || 0,
    progressPercent: percent(row.completedTopics, row.totalTopics),
  }));

  const quizzesCompleted = [...quizByCourse.values()].reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    totalTopics,
    completedTopics,
    quizzesCompleted,
    progressPercent: percent(completedTopics, totalTopics),
    hasTopics: totalTopics > 0,
    courses,
    topics: notes.map((note) => ({
      id: note._id.toString(),
      title: note.title,
      courseCode: note.courseCode,
      courseTitle: note.courseTitle,
      completed: completedSet.has(String(note._id)),
      createdAt: note.createdAt,
    })),
  };
}

function toRecentUploadFromNote(note) {
  return {
    id: note._id.toString(),
    kind: "note",
    title: note.title,
    courseCode: note.courseCode,
    courseTitle: note.courseTitle || "",
    fileType: "PDF",
    mimeType: note.mimeType || "application/pdf",
    createdAt: note.createdAt,
    viewPath: "notes",
  };
}

function toRecentUploadFromPastQuestion(pq) {
  return {
    id: pq._id.toString(),
    kind: "past_question",
    title:
      pq.description?.trim() ||
      `${pq.courseCode} past questions (${pq.examYear})`,
    courseCode: pq.courseCode,
    courseTitle: pq.courseTitle || "",
    fileType: pq.format === "images" ? "Image" : "PDF",
    mimeType: pq.format === "images" ? "image/*" : "application/pdf",
    examYear: pq.examYear,
    createdAt: pq.createdAt,
    viewPath: "past-questions",
  };
}

/**
 * GET /api/dashboard/overview
 */
async function getOverview(req, res) {
  try {
    const student = req.student;

    const [
      notesAvailable,
      quizzesCompleted,
      progress,
      officialNotes,
      pastQuestions,
      activities,
    ] = await Promise.all([
      NoteResource.countDocuments(officialNotesFilter(student)),
      QuizAttempt.countDocuments({
        student: student._id,
        status: "completed",
      }),
      buildProgressSnapshot(student),
      NoteResource.find(officialNotesFilter(student))
        .sort({ createdAt: -1 })
        .limit(12),
      PastQuestion.find({
        published: true,
        level: student.level,
      })
        .sort({ createdAt: -1 })
        .limit(12),
      StudentActivity.find({ student: student._id })
        .sort({ createdAt: -1 })
        .limit(12),
    ]);

    const recentUploads = [
      ...officialNotes.map(toRecentUploadFromNote),
      ...pastQuestions.map(toRecentUploadFromPastQuestion),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    const recentActivity = activities.map((item) => ({
      id: item._id.toString(),
      type: item.type,
      category: item.category,
      courseCode: item.courseCode || "",
      description: formatStudentActivity(item),
      createdAt: item.createdAt,
      relativeTime: formatRelativeTime(item.createdAt),
    }));

    return res.status(200).json({
      success: true,
      stats: {
        notesAvailable,
        quizzesCompleted,
        learningProgress: progress.progressPercent,
        learningProgressLabel:
          progress.hasTopics
            ? `${progress.completedTopics} of ${progress.totalTopics} topics`
            : "No topics available yet",
        hasTopics: progress.hasTopics,
        completedTopics: progress.completedTopics,
        totalTopics: progress.totalTopics,
      },
      recentUploads,
      recentActivity,
      progress,
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load dashboard statistics.",
    });
  }
}

/**
 * GET /api/dashboard/progress
 */
async function getProgress(req, res) {
  try {
    const courseCode = String(req.query.courseCode || "")
      .trim()
      .toUpperCase();
    if (courseCode) {
      const course = findCourseForStudent(req.student.level, courseCode);
      if (!course) {
        return res.status(403).json({
          success: false,
          message:
            "That course is not available for your academic level.",
        });
      }
    }

    const [progress, quizzesCompleted] = await Promise.all([
      buildProgressSnapshot(req.student, courseCode || ""),
      QuizAttempt.countDocuments({
        student: req.student._id,
        status: "completed",
        ...(courseCode ? { courseCode } : {}),
      }),
    ]);

    const notesAvailable = await NoteResource.countDocuments(
      officialNotesFilter(req.student, courseCode || "")
    );

    return res.status(200).json({
      success: true,
      notesAvailable,
      quizzesCompleted,
      progress,
    });
  } catch (error) {
    console.error("Dashboard progress error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load learning progress.",
    });
  }
}

/**
 * GET /api/dashboard/activity
 */
async function getActivity(req, res) {
  try {
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20)
    );
    const items = await StudentActivity.find({ student: req.student._id })
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: items.length,
      activity: items.map((item) => ({
        id: item._id.toString(),
        type: item.type,
        category: item.category,
        courseCode: item.courseCode || "",
        description: formatStudentActivity(item),
        createdAt: item.createdAt,
        relativeTime: formatRelativeTime(item.createdAt),
      })),
    });
  } catch (error) {
    console.error("Dashboard activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load activity.",
    });
  }
}

/**
 * POST /api/dashboard/course-access
 * Body: { courseCode }
 */
async function recordCourseAccess(req, res) {
  try {
    const courseCode = String(req.body?.courseCode || "").trim();
    const course = findCourseForStudent(req.student.level, courseCode);
    if (!course) {
      return res.status(403).json({
        success: false,
        message:
          "That course is not available for your academic level.",
      });
    }

    await logCourseAccessIfNeeded(req.student, course);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Course access log error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not record course access.",
    });
  }
}

/**
 * POST /api/dashboard/topics/:noteId/complete
 */
async function completeTopic(req, res) {
  try {
    const noteId = req.params.noteId;
    if (!mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid topic id.",
      });
    }

    const note = await NoteResource.findById(noteId);
    if (
      !note ||
      !studentCanAccessNote(note, req.student) ||
      resolveNoteSource(note) !== "official"
    ) {
      return res.status(404).json({
        success: false,
        message:
          "That learning material is not available for your level.",
      });
    }

    let completion = await TopicCompletion.findOne({
      student: req.student._id,
      note: note._id,
    });

    let created = false;
    if (!completion) {
      try {
        completion = await TopicCompletion.create({
          student: req.student._id,
          note: note._id,
          level: note.level,
          courseCode: note.courseCode,
          courseTitle: note.courseTitle,
          topicTitle: note.title,
          completedAt: new Date(),
        });
        created = true;
        await logLearningCompleted(req.student, completion);
      } catch (error) {
        if (error?.code === 11000) {
          completion = await TopicCompletion.findOne({
            student: req.student._id,
            note: note._id,
          });
        } else {
          throw error;
        }
      }
    }

    const progress = await buildProgressSnapshot(
      req.student,
      note.courseCode
    );
    const overall = await buildProgressSnapshot(req.student);

    return res.status(created ? 201 : 200).json({
      success: true,
      created,
      message: created
        ? "Topic marked as completed."
        : "Topic was already marked as completed.",
      completion: completion.toPublicObject(),
      courseProgress: progress,
      progress: overall,
    });
  } catch (error) {
    console.error("Complete topic error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not mark topic as completed.",
    });
  }
}

/**
 * POST /api/dashboard/quizzes/complete
 * Body: { courseCode, quizTitle?, score?, maxScore? }
 */
async function completeQuiz(req, res) {
  try {
    const courseCode = String(req.body?.courseCode || "").trim();
    const course = findCourseForStudent(req.student.level, courseCode);
    if (!course) {
      return res.status(403).json({
        success: false,
        message:
          "That course is not available for your academic level. Choose a course from your level.",
      });
    }

    const quizTitle =
      String(req.body?.quizTitle || "").trim() ||
      `Practice quiz — ${course.code}`;

    const scoreRaw = req.body?.score;
    const maxScoreRaw = req.body?.maxScore;
    const score =
      scoreRaw === null || scoreRaw === undefined || scoreRaw === ""
        ? null
        : Number(scoreRaw);
    const maxScore =
      maxScoreRaw === null || maxScoreRaw === undefined || maxScoreRaw === ""
        ? null
        : Number(maxScoreRaw);

    const previousCount = await QuizAttempt.countDocuments({
      student: req.student._id,
      courseCode: course.code,
      quizTitle,
    });

    const attempt = await QuizAttempt.create({
      student: req.student._id,
      level: req.student.level,
      courseCode: course.code,
      courseTitle: course.title,
      quizTitle: quizTitle.slice(0, 160),
      score: Number.isFinite(score) ? score : null,
      maxScore: Number.isFinite(maxScore) ? maxScore : null,
      attemptNumber: previousCount + 1,
      status: "completed",
    });

    await logQuizCompleted(req.student, attempt);

    const quizzesCompleted = await QuizAttempt.countDocuments({
      student: req.student._id,
      status: "completed",
    });

    return res.status(201).json({
      success: true,
      message: "Quiz marked as completed.",
      attempt: attempt.toAdminObject(),
      quizzesCompleted,
    });
  } catch (error) {
    console.error("Complete quiz error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not record quiz completion.",
    });
  }
}

/**
 * GET /api/dashboard/quizzes
 */
async function listQuizAttempts(req, res) {
  try {
    const attempts = await QuizAttempt.find({
      student: req.student._id,
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      count: attempts.length,
      attempts: attempts.map((a) => a.toAdminObject()),
    });
  } catch (error) {
    console.error("List quiz attempts error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load quiz history.",
    });
  }
}

module.exports = {
  getOverview,
  getProgress,
  getActivity,
  recordCourseAccess,
  completeTopic,
  completeQuiz,
  listQuizAttempts,
};
