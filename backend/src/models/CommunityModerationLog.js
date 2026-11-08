const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("./Student");

const communityModerationLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    adminEmail: { type: String, required: true, trim: true, lowercase: true },
    action: {
      type: String,
      required: true,
      enum: [
        "delete_message",
        "restrict_student",
        "restore_student",
        "review_report",
        "dismiss_report",
        "post_announcement",
      ],
      index: true,
    },
    level: {
      type: String,
      enum: [...ALLOWED_LEVELS, null],
      default: null,
      index: true,
    },
    targetStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunityMessage",
      default: null,
    },
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunityReport",
      default: null,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

communityModerationLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model(
  "CommunityModerationLog",
  communityModerationLogSchema
);
