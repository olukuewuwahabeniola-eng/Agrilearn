const Student = require("../models/Student");
const StudentActivity = require("../models/StudentActivity");
const NoteResource = require("../models/NoteResource");
const AiConversation = require("../models/AiConversation");
const QuizAttempt = require("../models/QuizAttempt");
const AssignmentSubmission = require("../models/AssignmentSubmission");
const { startOfTodayUtc } = require("../utils/activityTracker");
const {
  parseActivityQueryAsync,
  applyStudentQueryFilter,
  paginationMeta,
} = require("../utils/activityQuery");
const {
  applyAdminLevelFilter,
  sendAdminAccessError,
} = require("../utils/adminAccess");

function handleActivityAccessError(res, error) {
  if (
    error.code === "ADMIN_LEVEL_FORBIDDEN" ||
    error.code === "ADMIN_LEVEL_INVALID"
  ) {
    return sendAdminAccessError(res, error);
  }
  return null;
}

/**
 * GET /api/admin/activity/overview
 */
async function activityOverview(req, res) {
  try {
    const startToday = startOfTodayUtc();
    const levelFilter = {};
    applyAdminLevelFilter(req.admin, levelFilter, req.query.level);
    const scopedLevel = levelFilter.level || null;

    const studentMatch = { ...levelFilter };
    const activityMatch = { ...levelFilter };
    const noteMatch = { source: "personal", ...levelFilter };

    const [
      totalStudents,
      activeToday,
      aiQuestionsToday,
      personalUploadsTotal,
      conversationsTotal,
      activitiesToday,
    ] = await Promise.all([
      Student.countDocuments(studentMatch),
      Student.countDocuments({
        ...studentMatch,
        lastActiveAt: { $gte: startToday },
      }),
      StudentActivity.countDocuments({
        ...activityMatch,
        category: "ai",
        createdAt: { $gte: startToday },
      }),
      NoteResource.countDocuments(noteMatch),
      scopedLevel
        ? Student.find(studentMatch)
            .select("_id")
            .then((ids) =>
              AiConversation.countDocuments({
                student: { $in: ids.map((s) => s._id) },
              })
            )
        : AiConversation.countDocuments(),
      StudentActivity.countDocuments({
        ...activityMatch,
        createdAt: { $gte: startToday },
      }),
    ]);

    return res.status(200).json({
      success: true,
      scopedLevel,
      overview: {
        totalRegisteredStudents: totalStudents,
        studentsActiveToday: activeToday,
        aiAssistantQuestionsToday: aiQuestionsToday,
        studentPersonalUploadsTotal: personalUploadsTotal,
        aiConversationsTotal: conversationsTotal,
        activityEventsToday: activitiesToday,
        computedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (handleActivityAccessError(res, error)) return;
    console.error("Activity overview error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load activity overview.",
    });
  }
}

/**
 * GET /api/admin/activity/recent (also GET /api/admin/activity)
 */
async function listRecentActivity(req, res) {
  try {
    const { page, limit, skip, sort, filter } = await parseActivityQueryAsync(req);

    const [total, rows] = await Promise.all([
      StudentActivity.countDocuments(filter),
      StudentActivity.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("student", "fullName email matricNumber level"),
    ]);

    const activity = rows.map((row) => ({
      ...row.toAdminObject(),
      student: row.student
        ? {
            id: row.student._id.toString(),
            fullName: row.student.fullName,
            email: row.student.email,
            matricNumber: row.student.matricNumber,
            level: row.student.level,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      scopedLevel: filter.level || null,
      ...paginationMeta(page, limit, total),
      activity,
    });
  } catch (error) {
    if (handleActivityAccessError(res, error)) return;
    console.error("Recent activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load recent activity.",
    });
  }
}

/**
 * GET /api/admin/activity/logins
 */
async function listLoginActivity(req, res) {
  try {
    const { page, limit, skip, sort, filter } = await parseActivityQueryAsync(req);
    filter.category = "login";

    const studentSummaryFilter = {};
    applyAdminLevelFilter(req.admin, studentSummaryFilter, req.query.level);

    const [total, rows, studentSummaries] = await Promise.all([
      StudentActivity.countDocuments(filter),
      StudentActivity.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("student", "fullName email matricNumber level loginCount lastLoginAt lastActiveAt"),
      Student.find(studentSummaryFilter)
        .select("fullName email level loginCount lastLoginAt lastActiveAt createdAt")
        .sort({ lastLoginAt: -1 })
        .limit(50),
    ]);

    const logins = rows.map((row) => ({
      ...row.toAdminObject(),
      student: row.student
        ? {
            id: row.student._id.toString(),
            fullName: row.student.fullName,
            email: row.student.email,
            level: row.student.level,
            loginCount: row.student.loginCount ?? 0,
            lastLoginAt: row.student.lastLoginAt,
            lastActiveAt: row.student.lastActiveAt,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      scopedLevel: filter.level || null,
      ...paginationMeta(page, limit, total),
      logins,
      studentLoginSummary: studentSummaries.map((s) => ({
        id: s._id.toString(),
        fullName: s.fullName,
        email: s.email,
        level: s.level,
        loginCount: s.loginCount ?? 0,
        lastLoginAt: s.lastLoginAt,
        lastActiveAt: s.lastActiveAt,
        registeredAt: s.createdAt,
      })),
    });
  } catch (error) {
    if (handleActivityAccessError(res, error)) return;
    console.error("Login activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load login activity.",
    });
  }
}

/**
 * GET /api/admin/activity/materials
 */
async function listMaterialActivity(req, res) {
  try {
    const { page, limit, skip, sort, filter } = await parseActivityQueryAsync(req);
    filter.category = "material";

    const [total, rows] = await Promise.all([
      StudentActivity.countDocuments(filter),
      StudentActivity.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("student", "fullName email level"),
    ]);

    const materials = rows.map((row) => ({
      ...row.toAdminObject(),
      student: row.student
        ? {
            id: row.student._id.toString(),
            fullName: row.student.fullName,
            email: row.student.email,
            level: row.student.level,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      ...paginationMeta(page, limit, total),
      materials,
    });
  } catch (error) {
    if (handleActivityAccessError(res, error)) return;
    console.error("Material activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load material activity.",
    });
  }
}

/**
 * GET /api/admin/activity/ai
 * Metadata only — no full private conversation transcripts.
 */
async function listAiActivity(req, res) {
  try {
    const { page, limit, skip, filter: baseFilter } =
      await parseActivityQueryAsync(req);
    const q = String(req.query.q || "").trim();

    const activityFilter = { ...baseFilter, category: "ai" };
    const [eventTotal, events] = await Promise.all([
      StudentActivity.countDocuments(activityFilter),
      StudentActivity.find(activityFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("student", "fullName email level"),
    ]);

    const convFilter = {};
    if (baseFilter.student) convFilter.student = baseFilter.student;
    if (baseFilter.level) convFilter.level = baseFilter.level;
    if (baseFilter.courseCode) convFilter.courseCode = baseFilter.courseCode;
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      convFilter.$or = [
        { title: regex },
        { courseCode: regex },
        { courseTitle: regex },
      ];
    }

    const conversations = await AiConversation.find(convFilter)
      .sort({ updatedAt: -1 })
      .limit(50)
      .populate("student", "fullName email level");

    const questionCounts = await StudentActivity.aggregate([
      { $match: { category: "ai" } },
      {
        $group: {
          _id: "$student",
          questionsAsked: { $sum: 1 },
          lastAiAt: { $max: "$createdAt" },
        },
      },
      { $sort: { questionsAsked: -1 } },
      { $limit: 25 },
    ]);

    return res.status(200).json({
      success: true,
      ...paginationMeta(page, limit, eventTotal),
      aiEvents: events.map((row) => ({
        ...row.toAdminObject(),
        student: row.student
          ? {
              id: row.student._id.toString(),
              fullName: row.student.fullName,
              email: row.student.email,
              level: row.student.level,
            }
          : null,
      })),
      conversations: conversations.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        level: c.level,
        courseCode: c.courseCode || "",
        courseTitle: c.courseTitle || "",
        messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
        userMessageCount: Array.isArray(c.messages)
          ? c.messages.filter((m) => m.role === "user").length
          : 0,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
        student: c.student
          ? {
              id: c.student._id.toString(),
              fullName: c.student.fullName,
              email: c.student.email,
              level: c.student.level,
            }
          : null,
      })),
      topStudentsByAiUsage: questionCounts.map((row) => ({
        studentId: row._id?.toString(),
        questionsAsked: row.questionsAsked,
        lastAiAt: row.lastAiAt,
      })),
      privacyNote:
        "Full chat transcripts are not exposed. Use conversation metadata and AI event logs only.",
    });
  } catch (error) {
    if (handleActivityAccessError(res, error)) return;
    console.error("AI activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load AI activity.",
    });
  }
}

/**
 * GET /api/admin/activity/quizzes
 */
async function listQuizActivity(req, res) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "25"), 10) || 25)
    );
    const skip = (page - 1) * limit;

    const filter = {};
    const level = String(req.query.level || "").trim();
    const courseCode = String(req.query.courseCode || "").trim().toUpperCase();
    const studentId = String(req.query.studentId || "").trim();
    applyAdminLevelFilter(req.admin, filter, level);
    if (courseCode) filter.courseCode = courseCode;
    if (studentId) filter.student = studentId;
    await applyStudentQueryFilter(filter, req);

    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    if (from || to) {
      filter.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) filter.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) filter.createdAt.$lte = toDate;
      }
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

    const [total, attempts] = await Promise.all([
      QuizAttempt.countDocuments(filter),
      QuizAttempt.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("student", "fullName email level"),
    ]);

    const byCourse = await QuizAttempt.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { courseCode: "$courseCode", level: "$level" },
          attempts: { $sum: 1 },
          avgScore: { $avg: "$score" },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
        },
      },
      { $sort: { attempts: -1 } },
      { $limit: 50 },
    ]);

    return res.status(200).json({
      success: true,
      ...paginationMeta(page, limit, total),
      connected: total > 0,
      featureStatus:
        total > 0
          ? "Quiz attempts are being recorded."
          : "Quiz UI not connected yet — QuizAttempt model is ready for integration.",
      attempts: attempts.map((a) => ({
        ...a.toAdminObject(),
        student: a.student
          ? {
              id: a.student._id.toString(),
              fullName: a.student.fullName,
              email: a.student.email,
              level: a.student.level,
            }
          : null,
      })),
      performanceByCourse: byCourse.map((row) => ({
        courseCode: row._id.courseCode,
        level: row._id.level,
        attempts: row.attempts,
        averageScore: row.avgScore,
        completed: row.completed,
        pending: row.pending,
      })),
    });
  } catch (error) {
    if (handleActivityAccessError(res, error)) return;
    console.error("Quiz activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load quiz activity.",
    });
  }
}

