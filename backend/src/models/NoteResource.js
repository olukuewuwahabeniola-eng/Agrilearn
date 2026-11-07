const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("./Student");
const { resolveNoteSource } = require("../utils/noteAccess");

const noteFileSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true, trim: true },
    storagePath: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 1 },
    contentHash: { type: String, required: true },
    pageOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

/**
 * Lecture notes — official (admin) vs personal (student-owned).
 * Legacy records are a single PDF on storagePath.
 * New records may be one PDF or several image pages in `files`.
 */
const noteResourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [160, "Title is too long"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description is too long"],
      default: "",
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    storedName: {
      type: String,
      required: true,
      trim: true,
    },
    storagePath: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      default: "application/pdf",
    },
    size: {
      type: Number,
      required: true,
      min: 1,
    },
    contentHash: {
      type: String,
      required: true,
      index: true,
    },
    format: {
      type: String,
      enum: ["pdf", "images"],
      default: "pdf",
      index: true,
    },
    files: {
      type: [noteFileSchema],
      default: undefined,
    },
    level: {
      type: String,
      required: true,
      enum: {
        values: ALLOWED_LEVELS,
        message: "Level must be 100, 200, 300, or 500",
      },
      index: true,
    },
    courseCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    courseTitle: {
      type: String,
      required: true,
      trim: true,
    },
    /** official = admin-published; personal = private to studentOwner */
    source: {
      type: String,
      enum: ["official", "personal"],
      default: "personal",
      index: true,
    },
    /** Set for personal uploads — must match authenticated student to access */
    studentOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
      index: true,
    },
    /** Uploader (student or admin) for audit */
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: true }
);

noteResourceSchema.index(
  { level: 1, courseCode: 1, contentHash: 1, source: 1 },
  {
    unique: true,
    partialFilterExpression: { source: "official" },
  }
);

noteResourceSchema.index(
  { level: 1, courseCode: 1, contentHash: 1, studentOwner: 1 },
  {
    unique: true,
    partialFilterExpression: { source: "personal" },
  }
);

noteResourceSchema.methods.toPublicObject = function toPublicObject() {
  const source = resolveNoteSource(this);
  const pages = Array.isArray(this.files) && this.files.length
    ? [...this.files].sort((a, b) => (a.pageOrder ?? 0) - (b.pageOrder ?? 0))
    : [
        {
          originalName: this.originalName,
          mimeType: this.mimeType,
          size: this.size,
          pageOrder: 0,
        },
      ];
  const format =
    this.format ||
    (pages.length > 1 || String(this.mimeType || "").startsWith("image/")
      ? "images"
      : "pdf");

  return {
    id: this._id.toString(),
    title: this.title,
    description: this.description || "",
    originalName: this.originalName,
    mimeType: this.mimeType,
    size: this.size,
    format,
    fileType: format === "images" ? "Images" : "PDF",
    pageCount: pages.length,
    files: pages.map((file, index) => ({
      id: file._id ? file._id.toString() : `${index}`,
      index,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      pageOrder: file.pageOrder ?? index,
    })),
    level: this.level,
    courseCode: this.courseCode,
    courseTitle: this.courseTitle,
    source,
    sourceLabel: source === "official" ? "General Materials" : "My Personal Uploads",
    uploadedBy: this.uploadedBy,
    studentOwner: this.studentOwner ? this.studentOwner.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("NoteResource", noteResourceSchema);
