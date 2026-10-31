const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("./Student");

/**
 * Explicit learning-material completions for progress tracking.
 * One row per student + official NoteResource (topic).
 */
const topicCompletionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NoteResource",
      required: true,
      index: true,
    },
    level: {
      type: String,
      required: true,
      enum: ALLOWED_LEVELS,
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
      trim: true,
      default: "",
    },
    topicTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    completedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

topicCompletionSchema.index({ student: 1, note: 1 }, { unique: true });
topicCompletionSchema.index({ student: 1, courseCode: 1, completedAt: -1 });

topicCompletionSchema.methods.toPublicObject = function toPublicObject() {
  return {
    id: this._id.toString(),
    noteId: this.note?.toString?.() || String(this.note),
    level: this.level,
    courseCode: this.courseCode,
    courseTitle: this.courseTitle || "",
    topicTitle: this.topicTitle,
    completedAt: this.completedAt || this.createdAt,
  };
};

module.exports = mongoose.model("TopicCompletion", topicCompletionSchema);
