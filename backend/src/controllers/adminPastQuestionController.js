const multer = require("multer");
const mongoose = require("mongoose");
const PastQuestion = require("../models/PastQuestion");
const { ALLOWED_LEVELS } = require("../models/Student");
const { findCourseForStudent } = require("../data/coursesByLevel");
const {
  MAX_PDF_BYTES,
  MAX_IMAGES_PER_PAPER,
  ALLOWED_MIMES,
  validateImagesTotalSize,
  savePastQuestionFile,
  deletePastQuestionFiles,
  createReadStream,
} = require("../utils/pastQuestionStorage");
const { pastQuestionMulterSizeMessage } = require("../utils/uploadLimits");
const {
  applyAdminLevelFilter,
  assertResourceLevel,
  resolveScopedLevel,
  sendAdminAccessError,
} = require("../utils/adminAccess");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Per-file ceiling (PDFs up to 25 MB). Images are further capped in storage validation.
    fileSize: MAX_PDF_BYTES,
    files: MAX_IMAGES_PER_PAPER + 1,
  },
  fileFilter(req, file, cb) {
    const mime = String(file.mimetype || "").toLowerCase();
    if (ALLOWED_MIMES.has(mime)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF, JPG, JPEG, and PNG files are allowed."));
  },
});

const createUpload = upload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "images", maxCount: MAX_IMAGES_PER_PAPER },
]);

const replaceUpload = upload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "images", maxCount: MAX_IMAGES_PER_PAPER },
]);

function runUpload(middleware, req, res) {
  return new Promise((resolve, reject) => {
    middleware(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function parseExamYear(value) {
  const year = parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(year) || year < 1970 || year > 2100) return null;
  return year;
}

function parsePublished(value) {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return null;
}

function buildListFilter(req) {
  const filter = {};
  const level = String(req.query.level || "").trim();
  const courseCode = String(req.query.courseCode || "").trim().toUpperCase();
  const examYear = String(req.query.examYear || "").trim();
  const published = String(req.query.published || "").trim();
  const q = String(req.query.q || "").trim();

  applyAdminLevelFilter(req.admin, filter, level);
  if (courseCode) filter.courseCode = courseCode;
  if (examYear) {
    const year = parseExamYear(examYear);
    if (year) filter.examYear = year;
  }
  if (published === "true") filter.published = true;
  if (published === "false") filter.published = false;

  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "i");
    filter.$or = [{ courseCode: regex }, { description: regex }];
  }

  return filter;
}

async function buildFilesFromRequest(req, { level, courseCode }) {
  const pdfFile = req.files?.pdf?.[0];
  const imageFiles = req.files?.images || [];

  if (pdfFile && imageFiles.length) {
    const error = new Error("Upload either one PDF or multiple images, not both.");
    error.code = "MIXED_UPLOAD";
    throw error;
  }

  if (pdfFile) {
    const saved = await savePastQuestionFile({
      buffer: pdfFile.buffer,
      level,
      courseCode,
      originalName: pdfFile.originalname,
      mimeType: pdfFile.mimetype,
    });
    return {
      format: "pdf",
      files: [{ ...saved, pageOrder: 0 }],
    };
  }

  if (imageFiles.length) {
    validateImagesTotalSize(imageFiles.map((img) => img.buffer));
    const files = [];
    for (let i = 0; i < imageFiles.length; i += 1) {
      const img = imageFiles[i];
      const saved = await savePastQuestionFile({
        buffer: img.buffer,
        level,
        courseCode,
        originalName: img.originalname,
        mimeType: img.mimetype,
      });
      files.push({ ...saved, pageOrder: i });
    }
    return { format: "images", files };
  }

  const error = new Error("Please upload a PDF or one or more images.");
  error.code = "NO_FILES";
  throw error;
}

function handleUploadError(error, res) {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: pastQuestionMulterSizeMessage(),
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: `You can upload at most ${MAX_IMAGES_PER_PAPER} images per paper.`,
      });
    }
    return res.status(400).json({
      success: false,
      message: "Could not read the uploaded files.",
    });
  }

  if (error?.code === "MIXED_UPLOAD" || error?.code === "NO_FILES") {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error?.code === "INVALID_MIME" || error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error?.message?.includes("Only PDF")) {
    return res.status(400).json({ success: false, message: error.message });
  }

  console.error("Past question upload error:", error);
  return res.status(500).json({
    success: false,
    message: "Could not save past question files.",
  });
}

/**
 * GET /api/admin/past-questions
 */
async function listPastQuestions(req, res) {
  try {
    const filter = buildListFilter(req);
    const items = await PastQuestion.find(filter)
      .sort({ examYear: -1, createdAt: -1 })
      .limit(500);

    return res.status(200).json({
      success: true,
      count: items.length,
      scopedLevel: filter.level || null,
      pastQuestions: items.map((item) => item.toPublicObject()),
    });
  } catch (error) {
    if (
      error.code === "ADMIN_LEVEL_FORBIDDEN" ||
      error.code === "ADMIN_LEVEL_INVALID"
    ) {
      return sendAdminAccessError(res, error);
    }
    console.error("Admin list past questions error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load past questions.",
    });
  }
}

/**
 * POST /api/admin/past-questions
 */
