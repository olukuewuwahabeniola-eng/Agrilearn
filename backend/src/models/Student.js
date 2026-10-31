const mongoose = require("mongoose");

const ALLOWED_LEVELS = ["100", "200", "300", "500"];

const studentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Full name must be at least 2 characters"],
    },
    email: {
      type: String,
      required: [true, "Student email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email"],
    },
    matricNumber: {
      type: String,
      required: [true, "Matriculation number is required"],
      unique: true,
      trim: true,
      minlength: [4, "Matriculation number looks too short"],
    },
    level: {
      type: String,
      required: [true, "Academic level is required"],
      enum: {
        values: ALLOWED_LEVELS,
        message: "Level must be 100, 200, 300, or 500",
      },
    },
    // select: false keeps the hash out of normal queries
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    loginCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: null,
    },
    /**
     * Admin-controlled flag for testing cleanup.
     * Never auto-set — only an administrator may mark/unmark.
     */
    isTestAccount: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

function sanitizeStudent(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.password;
  delete obj.__v;
  return obj;
}

studentSchema.methods.toSafeObject = function toSafeObject() {
  return sanitizeStudent(this);
};

module.exports = mongoose.model("Student", studentSchema);
module.exports.ALLOWED_LEVELS = ALLOWED_LEVELS;
