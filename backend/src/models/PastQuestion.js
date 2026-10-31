const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("./Student");

const pastQuestionFileSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true, trim: true },
    storagePath: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 1 },
    contentHash: { type: String, required: true, index: true },
    pageOrder: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const pastQuestionSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    courseTitle: {
      type: String,
      trim: true,
      default: "",
    },
    level: {
      type: String,
      required: true,
      enum: ALLOWED_LEVELS,
      index: true,
    },
    examYear: {
      type: Number,
      required: true,
      min: 1970,
      max: 2100,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    /** pdf = single PDF; images = one examination paper as multiple photos */
    format: {
      type: String,
      enum: ["pdf", "images"],
      required: true,
      index: true,
    },
    files: {
      type: [pastQuestionFileSchema],
      validate: {
        validator(files) {
          return Array.isArray(files) && files.length >= 1;
        },
        message: "At least one file is required.",
      },
    },
    published: {
      type: Boolean,
      default: false,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

pastQuestionSchema.index({ level: 1, courseCode: 1, examYear: -1 });
pastQuestionSchema.index({ published: 1, level: 1, createdAt: -1 });

pastQuestionSchema.methods.toPublicObject = function toPublicObject() {
  const sortedFiles = [...(this.files || [])].sort(
    (a, b) => (a.pageOrder ?? 0) - (b.pageOrder ?? 0)
  );
  return {
    id: this._id.toString(),
    courseCode: this.courseCode,
    courseTitle: this.courseTitle || "",
    level: this.level,
    examYear: this.examYear,
    description: this.description || "",
    format: this.format,
    fileType: this.format === "pdf" ? "PDF" : "Image",
    pageCount: sortedFiles.length,
    files: sortedFiles.map((file, index) => ({
      id: file._id.toString(),
      index,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      pageOrder: file.pageOrder ?? index,
    })),
    published: this.published,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("PastQuestion", pastQuestionSchema);
