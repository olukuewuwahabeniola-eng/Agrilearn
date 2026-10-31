const mongoose = require("mongoose");
const Student = require("../models/Student");
const Admin = require("../models/Admin");
const NoteResource = require("../models/NoteResource");
const PastQuestion = require("../models/PastQuestion");
const QuizAttempt = require("../models/QuizAttempt");
const TopicCompletion = require("../models/TopicCompletion");
const StudentActivity = require("../models/StudentActivity");
const AiConversation = require("../models/AiConversation");
const AssignmentSubmission = require("../models/AssignmentSubmission");
const AdminAuditLog = require("../models/AdminAuditLog");
const { ALLOWED_LEVELS } = require("../models/Student");
const { resolveNoteSource } = require("../utils/noteAccess");
const { deleteStoredNoteFile } = require("../utils/noteStorage");
const { deletePastQuestionFiles } = require("../utils/pastQuestionStorage");

const CONFIRM_PHRASE = "DELETE";

function requireConfirmPhrase(body) {
  const phrase = String(body?.confirmPhrase || "").trim();
  if (phrase !== CONFIRM_PHRASE) {
    const error = new Error(
      `Type ${CONFIRM_PHRASE} to confirm this permanent deletion.`
    );
    error.code = "CONFIRM_REQUIRED";
    throw error;
  }
}

function asObjectIdList(values) {
  const list = Array.isArray(values) ? values : [];
  const ids = [];
  for (const value of list) {
    const raw = String(value || "").trim();
    if (mongoose.Types.ObjectId.isValid(raw)) {
      ids.push(new mongoose.Types.ObjectId(raw));
    }
  }
  return ids;
}

async function writeAuditLog({
  admin,
  action,
  summary,
  affectedCounts = {},
  metadata = {},
}) {
  try {
    await AdminAuditLog.create({
      admin: admin._id,
      adminEmail: admin.email,
      action,
      summary,
      affectedCounts,
      metadata,
    });
  } catch (error) {
    console.error("Admin audit log warning:", error.message);
  }
}

function noteToResourceRow(note) {
  const source = resolveNoteSource(note);
  return {
    id: note._id.toString(),
    kind: "note",
    resourceType: source === "official" ? "official_note" : "personal_note",
    title: note.title,
    courseCode: note.courseCode,
    courseTitle: note.courseTitle || "",
    level: note.level,
    source,
    mimeType: note.mimeType || "application/pdf",
    fileType: "PDF",
    size: note.size,
    storagePath: note.storagePath,
    studentOwner: note.studentOwner ? String(note.studentOwner) : null,
    createdAt: note.createdAt,
  };
}

function pastQuestionToResourceRow(pq) {
  return {
    id: pq._id.toString(),
    kind: "past_question",
    resourceType: "past_question",
    title:
      pq.description?.trim() ||
      `${pq.courseCode} past questions (${pq.examYear})`,
    courseCode: pq.courseCode,
    courseTitle: pq.courseTitle || "",
    level: pq.level,
    source: "official",
    mimeType: pq.format === "images" ? "image/*" : "application/pdf",
    fileType: pq.format === "images" ? "Image" : "PDF",
    size: (pq.files || []).reduce((sum, f) => sum + (f.size || 0), 0),
    published: pq.published,
    examYear: pq.examYear,
    pageCount: Array.isArray(pq.files) ? pq.files.length : 0,
    createdAt: pq.createdAt,
  };
}

async function countStudentRelated(studentId) {
  const id = studentId;
  const [
    activities,
    quizAttempts,
    topicCompletions,
    personalNotes,
    conversations,
    assignments,
  ] = await Promise.all([
    StudentActivity.countDocuments({ student: id }),
    QuizAttempt.countDocuments({ student: id }),
    TopicCompletion.countDocuments({ student: id }),
    NoteResource.countDocuments({
      $or: [
        { source: "personal", studentOwner: id },
        { source: { $exists: false }, uploadedBy: id },
      ],
    }),
    AiConversation.countDocuments({ student: id }),
    AssignmentSubmission.countDocuments({ student: id }),
  ]);

  return {
    activities,
    quizAttempts,
    topicCompletions,
    personalNotes,
    conversations,
    assignments,
    total:
      activities +
      quizAttempts +
      topicCompletions +
      personalNotes +
      conversations +
      assignments,
  };
}

