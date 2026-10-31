const multer = require("multer");
const NoteResource = require("../models/NoteResource");
const { findCourseForStudent } = require("../data/coursesByLevel");
const {
  buildLibraryFilter,
  studentCanAccessNote,
  studentCanDeleteNote,
} = require("../utils/noteAccess");
const {
  MAX_PDF_BYTES,
  hashBuffer,
  savePdfBuffer,
  createReadStream,
  resolveStoredPath,
} = require("../utils/noteStorage");
const { pdfTooLargeMessage } = require("../utils/uploadLimits");
const {
  logMaterialViewIfNeeded,
  logMaterialDownloadIfNeeded,
  logCourseAccessIfNeeded,
  recordPersonalUpload,
} = require("../utils/activityTracker");

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

function handleUploadError(error, res) {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: pdfTooLargeMessage(),
      });
    }
    return res.status(400).json({
      success: false,
      message: "Could not read the uploaded PDF. Please try again.",
    });
  }

  if (error && error.message === "Only PDF files are allowed.") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error?.code === "LIMIT_FILE_SIZE" || error?.code === "EMPTY_PDF") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Notes upload error:", error);
  return res.status(500).json({
    success: false,
    message: "Could not save the PDF. Please try again.",
  });
}

/**
 * GET /api/notes?library=official|personal&courseCode=&q=
 */
async function listNotes(req, res) {
  try {
    const student = req.student;
    const library = String(req.query.library || "official").trim().toLowerCase();
    const courseCode = String(req.query.courseCode || "").trim().toUpperCase();
    const q = String(req.query.q || "").trim();

    if (library !== "official" && library !== "personal") {
      return res.status(400).json({
        success: false,
        message: 'Use library=official or library=personal.',
      });
    }

    const filter = buildLibraryFilter(student, library);

    if (courseCode) {
      const course = findCourseForStudent(student.level, courseCode);
      if (!course) {
        return res.status(403).json({
          success: false,
          message:
            "That course is not available for your academic level. Choose a course from your level dashboard.",
        });
      }
      filter.courseCode = course.code;
    }

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
      .limit(200);

    if (courseCode) {
      const course = findCourseForStudent(student.level, courseCode);
      if (course) {
        await logCourseAccessIfNeeded(student, course);
      }
    }

    return res.status(200).json({
      success: true,
      library,
      level: student.level,
      count: notes.length,
      notes: notes.map((note) => note.toPublicObject()),
    });
  } catch (error) {
    console.error("List notes error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load notes right now. Please try again.",
    });
  }
}

/**
 * POST /api/notes — student personal upload only.
 */
async function uploadNote(req, res) {
  try {
    await runPdfUpload(req, res);

    const student = req.student;
    const courseCode = String(req.body?.courseCode || "").trim();
    const titleInput = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();

    if (!courseCode) {
      return res.status(400).json({
        success: false,
        message: "Select a course before uploading a PDF.",
      });
    }

    const course = findCourseForStudent(student.level, courseCode);
    if (!course) {
      return res.status(403).json({
        success: false,
        message:
          "That course is not available for your academic level. Choose a course from your level dashboard.",
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
      level: student.level,
      courseCode: course.code,
      contentHash,
      source: "personal",
      studentOwner: student._id,
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        duplicated: true,
        message: "This PDF is already in your personal library.",
        note: existing.toPublicObject(),
      });
    }

    const saved = await savePdfBuffer({
      buffer: req.file.buffer,
      level: student.level,
      courseCode: course.code,
      originalName: req.file.originalname,
    });

    const title =
      titleInput ||
      String(req.file.originalname || "Lecture notes")
        .replace(/\.pdf$/i, "")
        .trim()
        .slice(0, 160) ||
      `${course.code} lecture notes`;

    const note = await NoteResource.create({
      title,
      description: description.slice(0, 500) || "Personal upload",
      originalName: req.file.originalname || saved.storedName,
      storedName: saved.storedName,
      storagePath: saved.storagePath,
      mimeType: req.file.mimetype || "application/pdf",
      size: saved.size,
      contentHash: saved.contentHash,
      level: student.level,
      courseCode: course.code,
      courseTitle: course.title,
      source: "personal",
      studentOwner: student._id,
      uploadedBy: student._id,
    });

    await recordPersonalUpload(student, note, { via: "notes" });

    return res.status(201).json({
      success: true,
      duplicated: false,
      message: "PDF saved to My Personal Uploads.",
      note: note.toPublicObject(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      try {
        const courseCode = String(req.body?.courseCode || "").trim();
        const course = findCourseForStudent(req.student.level, courseCode);
        const contentHash = req.file?.buffer
          ? hashBuffer(req.file.buffer)
          : null;
        if (course && contentHash) {
          const existing = await NoteResource.findOne({
            level: req.student.level,
            courseCode: course.code,
            contentHash,
            source: "personal",
            studentOwner: req.student._id,
          });
          if (existing) {
            return res.status(200).json({
              success: true,
              duplicated: true,
              message: "This PDF is already in your personal library.",
              note: existing.toPublicObject(),
            });
          }
        }
      } catch {
        /* fall through */
      }
    }
    return handleUploadError(error, res);
  }
}

async function getNote(req, res) {
  try {
    const note = await NoteResource.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "PDF not found.",
      });
    }
    if (!studentCanAccessNote(note, req.student)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this material.",
      });
    }
    await logMaterialViewIfNeeded(req.student, note);
    return res.status(200).json({
      success: true,
      note: note.toPublicObject(),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid note id.",
    });
  }
}

async function downloadNoteFile(req, res) {
  try {
    const note = await NoteResource.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "PDF not found.",
      });
    }
    if (!studentCanAccessNote(note, req.student)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this material.",
      });
    }

    await logMaterialDownloadIfNeeded(req.student, note);

    resolveStoredPath(note.storagePath);
    res.setHeader("Content-Type", note.mimeType || "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(note.originalName || "notes.pdf")}"`
    );
    if (note.size) {
      res.setHeader("Content-Length", String(note.size));
    }

    const stream = createReadStream(note.storagePath);
    stream.on("error", (err) => {
      console.error("PDF stream error:", err.message);
      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          message: "PDF file is missing on the server.",
        });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Download note error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not download that PDF.",
    });
  }
}

/**
 * DELETE /api/notes/:id — personal uploads only, owner only.
 */
async function deleteNote(req, res) {
  try {
    const note = await NoteResource.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "PDF not found.",
      });
    }
    if (!studentCanDeleteNote(note, req.student)) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own personal uploads.",
      });
    }

    await note.deleteOne();
    // File remains on disk for now (same as prior behavior); metadata removed.

    return res.status(200).json({
      success: true,
      message: "Personal upload removed.",
      id: req.params.id,
    });
  } catch (error) {
    console.error("Delete note error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete that upload.",
    });
  }
}

module.exports = {
  listNotes,
  uploadNote,
  getNote,
  downloadNoteFile,
  deleteNote,
};
