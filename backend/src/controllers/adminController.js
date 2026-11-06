const bcrypt = require("bcryptjs");
const multer = require("multer");
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
const {
  MAX_PDF_BYTES,
  hashBuffer,
  savePdfBuffer,
  deleteStoredNoteFile,
} = require("../utils/noteStorage");
const { pdfTooLargeMessage } = require("../utils/uploadLimits");
const { startOfTodayUtc } = require("../utils/activityTracker");
const {
  applyAdminLevelFilter,
  assertResourceLevel,
  isSuperAdmin,
  resolveScopedLevel,
  sendAdminAccessError,
} = require("../utils/adminAccess");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF files are allowed."));
  },
});

const pdfUpload = upload.single("pdf");

function runPdfUpload(req, res) {
  return new Promise((resolve, reject) => {
    pdfUpload(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

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
 * Upload PDF for any academic level + course (admin).
 * uploadedBy is set to the admin's id for audit; students still level-gated on read.
 */
async function uploadNote(req, res) {
  try {
    await runPdfUpload(req, res);

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

    if (!req.file?.buffer?.length) {
      return res.status(400).json({
        success: false,
        message: "Please choose a PDF file to upload.",
      });
    }

    const contentHash = hashBuffer(req.file.buffer);
    const existing = await NoteResource.findOne({
      level,
      courseCode: course.code,
      contentHash,
      source: "official",
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        duplicated: true,
        message: "This PDF is already in the library for that course.",
        note: existing.toPublicObject(),
      });
    }

    const saved = await savePdfBuffer({
      buffer: req.file.buffer,
      level,
      courseCode: course.code,
      originalName: req.file.originalname,
      folderKind: "notes/official",
    });

    const title =
      titleInput ||
      String(req.file.originalname || "Lecture notes")
        .replace(/\.pdf$/i, "")
        .trim()
        .slice(0, 160) ||
      `${course.code} lecture notes`;

    // NoteResource.uploadedBy refs Student. For admin uploads we still need an ObjectId;
    // store admin id in uploadedBy for audit — schema is ObjectId without strict populate.
    let note;
    try {
      note = await NoteResource.create({
        title,
        description: description.slice(0, 500) || "Official AgriLearn material",
        originalName: req.file.originalname || saved.storedName,
        storedName: saved.storedName,
        storagePath: saved.storagePath,
        mimeType: req.file.mimetype || "application/pdf",
        size: saved.size,
        contentHash: saved.contentHash,
        level,
        courseCode: course.code,
        courseTitle: course.title,
        source: "official",
        studentOwner: null,
        uploadedBy: req.admin._id,
      });
    } catch (createError) {
      await deleteStoredNoteFile(saved.storagePath);
      throw createError;
    }

    return res.status(201).json({
      success: true,
      duplicated: false,
      message: "PDF published to the course library.",
      note: note.toPublicObject(),
    });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: pdfTooLargeMessage(),
        });
      }
      return res.status(400).json({
        success: false,
        message: "Could not read the uploaded PDF.",
      });
    }
    if (error?.message === "Only PDF files are allowed.") {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (
      error?.code === "CLOUDINARY_NOT_CONFIGURED" ||
      error?.code === "CLOUDINARY_UPLOAD_FAILED"
    ) {
      console.error(
        `[admin notes] upload storage error code=${error.code} http=${error.http_code || "n/a"} message=${String(error.message || "").slice(0, 300)}`
      );
      return res.status(503).json({
        success: false,
        message:
          "File storage is temporarily unavailable. Please try again later.",
      });
    }
    if (error?.code === 11000) {
      return res.status(200).json({
        success: true,
        duplicated: true,
        message: "This PDF is already in the library for that course.",
      });
    }
    console.error("Admin upload note error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not upload the PDF.",
    });
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