async function deleteNoteDocuments(notes) {
  const deletedIds = [];
  const failed = [];
  let filesRemoved = 0;
  for (const note of notes) {
    const id = note._id.toString();
    try {
      // Only the path stored on this note document — never a shared/global wipe.
      if (note.storagePath) {
        await deleteStoredNoteFile(note.storagePath);
        filesRemoved += 1;
      }
      await note.deleteOne();
      deletedIds.push(id);
    } catch (error) {
      failed.push({ id, reason: error.message || "Note delete failed." });
    }
  }
  return {
    notesDeleted: deletedIds.length,
    filesRemoved,
    deletedIds,
    failed,
  };
}

async function deletePastQuestionDocuments(docs) {
  const deletedIds = [];
  const failed = [];
  let filesRemoved = 0;
  for (const doc of docs) {
    const id = doc._id.toString();
    try {
      const before = Array.isArray(doc.files) ? doc.files.length : 0;
      // Deletes only storagePath values listed on this past-question document.
      await deletePastQuestionFiles(doc.files || []);
      filesRemoved += before;
      await doc.deleteOne();
      deletedIds.push(id);
    } catch (error) {
      failed.push({
        id,
        reason: error.message || "Past question delete failed.",
      });
    }
  }
  return {
    pastQuestionsDeleted: deletedIds.length,
    filesRemoved,
    deletedIds,
    failed,
  };
}

async function purgeStudentData(student) {
  const id = student._id;
  const personalNotes = await NoteResource.find({
    $or: [
      { source: "personal", studentOwner: id },
      { source: { $exists: false }, uploadedBy: id },
    ],
  });
  const noteResult = await deleteNoteDocuments(personalNotes);

  const [
    activities,
    quizAttempts,
    topicCompletions,
    conversations,
    assignments,
  ] = await Promise.all([
    StudentActivity.deleteMany({ student: id }),
    QuizAttempt.deleteMany({ student: id }),
    TopicCompletion.deleteMany({ student: id }),
    AiConversation.deleteMany({ student: id }),
    AssignmentSubmission.deleteMany({ student: id }),
  ]);

  await student.deleteOne();

  return {
    studentId: id.toString(),
    email: student.email,
    ...noteResult,
    activitiesDeleted: activities.deletedCount || 0,
    quizAttemptsDeleted: quizAttempts.deletedCount || 0,
    topicCompletionsDeleted: topicCompletions.deletedCount || 0,
    conversationsDeleted: conversations.deletedCount || 0,
    assignmentsDeleted: assignments.deletedCount || 0,
  };
}

/**
 * GET /api/admin/data-management/resources
 */
async function listResources(req, res) {
  try {
    const type = String(req.query.type || "all").trim();
    const level = String(req.query.level || "").trim();
    const courseCode = String(req.query.courseCode || "")
      .trim()
      .toUpperCase();
    const q = String(req.query.q || "").trim();

    const noteFilter = {};
    const pqFilter = {};
    if (level && ALLOWED_LEVELS.includes(level)) {
      noteFilter.level = level;
      pqFilter.level = level;
    }
    if (courseCode) {
      noteFilter.courseCode = courseCode;
      pqFilter.courseCode = courseCode;
    }
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      noteFilter.$or = [
        { title: regex },
        { courseCode: regex },
        { originalName: regex },
      ];
      pqFilter.$or = [{ courseCode: regex }, { description: regex }];
    }

    const wantNotes =
      type === "all" ||
      type === "note" ||
      type === "official_note" ||
      type === "personal_note";
    const wantPq = type === "all" || type === "past_question";

    const [notes, pastQuestions] = await Promise.all([
      wantNotes
        ? NoteResource.find(noteFilter).sort({ createdAt: -1 }).limit(500)
        : [],
      wantPq
        ? PastQuestion.find(pqFilter).sort({ createdAt: -1 }).limit(500)
        : [],
    ]);

    let resources = [
      ...notes.map(noteToResourceRow),
      ...pastQuestions.map(pastQuestionToResourceRow),
    ];

    if (type === "official_note") {
      resources = resources.filter((r) => r.resourceType === "official_note");
    } else if (type === "personal_note") {
      resources = resources.filter((r) => r.resourceType === "personal_note");
    }

    resources.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      count: resources.length,
      resources,
    });
  } catch (error) {
    console.error("List data-management resources error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load resources.",
    });
  }
}

