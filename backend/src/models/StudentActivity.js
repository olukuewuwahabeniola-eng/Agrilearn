const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("./Student");

/**
 * Unified student activity log for admin monitoring.
 * Never store passwords, tokens, or full private chat transcripts.
 */
const ACTIVITY_CATEGORIES = [
  "login",
  "material",
  "ai",
  "upload",
  "quiz",
  "assignment",
  "platform",
];

const ACTIVITY_TYPES = [
  "registration",
  "login",
  "profile_update",
  "course_access",
  "material_view",
  "material_download",
  "ai_question",
  "ai_summarise",
  "ai_quiz",
  "personal_upload",
  "quiz_attempt",
  "quiz_completed",
  "assignment_submitted",
  "assignment_pending",
  "assignment_reviewed",
  "learning_completed",
];

const studentActivitySchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    level: {
      type: String,
      required: true,
      enum: ALLOWED_LEVELS,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: ACTIVITY_CATEGORIES,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ACTIVITY_TYPES,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    courseCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      index: true,
    },
    courseTitle: {
      type: String,
      trim: true,
      default: "",
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    relatedModel: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

studentActivitySchema.index({ createdAt: -1 });
studentActivitySchema.index({ student: 1, createdAt: -1 });
studentActivitySchema.index({ category: 1, createdAt: -1 });
studentActivitySchema.index({ level: 1, courseCode: 1, createdAt: -1 });

studentActivitySchema.methods.toAdminObject = function toAdminObject() {
  return {
    id: this._id.toString(),
    studentId: this.student?.toString?.() || String(this.student),
    level: this.level,
    category: this.category,
    type: this.type,
    title: this.title,
    courseCode: this.courseCode || "",
    courseTitle: this.courseTitle || "",
    relatedId: this.relatedId ? this.relatedId.toString() : null,
    relatedModel: this.relatedModel || "",
    metadata: this.metadata || {},
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("StudentActivity", studentActivitySchema);
module.exports.ACTIVITY_CATEGORIES = ACTIVITY_CATEGORIES;
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
