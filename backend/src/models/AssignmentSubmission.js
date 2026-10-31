const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("./Student");

/**
 * Student assignment submissions — scaffold for future dashboard integration.
 */
const assignmentSubmissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
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
    status: {
      type: String,
      enum: ["pending", "submitted", "reviewed"],
      default: "submitted",
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
  },
  { timestamps: true }
);

assignmentSubmissionSchema.index({ student: 1, assignment: 1 }, { unique: true });

assignmentSubmissionSchema.methods.toAdminObject = function toAdminObject() {
  return {
    id: this._id.toString(),
    assignmentId: this.assignment?.toString?.() || String(this.assignment),
    studentId: this.student?.toString?.() || String(this.student),
    level: this.level,
    courseCode: this.courseCode,
    status: this.status,
    submittedAt: this.submittedAt,
    reviewedAt: this.reviewedAt,
    notes: this.notes || "",
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);
