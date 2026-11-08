const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("./Student");

const communityReportSchema = new mongoose.Schema(
  {
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunityMessage",
      required: true,
      index: true,
    },
    reporter: {
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
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },
    status: {
      type: String,
      enum: ["open", "reviewed", "dismissed"],
      default: "open",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "", trim: true, maxlength: 400 },
  },
  { timestamps: true }
);

communityReportSchema.index({ reporter: 1, message: 1 }, { unique: true });

module.exports = mongoose.model("CommunityReport", communityReportSchema);
