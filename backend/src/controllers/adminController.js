const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const Student = require("../models/Student");
const NoteResource = require("../models/NoteResource");
const AiConversation = require("../models/AiConversation");
const {
  getCoursesForLevel,
  findCourseForStudent,
} = require("../data/coursesByLevel");
const { ALLOWED_LEVELS } = require("../models/Student");
const { deleteStoredNoteFile } = require("../utils/noteStorage");
const {
  runNotesUpload,
  handleNotesUploadError,
  collectNoteUploads,
  combinedContentHash,
  persistNotePages,
  defaultNoteTitle,
  findDuplicateNote,
} = require("../utils/notesUpload");
const { startOfTodayUtc } = require("../utils/activityTracker");
const {
  applyAdminLevelFilter,
  assertResourceLevel,
  isSuperAdmin,
  resolveScopedLevel,
  sendAdminAccessError,
} = require("../utils/adminAccess");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/admin/overview
 */
async function overview(req, res) {
  try {
    const requestedLevel = String(req.query.level || "").trim();
    const { filter: levelFilter, scopedLevel } = applyAdminLevelFilter(
      req.admin,
      {},
      requestedLevel
    );

    const studentMatch = { ...levelFilter };
    const noteMatch = { ...levelFilter };

    let conversationsCount = 0;
    if (scopedLevel) {
      const scopedStudentIds = await Student.find(studentMatch).select("_id");
      conversationsCount = await AiConversation.countDocuments({
        student: { $in: scopedStudentIds.map((s) => s._id) },
      });
    } else {
      conversationsCount = await AiConversation.countDocuments();
    }

    const [
      studentsCount,
      notesCount,
      adminsCount,
      studentsByLevel,
      recentStudents,
      recentNotes,
    ] = await Promise.all([
      Student.countDocuments(studentMatch),
      NoteResource.countDocuments(noteMatch),
      isSuperAdmin(req.admin) ? Admin.countDocuments() : 0,
      Student.aggregate([
        ...(Object.keys(studentMatch).length
          ? [{ $match: studentMatch }]
          : []),
        { $group: { _id: "$level", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Student.find(studentMatch)
        .sort({ createdAt: -1 })
        .limit(5)
        .select("fullName email matricNumber level createdAt"),
      NoteResource.find(noteMatch)
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title courseCode level originalName createdAt size"),
    ]);

    const levelCounts = { "100": 0, "200": 0, "300": 0, "500": 0 };
    for (const row of studentsByLevel) {
      if (levelCounts[row._id] !== undefined) {
        levelCounts[row._id] = row.count;
      }
    }

    return res.status(200).json({
      success: true,
      scopedLevel,
      overview: {
        studentsCount,
        notesCount,
        conversationsCount,
        adminsCount,
        levelCounts,
        recentStudents: recentStudents.map((s) => s.toSafeObject()),
        recentNotes: recentNotes.map((n) => n.toPublicObject()),
      },
    });
  } catch (error) {
    if (error.code === "ADMIN_LEVEL_FORBIDDEN" || error.code === "ADMIN_LEVEL_INVALID") {
      return sendAdminAccessError(res, error);
    }
    console.error("Admin overview error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load admin overview.",
    });
  }
}

/**
 * GET /api/admin/students?q=&level=
 */
async function listStudents(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    const level = String(req.query.level || "").trim();
    const activeToday =
      req.query.activeToday === "1" || req.query.activeToday === "true";
    const filter = {};

    applyAdminLevelFilter(req.admin, filter, level);

    if (activeToday) {
      filter.lastActiveAt = { $gte: startOfTodayUtc() };
    }

    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { matricNumber: regex },
      ];
    }

    const students = await Student.find(filter)
      .sort({ createdAt: -1 })
      .limit(500);

    return res.status(200).json({
      success: true,
      count: students.length,
      scopedLevel: filter.level || null,
      students: students.map((s) => s.toSafeObject()),
    });
  } catch (error) {
    if (error.code === "ADMIN_LEVEL_FORBIDDEN" || error.code === "ADMIN_LEVEL_INVALID") {
      return sendAdminAccessError(res, error);
    }
    console.error("Admin list students error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load students.",
    });
  }
}