/**
 * POST /api/admin/data-management/resources/preview
 * Body: { noteIds: [], pastQuestionIds: [] }
 */
async function previewResourceDeletion(req, res) {
  try {
    const noteIds = asObjectIdList(req.body?.noteIds);
    const pastQuestionIds = asObjectIdList(req.body?.pastQuestionIds);

    const [notes, pastQuestions] = await Promise.all([
      noteIds.length ? NoteResource.find({ _id: { $in: noteIds } }) : [],
      pastQuestionIds.length
        ? PastQuestion.find({ _id: { $in: pastQuestionIds } })
        : [],
    ]);

    const noteFiles = notes.filter((n) => n.storagePath).length;
    const pqFiles = pastQuestions.reduce(
      (sum, pq) => sum + (Array.isArray(pq.files) ? pq.files.length : 0),
      0
    );

    return res.status(200).json({
      success: true,
      summary: {
        notes: notes.length,
        pastQuestions: pastQuestions.length,
        files: noteFiles + pqFiles,
        officialNotes: notes.filter((n) => resolveNoteSource(n) === "official")
          .length,
        personalNotes: notes.filter((n) => resolveNoteSource(n) === "personal")
          .length,
      },
      items: [
        ...notes.map(noteToResourceRow),
        ...pastQuestions.map(pastQuestionToResourceRow),
      ],
    });
  } catch (error) {
    console.error("Preview resource deletion error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not preview resource deletion.",
    });
  }
}

/**
 * POST /api/admin/data-management/resources/export
 */
async function exportResources(req, res) {
  try {
    const noteIds = asObjectIdList(req.body?.noteIds);
    const pastQuestionIds = asObjectIdList(req.body?.pastQuestionIds);

    const [notes, pastQuestions] = await Promise.all([
      noteIds.length ? NoteResource.find({ _id: { $in: noteIds } }) : [],
      pastQuestionIds.length
        ? PastQuestion.find({ _id: { $in: pastQuestionIds } })
        : [],
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.admin.email,
      notes: notes.map((n) => n.toPublicObject()),
      pastQuestions: pastQuestions.map((pq) => pq.toPublicObject()),
    };

    await writeAuditLog({
      admin: req.admin,
      action: "resources_export",
      summary: `Exported ${notes.length} notes and ${pastQuestions.length} past questions.`,
      affectedCounts: {
        notes: notes.length,
        pastQuestions: pastQuestions.length,
      },
    });

    return res.status(200).json({ success: true, export: payload });
  } catch (error) {
    console.error("Export resources error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not export resources.",
    });
  }
}

/**
 * POST /api/admin/data-management/resources/delete
 */
async function deleteResources(req, res) {
  try {
    requireConfirmPhrase(req.body);
    const noteIds = asObjectIdList(req.body?.noteIds);
    const pastQuestionIds = asObjectIdList(req.body?.pastQuestionIds);

    if (!noteIds.length && !pastQuestionIds.length) {
      return res.status(400).json({
        success: false,
        message: "Select at least one resource to delete.",
      });
    }

    const [notes, pastQuestions] = await Promise.all([
      noteIds.length ? NoteResource.find({ _id: { $in: noteIds } }) : [],
      pastQuestionIds.length
        ? PastQuestion.find({ _id: { $in: pastQuestionIds } })
        : [],
    ]);

    const noteResult = await deleteNoteDocuments(notes);
    const pqResult = await deletePastQuestionDocuments(pastQuestions);
    const failed = [...(noteResult.failed || []), ...(pqResult.failed || [])];

    // Progress rows pointing at successfully deleted official notes only
    if (noteResult.deletedIds?.length) {
      await TopicCompletion.deleteMany({
        note: {
          $in: noteResult.deletedIds.map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        },
      });
    }

    const affectedCounts = {
      notesDeleted: noteResult.notesDeleted,
      pastQuestionsDeleted: pqResult.pastQuestionsDeleted,
      filesRemoved: noteResult.filesRemoved + pqResult.filesRemoved,
      failed: failed.length,
      remainingRequested:
        noteIds.length +
        pastQuestionIds.length -
        noteResult.notesDeleted -
        pqResult.pastQuestionsDeleted,
    };

    await writeAuditLog({
      admin: req.admin,
      action: "resources_delete",
      summary: `Deleted ${affectedCounts.notesDeleted} notes and ${affectedCounts.pastQuestionsDeleted} past questions (${failed.length} failed).`,
      affectedCounts,
      metadata: {
        deletedNoteIds: noteResult.deletedIds,
        deletedPastQuestionIds: pqResult.deletedIds,
        failed,
      },
    });

    const partial = failed.length > 0;
    return res.status(partial ? 207 : 200).json({
      success: !partial,
      partial,
      message: partial
        ? "Resource cleanup finished with some failures. See deleted and failed lists."
        : "Selected resources deleted.",
      affectedCounts,
      deleted: {
        noteIds: noteResult.deletedIds,
        pastQuestionIds: pqResult.deletedIds,
      },
      failed,
    });
  } catch (error) {
    if (error.code === "CONFIRM_REQUIRED") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Delete resources error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete selected resources.",
      failed: [],
    });
  }
}

