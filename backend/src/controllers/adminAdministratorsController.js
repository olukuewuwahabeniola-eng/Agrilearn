const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const { ALLOWED_LEVELS, isSuperAdmin } = require("../utils/adminAccess");
const {
  validateAdminPassword,
  generateInviteToken,
  generateUnusablePasswordPlain,
  buildInviteUrl,
  inviteExpiryDate,
} = require("../utils/adminPassword");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/admin/administrators
 */
async function listAdministrators(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    const role = String(req.query.role || "").trim();
    const level = String(req.query.level || "").trim();
    const filter = {};

    if (role === "super_admin" || role === "level_admin") {
      if (role === "super_admin") {
        filter.role = { $in: ["super_admin", "admin"] };
      } else {
        filter.role = "level_admin";
      }
    }
    if (level && ALLOWED_LEVELS.includes(level)) {
      filter.assignedLevel = level;
    }
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filter.$or = [{ fullName: regex }, { email: regex }];
    }

    const admins = await Admin.find(filter).sort({ createdAt: -1 }).limit(200);

    return res.status(200).json({
      success: true,
      count: admins.length,
      administrators: admins.map((a) => a.toSafeObject()),
    });
  } catch (error) {
    console.error("List administrators error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load administrators.",
    });
  }
}

/**
 * POST /api/admin/administrators
 * Body:
 *  - setupMethod: 'invite' | 'manual_password'
 *  - for manual_password: password, confirmPassword
 */
async function createAdministrator(req, res) {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const assignedLevel = String(req.body?.assignedLevel || "").trim();
    let setupMethod = String(req.body?.setupMethod || "invite").trim();

    // Legacy alias from earlier UI
    if (setupMethod === "temp_password") setupMethod = "manual_password";

    if (fullName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Enter the administrator's full name.",
      });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }
    if (!ALLOWED_LEVELS.includes(assignedLevel)) {
      return res.status(400).json({
        success: false,
        message: "Assign exactly one academic level: 100, 200, 300, or 500.",
      });
    }
    if (setupMethod !== "invite" && setupMethod !== "manual_password") {
      return res.status(400).json({
        success: false,
        message: "Choose Generate Invitation Link or Set Password Manually.",
      });
    }

    // Never allow creating Super Admins through this endpoint.
    if (req.body?.role && req.body.role !== "level_admin") {
      return res.status(403).json({
        success: false,
        message: "Only Level Admin accounts can be created here.",
      });
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An administrator with this email already exists.",
      });
    }

    if (setupMethod === "invite") {
      const generated = generateInviteToken();
      const inviteExpiresAt = inviteExpiryDate();
      const placeholder = generateUnusablePasswordPlain();
      const hashed = await bcrypt.hash(placeholder, 12);

      const admin = await Admin.create({
        fullName,
        email,
        password: hashed,
        role: "level_admin",
        assignedLevel,
        isActive: true,
        invitePending: true,
        mustChangePassword: false,
        inviteTokenHash: generated.hash,
        inviteExpiresAt,
      });

      const inviteUrl = buildInviteUrl(generated.token);

      return res.status(201).json({
        success: true,
        message: "Invitation created. Share the link so they can set a password.",
        administrator: admin.toSafeObject(),
        credentials: {
          email,
          setupMethod: "invite",
          inviteUrl,
          inviteExpiresAt,
          note: "Copy and share this invitation link (WhatsApp, email, etc.). It expires in 48 hours and can be used once.",
        },
      });
    }

    // manual_password
    const passwordCheck = validateAdminPassword(
      req.body?.password,
      req.body?.confirmPassword
    );
    if (!passwordCheck.ok) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message,
      });
    }

    const hashed = await bcrypt.hash(String(req.body.password), 12);
    const admin = await Admin.create({
      fullName,
      email,
      password: hashed,
      role: "level_admin",
      assignedLevel,
      isActive: true,
      invitePending: false,
      mustChangePassword: false,
      inviteTokenHash: null,
      inviteExpiresAt: null,
    });

    return res.status(201).json({
      success: true,
      message:
        "Level administrator created. Share their email and password securely. The password is not stored in plain text and cannot be retrieved again.",
      administrator: admin.toSafeObject(),
      credentials: {
        email,
        setupMethod: "manual_password",
        // Never return the password.
        note: "Share the login email and the password you set through a private channel. AgriLearn cannot show that password again.",
      },
    });
  } catch (error) {
    console.error("Create administrator error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not create administrator.",
    });
  }
}

/**
 * PATCH /api/admin/administrators/:id
 */
