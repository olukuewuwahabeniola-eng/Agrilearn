const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("./Student");

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "bot"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: [50000, "Message is too long"],
    },
    action: {
      type: String,
      enum: ["ask", "summarise", "quiz"],
      required: false,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/**
 * Persistent AgriLearn AI chat per authenticated student.
 * Students can only access their own documents (enforced in controllers).
 */
const aiConversationSchema = new mongoose.Schema(
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
      enum: {
        values: ALLOWED_LEVELS,
        message: "Level must be 100, 200, 300, or 500",
      },
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, "Title is too long"],
      default: "New conversation",
    },
    courseCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    courseTitle: {
      type: String,
      trim: true,
      default: "",
    },
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NoteResource",
      default: null,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

aiConversationSchema.index({ student: 1, updatedAt: -1 });

function makeTitleFromQuestion(text) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^please\s+/i, "")
    .trim();
  if (!cleaned) return "New conversation";
  if (cleaned.length <= 72) return cleaned;
  return `${cleaned.slice(0, 69).trim()}…`;
}

aiConversationSchema.statics.makeTitleFromQuestion = makeTitleFromQuestion;

aiConversationSchema.methods.toListItem = function toListItem() {
  return {
    id: this._id.toString(),
    title: this.title,
    level: this.level,
    courseCode: this.courseCode || "",
    courseTitle: this.courseTitle || "",
    updatedAt: this.updatedAt,
    createdAt: this.createdAt,
    messageCount: Array.isArray(this.messages) ? this.messages.length : 0,
    preview: (() => {
      const lastUser = [...(this.messages || [])]
        .reverse()
        .find((m) => m.role === "user");
      if (!lastUser?.text) return "";
      const t = String(lastUser.text).replace(/\s+/g, " ").trim();
      return t.length > 100 ? `${t.slice(0, 97)}…` : t;
    })(),
  };
};

aiConversationSchema.methods.toDetailObject = function toDetailObject() {
  return {
    id: this._id.toString(),
    title: this.title,
    level: this.level,
    courseCode: this.courseCode || "",
    courseTitle: this.courseTitle || "",
    noteId: this.noteId ? this.noteId.toString() : null,
    updatedAt: this.updatedAt,
    createdAt: this.createdAt,
    messages: (this.messages || []).map((m) => ({
      role: m.role,
      text: m.text,
      action: m.action || null,
      createdAt: m.createdAt,
    })),
  };
};

module.exports = mongoose.model("AiConversation", aiConversationSchema);
