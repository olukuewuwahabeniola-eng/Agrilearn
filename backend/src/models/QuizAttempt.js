const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("./Student");

/**
 * Quiz attempts — ready for future student quiz UI.
 * Admin activity API reads from this collection.
 */
const quizAttemptSchema = new mongoose.Schema(
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
    quizTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    score: {
      type: Number,
      min: 0,
      default: null,
    },
    maxScore: {
      type: Number,
      min: 0,
      default: null,
    },
    attemptNumber: {
      type: Number,
      min: 1,
      default: 1,
    },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

quizAttemptSchema.index({ student: 1, courseCode: 1, createdAt: -1 });

quizAttemptSchema.methods.toAdminObject = function toAdminObject() {
  return {
    id: this._id.toString(),
    studentId: this.student?.toString?.() || String(this.student),
    level: this.level,
    courseCode: this.courseCode,
    courseTitle: this.courseTitle || "",
    quizTitle: this.quizTitle,
    score: this.score,
    maxScore: this.maxScore,
    attemptNumber: this.attemptNumber,
    status: this.status,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
