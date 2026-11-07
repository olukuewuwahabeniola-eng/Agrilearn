const multer = require("multer");
const NoteResource = require("../models/NoteResource");
const {
  MAX_PDF_BYTES,
  MAX_IMAGES_PER_NOTE,
  NOTE_ALLOWED_MIMES,
  hashBuffer,
  saveNoteFile,
  deleteStoredNoteFile,
  validateImagesTotalSize,
} = require("./noteStorage");
const {
  pastQuestionMulterSizeMessage,
  imagesCountTooLargeMessage,
} = require("./uploadLimits");

const notesUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PDF_BYTES,
    files: MAX_IMAGES_PER_NOTE + 1,
  },
  fileFilter(req, file, cb) {
    const mime = String(file.mimetype || "").toLowerCase();
    if (NOTE_ALLOWED_MIMES.has(mime)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF, JPG, JPEG, PNG, and WEBP files are allowed."));
  },
});

const notesUploadFields = notesUpload.fields([
  { name: "pdf", maxCount: 1 },
  { name: "images", maxCount: MAX_IMAGES_PER_NOTE },
]);

function runNotesUpload(req, res) {
  return new Promise((resolve, reject) => {
    notesUploadFields(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function handleNotesUploadError(error, res, fallback = "Could not save the note.") {
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
        message: imagesCountTooLargeMessage(),
      });
    }
    return res.status(400).json({
      success: false,
      message: "Could not read the uploaded files. Please try again.",
    });
  }

  if (
    error?.message === "Only PDF, JPG, JPEG, PNG, and WEBP files are allowed." ||
    error?.message === "Only PDF files are allowed."
  ) {
    return res.status(400).json({
      success: false,
      message: "Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.",
    });
  }

  if (
    error?.code === "LIMIT_FILE_SIZE" ||
    error?.code === "LIMIT_FILE_COUNT" ||
    error?.code === "EMPTY_FILE" ||
    error?.code === "EMPTY_PDF" ||
    error?.code === "INVALID_MIME" ||
    error?.code === "INVALID_UPLOAD_MIX"
  ) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (
    error?.code === "CLOUDINARY_NOT_CONFIGURED" ||
    error?.code === "CLOUDINARY_UPLOAD_FAILED"
  ) {
    console.error(
      `[notes] upload storage error code=${error.code} http=${error.http_code || "n/a"} message=${String(error.message || "").slice(0, 300)}`
    );
    return res.status(503).json({
      success: false,
      message: "File storage is temporarily unavailable. Please try again later.",
    });
  }

  console.error("Notes upload error:", error);
  return res.status(500).json({
    success: false,
    message: fallback,
  });
}

function collectNoteUploads(req) {
  const pdf = req.files?.pdf?.[0] || req.file || null;
  const images = Array.isArray(req.files?.images) ? req.files.images : [];

  if (pdf && images.length) {
    const error = new Error(
      "Upload either one PDF or a set of images — not both in the same note."
    );
    error.code = "INVALID_UPLOAD_MIX";
    throw error;
  }

  if (pdf?.buffer?.length) {
    return {
      format: "pdf",
      files: [pdf],
    };
  }

  if (images.length) {
    if (images.length > MAX_IMAGES_PER_NOTE) {
      const error = new Error(imagesCountTooLargeMessage());
      error.code = "LIMIT_FILE_COUNT";
      throw error;
    }
    validateImagesTotalSize(images.map((file) => file.buffer));
    return {
      format: "images",
      files: images,
    };
  }

  return { format: null, files: [] };
}

function combinedContentHash(buffers) {
  if (buffers.length === 1) return hashBuffer(buffers[0]);
  return hashBuffer(Buffer.from(buffers.map((buffer) => hashBuffer(buffer)).join("|")));
}

async function persistNotePages({
  files,
  format,
  level,
  courseCode,
  folderKind,
  ownerSegment,
}) {
  const saved = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const stored = await saveNoteFile({
        buffer: file.buffer,
        level,
        courseCode,
        originalName: file.originalname,
        mimeType: file.mimetype,
        folderKind,
        ownerSegment,
      });
      saved.push({
        originalName: file.originalname || stored.originalName,
        storedName: stored.storedName,
        storagePath: stored.storagePath,
        mimeType: stored.mimeType,
        size: stored.size,
        contentHash: stored.contentHash,
        pageOrder: index,
      });
    }
    return saved;
  } catch (error) {
    await Promise.all(saved.map((item) => deleteStoredNoteFile(item.storagePath)));
    throw error;
  }
}

function defaultNoteTitle({ titleInput, files, format, courseCode }) {
  if (titleInput) return titleInput.slice(0, 160);
  const firstName = String(files[0]?.originalname || "").replace(/\.[^.]+$/i, "");
  if (firstName.trim()) return firstName.trim().slice(0, 160);
  return format === "images"
    ? `${courseCode} lecture images`
    : `${courseCode} lecture notes`;
}

async function findDuplicateNote({
  level,
  courseCode,
  contentHash,
  source,
  studentOwner,
}) {
  const filter = { level, courseCode, contentHash, source };
  if (source === "personal") filter.studentOwner = studentOwner;
  return NoteResource.findOne(filter);
}

function resolveNotePages(note) {
  if (Array.isArray(note.files) && note.files.length > 0) {
    return [...note.files].sort(
      (a, b) => (a.pageOrder ?? 0) - (b.pageOrder ?? 0)
    );
  }
  return [
    {
      originalName: note.originalName,
      storedName: note.storedName,
      storagePath: note.storagePath,
      mimeType: note.mimeType,
      size: note.size,
      pageOrder: 0,
    },
  ];
}

function resolveNoteFormat(note) {
  if (note.format === "images" || note.format === "pdf") return note.format;
  const pages = resolveNotePages(note);
  if (pages.length > 1) return "images";
  return String(pages[0]?.mimeType || note.mimeType || "").startsWith("image/")
    ? "images"
    : "pdf";
}

module.exports = {
  runNotesUpload,
  handleNotesUploadError,
  collectNoteUploads,
  combinedContentHash,
  persistNotePages,
  defaultNoteTitle,
  findDuplicateNote,
  resolveNotePages,
  resolveNoteFormat,
};