/**
 * GET /api/admin/activity/uploads
 * Personal student uploads only (never official admin materials).
 */
async function listUploadActivity(req, res) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "25"), 10) || 25)
    );
    const skip = (page - 1) * limit;

    const filter = { source: "personal" };
    const level = String(req.query.level || "").trim();
    const courseCode = String(req.query.courseCode || "").trim().toUpperCase();
    const studentId = String(req.query.studentId || "").trim();
    const q = String(req.query.q || "").trim();

    applyAdminLevelFilter(req.admin, filter, level);
    if (courseCode) filter.courseCode = courseCode;
    if (studentId) filter.studentOwner = studentId;

    const ownerFilter = {};
    await applyStudentQueryFilter(ownerFilter, req);
    if (ownerFilter.student) {
      filter.studentOwner = ownerFilter.student;
    }

    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    if (from || to) {
      filter.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) filter.createdAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) filter.createdAt.$lte = toDate;
      }
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filter.$or = [
        { title: regex },
        { originalName: regex },
        { description: regex },
        { courseCode: regex },
      ];
    }

    const [total, notes] = await Promise.all([
      NoteResource.countDocuments(filter),
      NoteResource.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const studentIds = notes.map((n) => n.studentOwner).filter(Boolean);
    const students = await Student.find({ _id: { $in: studentIds } }).select(
      "fullName email level"
    );
    const studentMap = new Map(
      students.map((s) => [s._id.toString(), s.toSafeObject()])
    );

    const uploads = notes.map((note) => {
      const pub = note.toPublicObject();
      const ownerId = note.studentOwner?.toString();
      return {
        ...pub,
        uploadStatus: "saved",
        approvalStatus: "not_required",
        student: ownerId ? studentMap.get(ownerId) || null : null,
      };
    });

    const { skip: actSkip, filter: actFilter } = await parseActivityQueryAsync(req);
    actFilter.category = "upload";
    const uploadEvents = await StudentActivity.find(actFilter)
      .sort({ createdAt: -1 })
      .skip(actSkip)
      .limit(limit)
      .populate("student", "fullName email level");

    return res.status(200).json({
      success: true,
      scopedLevel: filter.level || null,
      ...paginationMeta(page, limit, total),
      uploads,
      uploadEvents: uploadEvents.map((row) => ({
        ...row.toAdminObject(),
        student: row.student
          ? {
              id: row.student._id.toString(),
              fullName: row.student.fullName,
              email: row.student.email,
              level: row.student.level,
            }
          : null,
      })),
    });
  } catch (error) {
    if (handleActivityAccessError(res, error)) return;
    console.error("Upload activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load upload activity.",
    });
  }
}