async function updateAdministrator(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid administrator id.",
      });
    }

    const target = await Admin.findById(req.params.id);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Administrator not found.",
      });
    }

    const isSelf = String(target._id) === String(req.admin._id);
    const targetIsSuper = isSuperAdmin(target);

    if (targetIsSuper && !isSelf) {
      if (
        req.body?.role === "level_admin" ||
        req.body?.isActive === false ||
        req.body?.assignedLevel
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Other Super Admin accounts cannot be demoted or deactivated here.",
        });
      }
    }

    if (isSelf) {
      if (
        req.body?.role &&
        req.body.role !== "super_admin" &&
        req.body.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot change your own Super Admin role.",
        });
      }
      if (req.body?.isActive === false) {
        return res.status(403).json({
          success: false,
          message: "You cannot deactivate your own account.",
        });
      }
      if (req.body?.assignedLevel) {
        return res.status(403).json({
          success: false,
          message: "Super Admins are not assigned to a single level.",
        });
      }
    }

    if (typeof req.body?.fullName === "string") {
      const name = req.body.fullName.trim();
      if (name.length >= 2) target.fullName = name;
    }

    if (!targetIsSuper || isSelf === false) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "isActive")) {
        if (targetIsSuper) {
          return res.status(403).json({
            success: false,
            message: "Super Admin accounts cannot be deactivated.",
          });
        }
        target.isActive = Boolean(req.body.isActive);
      }

      if (req.body?.assignedLevel !== undefined && !targetIsSuper) {
        const level = String(req.body.assignedLevel || "").trim();
        if (!ALLOWED_LEVELS.includes(level)) {
          return res.status(400).json({
            success: false,
            message: "Assigned level must be 100, 200, 300, or 500.",
          });
        }
        target.assignedLevel = level;
        target.role = "level_admin";
      }
    }

    await target.save();

    return res.status(200).json({
      success: true,
      message: "Administrator updated.",
      administrator: target.toSafeObject(),
    });
  } catch (error) {
    console.error("Update administrator error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not update administrator.",
    });
  }
}

/**
 * POST /api/admin/administrators/:id/reset-access
 * Re-issue invite or set a new password manually (never returns password).
 */
async function resetAdministratorAccess(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid administrator id.",
      });
    }

    const target = await Admin.findById(req.params.id).select(
      "+password +inviteTokenHash"
    );
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Administrator not found.",
      });
    }
    if (isSuperAdmin(target)) {
      return res.status(403).json({
        success: false,
        message: "Use profile settings to change the Super Admin password.",
      });
    }

    let setupMethod = String(req.body?.setupMethod || "invite").trim();
    if (setupMethod === "temp_password") setupMethod = "manual_password";

    if (setupMethod === "invite") {
      const generated = generateInviteToken();
      const inviteExpiresAt = inviteExpiryDate();
      target.inviteTokenHash = generated.hash;
      target.inviteExpiresAt = inviteExpiresAt;
      target.invitePending = true;
      target.mustChangePassword = false;
      target.password = await bcrypt.hash(generateUnusablePasswordPlain(), 12);
      await target.save();

      return res.status(200).json({
        success: true,
        message: "New invitation link generated.",
        credentials: {
          email: target.email,
          setupMethod: "invite",
          inviteUrl: buildInviteUrl(generated.token),
          inviteExpiresAt,
          note: "Share this new invitation link. Previous invite links for this account no longer work.",
        },
      });
    }

    if (setupMethod === "manual_password") {
      const passwordCheck = validateAdminPassword(
        req.body?.password,
        req.body?.confirmPassword
      );
      if (!passwordCheck.ok) {
        return res.status(400).json({
          success: false,
          message: passwordCheck.message,
        });
      }

      target.password = await bcrypt.hash(String(req.body.password), 12);
      target.inviteTokenHash = null;
      target.inviteExpiresAt = null;
      target.invitePending = false;
      target.mustChangePassword = false;
      await target.save();

      return res.status(200).json({
        success: true,
        message:
          "Password updated. Share the new password securely; it cannot be retrieved again.",
        credentials: {
          email: target.email,
          setupMethod: "manual_password",
          note: "The password was hashed and is not returned by the API.",
        },
      });
    }

    return res.status(400).json({
      success: false,
      message: "Choose invite or manual_password.",
    });
  } catch (error) {
    console.error("Reset administrator access error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not reset administrator access.",
    });
  }
}

/**
 * DELETE /api/admin/administrators/:id
 */
async function deleteAdministrator(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid administrator id.",
      });
    }

    const target = await Admin.findById(req.params.id);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "Administrator not found.",
      });
    }

    if (String(target._id) === String(req.admin._id)) {
      return res.status(403).json({
        success: false,
        message: "You cannot remove your own Super Admin account.",
      });
    }

    if (isSuperAdmin(target)) {
      return res.status(403).json({
        success: false,
        message: "Super Admin accounts cannot be removed.",
      });
    }

    await target.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Level administrator removed.",
      id: req.params.id,
    });
  } catch (error) {
    console.error("Delete administrator error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not remove administrator.",
    });
  }
}

module.exports = {
  listAdministrators,
  createAdministrator,
  updateAdministrator,
  resetAdministratorAccess,
  deleteAdministrator,
};
