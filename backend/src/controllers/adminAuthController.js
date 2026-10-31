const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const {
  setAdminAuthCookie,
  clearAdminAuthCookie,
} = require("../utils/adminSession");
const { isSuperAdmin } = require("../utils/adminAccess");
const {
  validateAdminPassword,
  hashInviteToken,
} = require("../utils/adminPassword");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createAdminToken(admin) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing from backend/.env");
  }

  const normalizedRole = isSuperAdmin(admin) ? "super_admin" : admin.role;

  return jwt.sign(
    {
      id: admin._id,
      email: admin.email,
      // Keep role:"admin" for backward-compatible middleware checks on old clients.
      role: "admin",
      adminRole: normalizedRole,
      assignedLevel: admin.assignedLevel || null,
      typ: "admin",
    },
    secret,
    { expiresIn: "7d" }
  );
}

/**
 * POST /api/admin/auth/login
 */
async function login(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !EMAIL_PATTERN.test(email) || !password) {
      return res.status(400).json({
        success: false,
        message: "Enter your admin email and password.",
      });
    }

    const admin = await Admin.findOne({ email }).select(
      "+password +inviteTokenHash"
    );
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (admin.isActive === false) {
      return res.status(403).json({
        success: false,
        message:
          "This administrator account has been deactivated. Contact the Super Admin.",
      });
    }

    if (admin.invitePending || admin.inviteTokenHash) {
      return res.status(403).json({
        success: false,
        message:
          "This account is waiting for invitation setup. Open your invitation link to create a password, then sign in here.",
      });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (admin.role === "admin") {
      admin.role = "super_admin";
      admin.assignedLevel = null;
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = createAdminToken(admin);
    setAdminAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Admin login successful.",
      token,
      admin: admin.toSafeObject(),
    });
  } catch (error) {
    console.error("Admin login error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not log in right now. Please try again.",
    });
  }
}

/**
 * GET /api/admin/auth/me
 */
async function me(req, res) {
  return res.status(200).json({
    success: true,
    admin: req.admin.toSafeObject(),
  });
}

/**
 * POST /api/admin/auth/logout
 */
async function logout(req, res) {
  clearAdminAuthCookie(res);
  return res.status(200).json({
    success: true,
    message: "Admin signed out.",
  });
}

/**
 * GET /api/admin/auth/invite-status?token=
 * Validates an invitation without consuming it.
 */
async function inviteStatus(req, res) {
  try {
    const token = String(req.query?.token || "").trim();
    if (!token) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "This invite link is missing a token.",
      });
    }

    const tokenHash = hashInviteToken(token);
    const admin = await Admin.findOne({ inviteTokenHash: tokenHash }).select(
      "+inviteTokenHash +inviteExpiresAt"
    );

    if (!admin) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "This invite link is invalid or has already been used.",
      });
    }
    if (admin.isActive === false) {
      return res.status(403).json({
        success: false,
        valid: false,
        message: "This administrator account has been deactivated.",
      });
    }
    if (!admin.inviteExpiresAt || admin.inviteExpiresAt.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "This invite link has expired. Ask the Super Admin for a new one.",
      });
    }
    if (admin.role !== "level_admin") {
      return res.status(403).json({
        success: false,
        valid: false,
        message: "This invitation is not valid for administrator setup.",
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      invite: {
        fullName: admin.fullName,
        email: admin.email,
        assignedLevel: admin.assignedLevel,
        expiresAt: admin.inviteExpiresAt,
      },
    });
  } catch (error) {
    console.error("Invite status error:", error.message);
    return res.status(500).json({
      success: false,
      valid: false,
      message: "Could not validate invitation.",
    });
  }
}

/**
 * POST /api/admin/auth/accept-invite
 * Body: { token, password, confirmPassword }
 * Completes Level Admin password setup. Does not auto-login — use /admin/login.
 */
async function acceptInvite(req, res) {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid invite token.",
      });
    }

    const passwordCheck = validateAdminPassword(password, confirmPassword);
    if (!passwordCheck.ok) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message,
      });
    }

    const tokenHash = hashInviteToken(token);
    const admin = await Admin.findOne({ inviteTokenHash: tokenHash }).select(
      "+password +inviteTokenHash +inviteExpiresAt"
    );

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "This invite link is invalid or has already been used.",
      });
    }
    if (admin.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "This administrator account has been deactivated.",
      });
    }
    if (!admin.inviteExpiresAt || admin.inviteExpiresAt.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: "This invite link has expired. Ask the Super Admin for a new one.",
      });
    }
    if (admin.role !== "level_admin") {
      return res.status(403).json({
        success: false,
        message: "Invitation links cannot activate Super Admin accounts.",
      });
    }

    admin.password = await bcrypt.hash(password, 12);
    admin.inviteTokenHash = null;
    admin.inviteExpiresAt = null;
    admin.invitePending = false;
    admin.mustChangePassword = false;
    await admin.save();

    clearAdminAuthCookie(res);

    return res.status(200).json({
      success: true,
      message:
        "Password created successfully. Sign in with your email and new password.",
      loginPath: "/admin/login",
      admin: {
        email: admin.email,
        fullName: admin.fullName,
        assignedLevel: admin.assignedLevel,
        role: "level_admin",
      },
    });
  } catch (error) {
    console.error("Accept invite error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not complete invite setup.",
    });
  }
}

module.exports = {
  login,
  me,
  logout,
  inviteStatus,
  acceptInvite,
  createAdminToken,
};