/**
 * GET /api/admin/activity/assignments
 */
async function listAssignmentActivity(req, res) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || "25"), 10) || 25)
    );
    const skip = (page - 1) * limit;

    const filter = {};
    const level = String(req.query.level || "").trim();
    const courseCode = String(req.query.courseCode || "").trim().toUpperCase();
    const studentId = String(req.query.studentId || "").trim();
    const status = String(req.query.status || "").trim();

    applyAdminLevelFilter(req.admin, filter, level);
    if (courseCode) filter.courseCode = courseCode;
    if (studentId) filter.student = studentId;
    if (status) filter.status = status;

    const [total, submissions] = await Promise.all([
      AssignmentSubmission.countDocuments(filter),
      AssignmentSubmission.find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("student", "fullName email level")
        .populate("assignment", "title dueDate"),
    ]);

    const pendingCount = await AssignmentSubmission.countDocuments({
      ...filter,
      status: "pending",
    });
    const reviewedCount = await AssignmentSubmission.countDocuments({
      ...filter,
      status: "reviewed",
    });

    return res.status(200).json({
      success: true,
      ...paginationMeta(page, limit, total),
      connected: total > 0,
      featureStatus:
        total > 0
          ? "Assignment submissions are being recorded."
          : "Assignment submission UI not connected yet — models are ready.",
      summary: {
        pending: pendingCount,
        reviewed: reviewedCount,
        total,
      },
      submissions: submissions.map((sub) => ({
        ...sub.toAdminObject(),
        assignmentTitle: sub.assignment?.title || "",
        assignmentDueDate: sub.assignment?.dueDate || null,
        student: sub.student
          ? {
              id: sub.student._id.toString(),
              fullName: sub.student.fullName,
              email: sub.student.email,
              level: sub.student.level,
            }
          : null,
      })),
    });
  } catch (error) {
    if (handleActivityAccessError(res, error)) return;
    console.error("Assignment activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load assignment activity.",
    });
  }
}

/**
 * GET /api/admin/activity/platform
 */
async function listPlatformActivity(req, res) {
  try {
    const { page, limit, skip, sort, filter } = await parseActivityQueryAsync(req);
    filter.category = "platform";

    const [total, rows] = await Promise.all([
      StudentActivity.countDocuments(filter),
      StudentActivity.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("student", "fullName email level"),
    ]);

    return res.status(200).json({
      success: true,
      ...paginationMeta(page, limit, total),
      platform: rows.map((row) => ({
        ...row.toAdminObject(),
        student: row.student
          ? {
              id: row.student._id.toString(),
              fullName: row.student.fullName,
              email: row.student.email,
              level: row.student.level,
            }
          : null,
      })),
    });
  } catch (error) {
    if (handleActivityAccessError(res, error)) return;
    console.error("Platform activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load platform activity.",
    });
  }
}

module.exports = {
  activityOverview,
  listRecentActivity,
  listLoginActivity,
  listMaterialActivity,
  listAiActivity,
  listQuizActivity,
  listUploadActivity,
  listAssignmentActivity,
  listPlatformActivity,
};