/**
 * GET /api/admin/data-management/students
 */
async function listManagedStudents(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    const level = String(req.query.level || "").trim();
    const testOnly =
      req.query.testOnly === "1" || req.query.testOnly === "true";
    const filter = {};

    if (level && ALLOWED_LEVELS.includes(level)) filter.level = level;
    if (testOnly) filter.isTestAccount = true;
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { matricNumber: regex },
      ];
    }

    const students = await Student.find(filter).sort({ createdAt: -1 }).limit(500);
    const rows = [];
    for (const student of students) {
      const related = await countStudentRelated(student._id);
      rows.push({
        ...student.toSafeObject(),
        id: student._id.toString(),
        isTestAccount: Boolean(student.isTestAccount),
        related,
      });
    }

    // Hard safety: never include admin emails as deletable students
    const adminEmails = new Set(
      (await Admin.find().select("email")).map((a) => a.email)
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      students: rows.map((row) => ({
        ...row,
        isAdminEmail: adminEmails.has(String(row.email || "").toLowerCase()),
      })),
    });
  } catch (error) {
    console.error("List managed students error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load students for data management.",
    });
  }
}

/**
 * PATCH /api/admin/data-management/students/:id/test-flag
 * Body: { isTestAccount: boolean }
 */
async function setStudentTestFlag(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id.",
      });
    }

    const isTestAccount = Boolean(req.body?.isTestAccount);
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    // Never allow marking if this email belongs to an Admin account
    const adminHit = await Admin.findOne({
      email: String(student.email || "").toLowerCase(),
    }).select("_id");
    if (adminHit) {
      return res.status(400).json({
        success: false,
        message:
          "This email belongs to an administrator and cannot be marked as a test student.",
      });
    }

    student.isTestAccount = isTestAccount;
    await student.save();

    await writeAuditLog({
      admin: req.admin,
      action: "student_test_flag",
      summary: `${isTestAccount ? "Marked" : "Unmarked"} test account ${student.email}.`,
      affectedCounts: { students: 1 },
      metadata: {
        studentId: student._id.toString(),
        isTestAccount,
      },
    });

    const related = await countStudentRelated(student._id);
    return res.status(200).json({
      success: true,
      message: isTestAccount
        ? "Student marked as a test account."
        : "Test account mark removed.",
      student: {
        ...student.toSafeObject(),
        id: student._id.toString(),
        isTestAccount: student.isTestAccount,
        related,
      },
    });
  } catch (error) {
    console.error("Set test flag error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not update test account flag.",
    });
  }
}

/**
 * POST /api/admin/data-management/students/preview
 */