async function createPastQuestion(req, res) {
  try {
    await runUpload(createUpload, req, res);

    const level = String(req.body?.level || "").trim();
    const courseCode = String(req.body?.courseCode || "").trim();
    const examYear = parseExamYear(req.body?.examYear);
    const description = String(req.body?.description || "").trim();
    const publishedRaw = parsePublished(req.body?.published);

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
        message: "Enter a valid course code for the selected level.",
      });
    }

    if (!examYear) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid examination year.",
      });
    }

    const { format, files } = await buildFilesFromRequest(req, {
      level,
      courseCode: course.code,
    });

    const doc = await PastQuestion.create({
      courseCode: course.code,
      courseTitle: course.title,
      level,
      examYear,
      description: description.slice(0, 500),
      format,
      files,
      published: publishedRaw === true,
      uploadedBy: req.admin._id,
    });

    return res.status(201).json({
      success: true,
      message: doc.published
        ? "Past question published."
        : "Past question saved as draft.",
      pastQuestion: doc.toPublicObject(),
    });
  } catch (error) {
    return handleUploadError(error, res);
  }
}

/**
 * PATCH /api/admin/past-questions/:id
 */
async function updatePastQuestion(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid past question id.",
      });
    }

    const doc = await PastQuestion.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Past question not found.",
      });
    }

    assertResourceLevel(req.admin, doc.level);

    const level = String(req.body?.level || doc.level).trim();
    const courseCode = String(req.body?.courseCode || doc.courseCode).trim();
    const examYear =
      req.body?.examYear != null
        ? parseExamYear(req.body.examYear)
        : doc.examYear;
    const description =
      req.body?.description != null
        ? String(req.body.description).trim().slice(0, 500)
        : doc.description;
    const publishedRaw = parsePublished(req.body?.published);

    resolveScopedLevel(req.admin, level);

    if (!ALLOWED_LEVELS.includes(level)) {
      return res.status(400).json({
        success: false,
        message: "Select a valid academic level.",
      });
    }

    const course = findCourseForStudent(level, courseCode);
    if (!course) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid course code for the selected level.",
      });
    }

    if (!examYear) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid examination year.",
      });
    }

    doc.level = level;
    doc.courseCode = course.code;
    doc.courseTitle = course.title;
    doc.examYear = examYear;
    doc.description = description;
    if (publishedRaw !== null) doc.published = publishedRaw;

    await doc.save();

    return res.status(200).json({
      success: true,
      message: "Past question updated.",
      pastQuestion: doc.toPublicObject(),
    });
  } catch (error) {
    if (
      error.code === "ADMIN_LEVEL_FORBIDDEN" ||
      error.code === "ADMIN_LEVEL_INVALID"
    ) {
      return sendAdminAccessError(res, error);
    }
    console.error("Update past question error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not update past question.",
    });
  }
}

/**
 * PUT /api/admin/past-questions/:id/files — replace PDF or image set
 */
async function replacePastQuestionFiles(req, res) {
  try {
    await runUpload(replaceUpload, req, res);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid past question id.",
      });
    }

    const doc = await PastQuestion.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Past question not found.",
      });
    }

    assertResourceLevel(req.admin, doc.level);

    const { format, files } = await buildFilesFromRequest(req, {
      level: doc.level,
      courseCode: doc.courseCode,
    });

    await deletePastQuestionFiles(doc.files);
    doc.format = format;
    doc.files = files;
    await doc.save();

    return res.status(200).json({
      success: true,
      message: "Files replaced successfully.",
      pastQuestion: doc.toPublicObject(),
    });
  } catch (error) {
    if (
      error.code === "ADMIN_LEVEL_FORBIDDEN" ||
      error.code === "ADMIN_LEVEL_INVALID"
    ) {
      return sendAdminAccessError(res, error);
    }
    return handleUploadError(error, res);
  }
}

/**
 * DELETE /api/admin/past-questions/:id
 */
async function deletePastQuestion(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid past question id.",
      });
    }

    const doc = await PastQuestion.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Past question not found.",
      });
    }

    assertResourceLevel(req.admin, doc.level);

    await deletePastQuestionFiles(doc.files);
    await doc.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Past question deleted.",
    });
  } catch (error) {
    if (
      error.code === "ADMIN_LEVEL_FORBIDDEN" ||
      error.code === "ADMIN_LEVEL_INVALID"
    ) {
      return sendAdminAccessError(res, error);
    }
    console.error("Delete past question error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete past question.",
    });
  }
}

/**
 * GET /api/admin/past-questions/:id/files/:fileIndex/file
 */
async function streamPastQuestionFile(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid past question id.",
      });
    }

    const doc = await PastQuestion.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Past question not found.",
      });
    }

    assertResourceLevel(req.admin, doc.level);

    const fileIndex = parseInt(String(req.params.fileIndex || "0"), 10);
    const sorted = [...doc.files].sort(
      (a, b) => (a.pageOrder ?? 0) - (b.pageOrder ?? 0)
    );
    const file = sorted[fileIndex];
    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found.",
      });
    }

    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.originalName || "file")}"`
    );
    if (file.size) res.setHeader("Content-Length", String(file.size));

    const stream = createReadStream(file.storagePath);
    stream.on("error", (err) => {
      console.error("Past question stream error:", err.message);
      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          message: "File is missing on the server.",
        });
      }
    });
    stream.pipe(res);
  } catch (error) {
    if (
      error.code === "ADMIN_LEVEL_FORBIDDEN" ||
      error.code === "ADMIN_LEVEL_INVALID"
    ) {
      return sendAdminAccessError(res, error);
    }
    console.error("Admin past question file error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not open file.",
    });
  }
}

module.exports = {
  listPastQuestions,
  createPastQuestion,
  updatePastQuestion,
  replacePastQuestionFiles,
  deletePastQuestion,
  streamPastQuestionFile,
};