/**
 * GET /api/admin/students/:id
 */
async function getStudent(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id.",
      });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    assertResourceLevel(req.admin, student.level);

    const [notesCount, conversationsCount] = await Promise.all([
      NoteResource.countDocuments({ uploadedBy: student._id }),
      AiConversation.countDocuments({ student: student._id }),
    ]);

    return res.status(200).json({
      success: true,
      student: student.toSafeObject(),
      stats: { notesCount, conversationsCount },
    });
  } catch (error) {
    if (error.code === "ADMIN_LEVEL_FORBIDDEN" || error.code === "ADMIN_LEVEL_INVALID") {
      return sendAdminAccessError(res, error);
    }
    console.error("Admin get student error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load student.",
    });
  }
}

/**
 * GET /api/admin/courses
 * Read-only catalogs by level (aligned with student dashboard).
 */
async function listCourses(req, res) {
  try {
    const level = String(req.query.level || "").trim();
    const scopedLevel = resolveScopedLevel(req.admin, level);

    if (scopedLevel) {
      const courses = getCoursesForLevel(scopedLevel);
      return res.status(200).json({
        success: true,
        level: scopedLevel,
        scopedLevel,
        count: courses.length,
        courses,
      });
    }

    // Super Admin, no filter — all levels
    const byLevel = {};
    for (const lvl of ALLOWED_LEVELS) {
      byLevel[lvl] = getCoursesForLevel(lvl);
    }

    return res.status(200).json({
      success: true,
      levels: ALLOWED_LEVELS,
      byLevel,
      scopedLevel: null,
      total: ALLOWED_LEVELS.reduce(
        (sum, lvl) => sum + byLevel[lvl].length,
        0
      ),
    });
  } catch (error) {
    if (error.code === "ADMIN_LEVEL_FORBIDDEN" || error.code === "ADMIN_LEVEL_INVALID") {
      return sendAdminAccessError(res, error);
    }
    console.error("Admin list courses error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load courses.",
    });
  }
}

/**
 * GET /api/admin/notes?level=&courseCode=&q=
 */
async function listNotes(req, res) {
  try {
    const level = String(req.query.level || "").trim();
    const courseCode = String(req.query.courseCode || "").trim().toUpperCase();
    const q = String(req.query.q || "").trim();
    const filter = {
      $or: [
        { source: "official" },
        {
          source: { $exists: false },
          description: { $regex: /AgriLearn Admin|Official AgriLearn/i },
        },
      ],
    };

    applyAdminLevelFilter(req.admin, filter, level);
    if (courseCode) filter.courseCode = courseCode;

    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { title: regex },
            { description: regex },
            { originalName: regex },
            { courseCode: regex },
            { courseTitle: regex },
          ],
        },
      ];
    }

    const notes = await NoteResource.find(filter)
      .sort({ createdAt: -1 })
      .limit(300);

    return res.status(200).json({
      success: true,
      count: notes.length,
      scopedLevel: filter.level || null,
      notes: notes.map((n) => n.toPublicObject()),
    });
  } catch (error) {
    if (error.code === "ADMIN_LEVEL_FORBIDDEN" || error.code === "ADMIN_LEVEL_INVALID") {
      return sendAdminAccessError(res, error);
    }
    console.error("Admin list notes error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load notes.",
    });
  }
}

/**
 * POST /api/admin/notes
 * Official course notes: one PDF or multiple images as a single note.
 * uploadedBy is the admin id for audit; students remain level-gated on read.
 */
