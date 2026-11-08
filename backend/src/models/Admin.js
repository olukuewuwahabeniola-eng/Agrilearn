const mongoose = require("mongoose");
const { ALLOWED_LEVELS } = require("./Student");

/**
 * Platform administrators (AgriLearn owners/staff).
 * Separate from Student — never creatable via public signup.
 *
 * Roles:
 * - super_admin: full platform access (legacy role "admin" is treated the same)
 * - level_admin: scoped to exactly one academic level
 */
const ADMIN_ROLES = ["super_admin", "level_admin", "admin"];

const adminSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Full name must be at least 2 characters"],
    },
    email: {
      type: String,
      required: [true, "Admin email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ADMIN_ROLES,
      default: "super_admin",
      index: true,
    },
    /** Required for level_admin; null/undefined for super_admin */
    assignedLevel: {
      type: String,
      default: null,
      index: true,
      validate: {
        validator(value) {
          if (value == null || value === "") return true;
          return ALLOWED_LEVELS.includes(value);
        },
        message: "Assigned level must be 100, 200, 300, or 500.",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    /** One-time invite / password-setup token hash */
    inviteTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    inviteExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    /** True until the invitee sets a password via the invitation link */
    invitePending: {
      type: Boolean,
      default: false,
      index: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    passwordResetRequestedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

adminSchema.pre("validate", function validateLevelRole() {
  const role = this.role === "admin" ? "super_admin" : this.role;
  if (role === "level_admin") {
    if (!ALLOWED_LEVELS.includes(this.assignedLevel)) {
      this.invalidate(
        "assignedLevel",
        "Level administrators must be assigned to 100, 200, 300, or 500."
      );
    }
  } else {
    this.assignedLevel = null;
  }
});

function sanitizeAdmin(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.password;
  delete obj.__v;
  delete obj.inviteTokenHash;
  delete obj.passwordResetTokenHash;
  delete obj.passwordResetExpiresAt;
  delete obj.passwordResetRequestedAt;
  // Normalize legacy role for API consumers
  if (obj.role === "admin") obj.role = "super_admin";
  obj.isSuperAdmin = obj.role === "super_admin";
  obj.isLevelAdmin = obj.role === "level_admin";
  obj.invitePending = Boolean(obj.invitePending);
  if (obj.isActive === false) {
    obj.accountStatus = "inactive";
  } else if (obj.invitePending) {
    obj.accountStatus = "pending_invite";
  } else {
    obj.accountStatus = "active";
  }
  return obj;
}

adminSchema.methods.toSafeObject = function toSafeObject() {
  return sanitizeAdmin(this);
};

adminSchema.methods.isSuperAdminUser = function isSuperAdminUser() {
  return this.role === "super_admin" || this.role === "admin";
};

module.exports = mongoose.model("Admin", adminSchema);
module.exports.ADMIN_ROLES = ADMIN_ROLES;
module.exports.ALLOWED_ADMIN_LEVELS = ALLOWED_LEVELS;