async function previewStudentDeletion(req, res) {
  try {
    const studentIds = asObjectIdList(req.body?.studentIds);
    const students = studentIds.length
      ? await Student.find({ _id: { $in: studentIds }, isTestAccount: true })
      : [];

    const items = [];
    let relatedTotal = 0;
    for (const student of students) {
      const related = await countStudentRelated(student._id);
      relatedTotal += related.total;
      items.push({
        id: student._id.toString(),
        fullName: student.fullName,
        email: student.email,
        level: student.level,
        related,
      });
    }

    return res.status(200).json({
      success: true,
      summary: {
        students: items.length,
        relatedRecords: relatedTotal,
        skippedNonTest:
          studentIds.length - items.length > 0
            ? studentIds.length - items.length
            : 0,
      },
      items,
      note:
        "Only accounts explicitly marked as test accounts can be deleted. Administrator accounts are never deleted.",
    });
  } catch (error) {
    console.error("Preview student deletion error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not preview student deletion.",
    });
  }
}

/**
 * POST /api/admin/data-management/students/export
 */
async function exportStudents(req, res) {
  try {
    const studentIds = asObjectIdList(req.body?.studentIds);
    const students = studentIds.length
      ? await Student.find({ _id: { $in: studentIds } })
      : [];

    const exportRows = [];
    for (const student of students) {
      const related = await countStudentRelated(student._id);
      exportRows.push({
        ...student.toSafeObject(),
        related,
      });
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.admin.email,
      students: exportRows,
    };

    await writeAuditLog({
      admin: req.admin,
      action: "students_export",
      summary: `Exported ${exportRows.length} student records.`,
      affectedCounts: { students: exportRows.length },
    });

    return res.status(200).json({ success: true, export: payload });
  } catch (error) {
    console.error("Export students error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not export students.",
    });
  }
}

/**
 * POST /api/admin/data-management/students/delete
 */
async function deleteTestStudents(req, res) {
  try {
    requireConfirmPhrase(req.body);
    const studentIds = asObjectIdList(req.body?.studentIds);
    if (!studentIds.length) {
      return res.status(400).json({
        success: false,
        message: "Select at least one test account to delete.",
      });
    }

    const adminEmails = new Set(
      (await Admin.find().select("email")).map((a) =>
        String(a.email).toLowerCase()
      )
    );

    const students = await Student.find({
      _id: { $in: studentIds },
      isTestAccount: true,
    });

    const deleted = [];
    const skipped = [];
    const failed = [];
    const loggedInAdminEmail = String(req.admin.email || "").toLowerCase();

    for (const student of students) {
      const email = String(student.email || "").toLowerCase();
      if (adminEmails.has(email) || email === loggedInAdminEmail) {
        skipped.push({
          id: student._id.toString(),
          reason:
            "Administrator account/email — never deleted by data management.",
        });
        continue;
      }
      try {
        deleted.push(await purgeStudentData(student));
      } catch (error) {
        failed.push({
          id: student._id.toString(),
          email: student.email,
          reason: error.message || "Student purge failed.",
        });
      }
    }

    for (const id of studentIds) {
      if (
        !students.some((s) => String(s._id) === String(id)) &&
        !skipped.some((s) => s.id === String(id)) &&
        !failed.some((s) => s.id === String(id))
      ) {
        skipped.push({
          id: String(id),
          reason: "Not a marked test account (or already removed).",
        });
      }
    }

    const affectedCounts = {
      studentsDeleted: deleted.length,
      personalNotesDeleted: deleted.reduce(
        (sum, row) => sum + (row.notesDeleted || 0),
        0
      ),
      activitiesDeleted: deleted.reduce(
        (sum, row) => sum + (row.activitiesDeleted || 0),
        0
      ),
      quizAttemptsDeleted: deleted.reduce(
        (sum, row) => sum + (row.quizAttemptsDeleted || 0),
        0
      ),
      topicCompletionsDeleted: deleted.reduce(
        (sum, row) => sum + (row.topicCompletionsDeleted || 0),
        0
      ),
      skipped: skipped.length,
      failed: failed.length,
      remainingFailedIds: failed.map((row) => row.id),
    };

    await writeAuditLog({
      admin: req.admin,
      action: "students_delete",
      summary: `Deleted ${affectedCounts.studentsDeleted} test student account(s); ${failed.length} failed; ${skipped.length} skipped.`,
      affectedCounts,
      metadata: { deleted, skipped, failed },
    });

    const partial = failed.length > 0;
    return res.status(partial ? 207 : 200).json({
      success: !partial,
      partial,
      message: partial
        ? "Test account cleanup finished with some failures. See deleted, skipped, and failed lists."
        : "Selected test accounts removed.",
      affectedCounts,
      deleted,
      skipped,
      failed,
    });
  } catch (error) {
    if (error.code === "CONFIRM_REQUIRED") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Delete test students error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete selected test accounts.",
      deleted: [],
      skipped: [],
      failed: [],
    });
  }
}

