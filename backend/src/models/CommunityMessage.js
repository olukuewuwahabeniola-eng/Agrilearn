const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("./Student");

const attachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true, trim: true },
    storagePath: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 1 },
    kind: { type: String, enum: ["pdf", "image"], required: true },
  },
  { _id: false }
);

const communityMessageSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      required: true,
      enum: ALLOWED_LEVELS,
      index: true,
    },
    senderKind: {
      type: String,
      enum: ["student", "admin"],
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
      index: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    type: {
      type: String,
      enum: ["text", "image", "pdf"],
      default: "text",
      index: true,
    },
    text: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    attachment: {
      type: attachmentSchema,
      default: undefined,
    },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    deletedByKind: {
      type: String,
      enum: ["student", "admin", null],
      default: null,
    },
  },
  { timestamps: true }
);

communityMessageSchema.index({ level: 1, createdAt: -1 });

function refId(value) {
  if (!value) return null;
  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
}

communityMessageSchema.methods.toPublicObject = function toPublicObject({
  viewerId = null,
  viewerKind = "student",
} = {}) {
  const deleted = Boolean(this.deletedAt);
  const studentId = refId(this.student);
  const adminId = refId(this.admin);
  const mine =
    viewerKind === "student"
      ? Boolean(viewerId && studentId && viewerId === studentId)
      : Boolean(viewerId && adminId && viewerId === adminId && this.senderKind === "admin");

  return {
    id: this._id.toString(),
    level: this.level,
    type: this.type,
    text: deleted ? "" : this.text || "",
    createdAt: this.createdAt,
    senderKind: this.senderKind,
    senderName: this.senderKind === "admin" ? "Admin" : this.senderName,
    senderId: this.senderKind === "student" ? studentId : adminId,
    hasAvatar: Boolean(this.student?.avatar?.storagePath),
    mine,
    deleted,
    attachment:
      deleted || !this.attachment
        ? null
        : {
            originalName: this.attachment.originalName,
            mimeType: this.attachment.mimeType,
            size: this.attachment.size,
            kind: this.attachment.kind,
          },
  };
};

module.exports = mongoose.model("CommunityMessage", communityMessageSchema);