async function uploadNote(req, res) {
  try {
    await runNotesUpload(req, res);

    const level = String(req.body?.level || "").trim();
    const courseCode = String(req.body?.courseCode || "").trim();
    const titleInput = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();

    try {
      resolveScopedLevel(req.admin, level);
    } catch (scopeError) {
      return sendAdminAccessError(res, scopeError);
    }

    if (!ALLOWED_LEVELS.includes(level)) {
      return res.status(400).json({
        success: false,
        message: "Select a valid academic level (100, 200, 300, or 500).",
      });
    }

    const course = findCourseForStudent(level, courseCode);
    if (!course) {
      return res.status(400).json({
        success: false,
        message: "Select a valid course for that academic level.",
      });
    }

    const { format, files } = collectNoteUploads(req);
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "Please choose a PDF or one or more images to upload.",
      });
    }

    const contentHash = combinedContentHash(files.map((file) => file.buffer));
    const existing = await findDuplicateNote({
      level,
      courseCode: course.code,
      contentHash,
      source: "official",
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        duplicated: true,
        message: "This note is already in the library for that course.",
        note: existing.toPublicObject(),
      });
    }

    const savedFiles = await persistNotePages({
      files,
      format,
      level,
      courseCode: course.code,
      folderKind: "notes/official",
    });

    const first = savedFiles[0];
    const title = defaultNoteTitle({
      titleInput,
      files,
      format,
      courseCode: course.code,
    });

    let note;
    try {
      note = await NoteResource.create({
        title,
        description: description.slice(0, 500) || "Official AgriLearn material",
        originalName: first.originalName,
        storedName: first.storedName,
        storagePath: first.storagePath,
        mimeType: first.mimeType,
        size: savedFiles.reduce((sum, file) => sum + file.size, 0),
        contentHash,
        format,
        files: savedFiles,
        level,
        courseCode: course.code,
        courseTitle: course.title,
        source: "official",
        studentOwner: null,
        uploadedBy: req.admin._id,
      });
    } catch (createError) {
      await Promise.all(
        savedFiles.map((file) => deleteStoredNoteFile(file.storagePath))
      );
      throw createError;
    }

    return res.status(201).json({
      success: true,
      duplicated: false,
      message:
        format === "images"
          ? `Published ${savedFiles.length} pages to the course library.`
          : "PDF published to the course library.",
      note: note.toPublicObject(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      try {
        const level = String(req.body?.level || "").trim();
        const courseCode = String(req.body?.courseCode || "").trim();
        const course = findCourseForStudent(level, courseCode);
        const { files } = collectNoteUploads(req);
        const contentHash = files.length
          ? combinedContentHash(files.map((file) => file.buffer))
          : null;
        if (course && contentHash) {
          const existing = await findDuplicateNote({
            level,
            courseCode: course.code,
            contentHash,
            source: "official",
          });
          if (existing) {
            return res.status(200).json({
              success: true,
              duplicated: true,
              message: "This note is already in the library for that course.",
              note: existing.toPublicObject(),
            });
          }
        }
      } catch {
        /* fall through */
      }
    }
    return handleNotesUploadError(
      error,
      res,
      "Could not upload the note. Please try again."
    );
  }
}

/**
 * PATCH /api/admin/profile
 */
async function updateProfile(req, res) {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    const admin = await Admin.findById(req.admin._id).select("+password");
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Administrator not found.",
      });
    }

    if (fullName) {
      if (fullName.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Full name must be at least 2 characters.",
        });
      }
      admin.fullName = fullName;
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Enter your current password to set a new one.",
        });
      }
      const match = await bcrypt.compare(currentPassword, admin.password);
      if (!match) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters.",
        });
      }
      admin.password = await bcrypt.hash(newPassword, 12);
    }

    // Email is not changeable via this endpoint (identity lock).
    if (req.body?.email || req.body?.role) {
      // Silently ignore mass-assignment attempts for email/role.
    }

    await admin.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated.",
      admin: admin.toSafeObject(),
    });
  } catch (error) {
    console.error("Admin profile update error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not update profile.",
    });
  }
}

module.exports = {
  overview,
  listStudents,
  getStudent,
  listCourses,
  listNotes,
  uploadNote,
  updateProfile,
};