/**
 * GET /api/admin/data-management/activity/stats
 */
async function activityStats(req, res) {
  try {
    const testStudents = await Student.find({ isTestAccount: true }).select(
      "_id"
    );
    const testIds = testStudents.map((s) => s._id);

    const [
      allActivities,
      allQuizzes,
      allProgress,
      testActivities,
      testQuizzes,
      testProgress,
      testAccountCount,
    ] = await Promise.all([
      StudentActivity.countDocuments({}),
      QuizAttempt.countDocuments({}),
      TopicCompletion.countDocuments({}),
      testIds.length
        ? StudentActivity.countDocuments({ student: { $in: testIds } })
        : 0,
      testIds.length
        ? QuizAttempt.countDocuments({ student: { $in: testIds } })
        : 0,
      testIds.length
        ? TopicCompletion.countDocuments({ student: { $in: testIds } })
        : 0,
      testIds.length,
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        testAccountCount,
        all: {
          activities: allActivities,
          quizAttempts: allQuizzes,
          topicCompletions: allProgress,
        },
        testAccountsOnly: {
          activities: testActivities,
          quizAttempts: testQuizzes,
          topicCompletions: testProgress,
        },
      },
    });
  } catch (error) {
    console.error("Activity stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load activity cleanup stats.",
    });
  }
}

/**
 * POST /api/admin/data-management/activity/preview
 * Body: { studentIds?: [], clearActivities, clearQuizzes, clearProgress, scope: 'test_selected'|'test_all' }
 */
async function previewActivityClear(req, res) {
  try {
    const scope = String(req.body?.scope || "test_selected").trim();
    const clearActivities = Boolean(req.body?.clearActivities);
    const clearQuizzes = Boolean(req.body?.clearQuizzes);
    const clearProgress = Boolean(req.body?.clearProgress);

    let studentIds = asObjectIdList(req.body?.studentIds);
    if (scope === "test_all") {
      studentIds = (
        await Student.find({ isTestAccount: true }).select("_id")
      ).map((s) => s._id);
    } else {
      const allowed = await Student.find({
        _id: { $in: studentIds },
        isTestAccount: true,
      }).select("_id");
      studentIds = allowed.map((s) => s._id);
    }

    const filter = { student: { $in: studentIds } };
    const summary = {
      students: studentIds.length,
      activities: 0,
      quizAttempts: 0,
      topicCompletions: 0,
    };

    if (studentIds.length) {
      if (clearActivities) {
        summary.activities = await StudentActivity.countDocuments(filter);
      }
      if (clearQuizzes) {
        summary.quizAttempts = await QuizAttempt.countDocuments(filter);
      }
      if (clearProgress) {
        summary.topicCompletions = await TopicCompletion.countDocuments(filter);
      }
    }

    return res.status(200).json({
      success: true,
      summary,
      note:
        "Only records belonging to marked test accounts are included. Genuine student data is not affected.",
    });
  } catch (error) {
    console.error("Preview activity clear error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not preview activity cleanup.",
    });
  }
}

/**
 * POST /api/admin/data-management/activity/export
 */
async function exportActivity(req, res) {
  try {
    const scope = String(req.body?.scope || "test_selected").trim();
    let studentIds = asObjectIdList(req.body?.studentIds);
    if (scope === "test_all") {
      studentIds = (
        await Student.find({ isTestAccount: true }).select("_id")
      ).map((s) => s._id);
    } else {
      studentIds = (
        await Student.find({
          _id: { $in: studentIds },
          isTestAccount: true,
        }).select("_id")
      ).map((s) => s._id);
    }

    const filter = { student: { $in: studentIds } };
    const [activities, quizzes, progress] = await Promise.all([
      studentIds.length
        ? StudentActivity.find(filter).sort({ createdAt: -1 }).limit(2000)
        : [],
      studentIds.length
        ? QuizAttempt.find(filter).sort({ createdAt: -1 }).limit(2000)
        : [],
      studentIds.length
        ? TopicCompletion.find(filter).sort({ completedAt: -1 }).limit(2000)
        : [],
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.admin.email,
      activities: activities.map((a) => a.toAdminObject()),
      quizAttempts: quizzes.map((q) => q.toAdminObject()),
      topicCompletions: progress.map((p) => p.toPublicObject()),
    };

    await writeAuditLog({
      admin: req.admin,
      action: "activity_export",
      summary: `Exported activity/progress for ${studentIds.length} test account(s).`,
      affectedCounts: {
        activities: activities.length,
        quizAttempts: quizzes.length,
        topicCompletions: progress.length,
      },
    });

    return res.status(200).json({ success: true, export: payload });
  } catch (error) {
    console.error("Export activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not export activity data.",
    });
  }
}

/**
 * POST /api/admin/data-management/activity/clear
 */
async function clearActivity(req, res) {
  try {
    requireConfirmPhrase(req.body);
    const scope = String(req.body?.scope || "test_selected").trim();
    const clearActivities = Boolean(req.body?.clearActivities);
    const clearQuizzes = Boolean(req.body?.clearQuizzes);
    const clearProgress = Boolean(req.body?.clearProgress);

    if (!clearActivities && !clearQuizzes && !clearProgress) {
      return res.status(400).json({
        success: false,
        message: "Select at least one record type to clear.",
      });
    }

    let studentIds = asObjectIdList(req.body?.studentIds);
    if (scope === "test_all") {
      studentIds = (
        await Student.find({ isTestAccount: true }).select("_id")
      ).map((s) => s._id);
    } else {
      studentIds = (
        await Student.find({
          _id: { $in: studentIds },
          isTestAccount: true,
        }).select("_id")
      ).map((s) => s._id);
    }

    if (!studentIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "No marked test accounts selected. Mark accounts as test accounts first.",
      });
    }

    const filter = { student: { $in: studentIds } };
    const affectedCounts = {
      studentsScoped: studentIds.length,
      activitiesDeleted: 0,
      quizAttemptsDeleted: 0,
      topicCompletionsDeleted: 0,
    };

    if (clearActivities) {
      const result = await StudentActivity.deleteMany(filter);
      affectedCounts.activitiesDeleted = result.deletedCount || 0;
    }
    if (clearQuizzes) {
      const result = await QuizAttempt.deleteMany(filter);
      affectedCounts.quizAttemptsDeleted = result.deletedCount || 0;
    }
    if (clearProgress) {
      const result = await TopicCompletion.deleteMany(filter);
      affectedCounts.topicCompletionsDeleted = result.deletedCount || 0;
    }

    await writeAuditLog({
      admin: req.admin,
      action: "activity_clear",
      summary: `Cleared testing activity for ${studentIds.length} test account(s).`,
      affectedCounts,
      metadata: {
        scope,
        clearActivities,
        clearQuizzes,
        clearProgress,
        studentIds: studentIds.map(String),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Selected testing activity cleared.",
      affectedCounts,
    });
  } catch (error) {
    if (error.code === "CONFIRM_REQUIRED") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Clear activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not clear testing activity.",
    });
  }
}

/**
 * GET /api/admin/data-management/audit
 */
async function listAuditLogs(req, res) {
  try {
    const logs = await AdminAuditLog.find()
      .sort({ createdAt: -1 })
      .limit(50);
    return res.status(200).json({
      success: true,
      count: logs.length,
      logs: logs.map((log) => ({
        id: log._id.toString(),
        action: log.action,
        summary: log.summary,
        affectedCounts: log.affectedCounts || {},
        adminEmail: log.adminEmail,
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error("List audit logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load audit logs.",
    });
  }
}

module.exports = {
  CONFIRM_PHRASE,
  listResources,
  previewResourceDeletion,
  exportResources,
  deleteResources,
  listManagedStudents,
  setStudentTestFlag,
  previewStudentDeletion,
  exportStudents,
  deleteTestStudents,
  activityStats,
  previewActivityClear,
  exportActivity,
  clearActivity,
  listAuditLogs,
};
