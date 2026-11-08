const bcrypt = require("bcryptjs");
const Student = require("../models/Student");
const Admin = require("../models/Admin");
const { sendPasswordResetEmail } = require("../utils/mailer");
const {
  GENERIC_RESET_REQUEST_MESSAGE,
  generateResetToken,
  hashResetToken,
  resetExpiryDate,
  evaluateResetToken,
  resetFailureMessage,
  isValidEmail,
  normalizeEmail,
  assertRequestRateLimit,
  assertConsumeRateLimit,
  validateStudentResetPassword,
  validateAdminPassword,
  buildStudentResetUrl,
  buildAdminResetUrl,
} = require("../utils/passwordReset");

const RESET_SELECT =
  "+password +passwordResetTokenHash +passwordResetExpiresAt +passwordResetRequestedAt";

function genericRequestOk(res) {
  return res.status(200).json({
    success: true,
    message: GENERIC_RESET_REQUEST_MESSAGE,
  });
}

async function issueReset({ user, audience, buildUrl }) {
  const { token, hash } = generateResetToken();
  user.passwordResetTokenHash = hash;
  user.passwordResetExpiresAt = resetExpiryDate();
  user.passwordResetRequestedAt = new Date();
  await user.save();
  await sendPasswordResetEmail({
    to: user.email,
    name: user.fullName,
    resetUrl: buildUrl(token),
    audience,
  });
}

async function requestStudentReset(req, res) {
  const email = normalizeEmail(req.body?.email);
  if (!assertRequestRateLimit(req, "student", email)) {
    return res.status(429).json({
      success: false,
      message: "Please wait before requesting another reset link.",
    });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address.",
    });
  }

  try {
    const student = await Student.findOne({ email }).select(RESET_SELECT);
    if (student) {
      try {
        await issueReset({
          user: student,
          audience: "student",
          buildUrl: buildStudentResetUrl,
        });
      } catch (error) {
        console.error("Student password reset email failed:", error.message);
      }
    }
  } catch (error) {
    console.error("Student forgot password error:", error.message);
  }

  return genericRequestOk(res);
}

async function studentResetStatus(req, res) {
  const token = String(req.query?.token || "").trim();
  if (!assertConsumeRateLimit(req, "student")) {
    return res.status(429).json({
      success: false,
      valid: false,
      message: "Please wait before trying again.",
    });
  }
  try {
    const student = token
      ? await Student.findOne({
          passwordResetTokenHash: hashResetToken(token),
        }).select(RESET_SELECT)
      : null;
    const check = evaluateResetToken(student, token);
    if (!check.ok) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: resetFailureMessage(check.reason),
      });
    }
    return res.status(200).json({ success: true, valid: true });
  } catch (error) {
    console.error("Student reset status error:", error.message);
    return res.status(500).json({
      success: false,
      valid: false,
      message: "Could not check that reset link.",
    });
  }
}

async function resetStudentPassword(req, res) {
  if (!assertConsumeRateLimit(req, "student")) {
    return res.status(429).json({
      success: false,
      message: "Please wait before trying again.",
    });
  }

  const token = String(req.body?.token || "").trim();
  const passwordCheck = validateStudentResetPassword(
    req.body?.password,
    req.body?.confirmPassword
  );
  if (!passwordCheck.ok) {
    return res.status(400).json({
      success: false,
      message: passwordCheck.message,
    });
  }

  try {
    const student = await Student.findOne({
      passwordResetTokenHash: hashResetToken(token),
    }).select(RESET_SELECT);

    const check = evaluateResetToken(student, token);
    if (!check.ok) {
      if (student && check.reason === "expired") {
        student.passwordResetTokenHash = null;
        student.passwordResetExpiresAt = null;
        await student.save();
      }
      return res.status(400).json({
        success: false,
        message: resetFailureMessage(check.reason),
      });
    }

    const previousLevel = student.level;
    student.password = await bcrypt.hash(String(req.body.password), 12);
    student.passwordResetTokenHash = null;
    student.passwordResetExpiresAt = null;
    await student.save();

    if (student.level !== previousLevel) {
      student.level = previousLevel;
      await student.save();
    }

    return res.status(200).json({
      success: true,
      message: "Password updated. You can now log in with your new password.",
      loginPath: "/login",
    });
  } catch (error) {
    console.error("Student reset password error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not reset that password. Please try again.",
    });
  }
}

function adminEligibleForReset(admin) {
  if (!admin) return false;
  if (admin.isActive === false) return false;
  if (admin.invitePending) return false;
  return true;
}

async function requestAdminReset(req, res) {
  const email = normalizeEmail(req.body?.email);
  if (!assertRequestRateLimit(req, "admin", email)) {
    return res.status(429).json({
      success: false,
      message: "Please wait before requesting another reset link.",
    });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address.",
    });
  }

  try {
    const admin = await Admin.findOne({ email }).select(
      `${RESET_SELECT} +inviteTokenHash`
    );
    if (adminEligibleForReset(admin)) {
      try {
        await issueReset({
          user: admin,
          audience: "admin",
          buildUrl: buildAdminResetUrl,
        });
      } catch (error) {
        console.error("Admin password reset email failed:", error.message);
      }
    }
  } catch (error) {
    console.error("Admin forgot password error:", error.message);
  }

  return genericRequestOk(res);
}

async function adminResetStatus(req, res) {
  const token = String(req.query?.token || "").trim();
  if (!assertConsumeRateLimit(req, "admin")) {
    return res.status(429).json({
      success: false,
      valid: false,
      message: "Please wait before trying again.",
    });
  }
  try {
    const admin = token
      ? await Admin.findOne({
          passwordResetTokenHash: hashResetToken(token),
        }).select(RESET_SELECT)
      : null;
    const check = evaluateResetToken(admin, token);
    if (!check.ok) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: resetFailureMessage(check.reason),
      });
    }
    return res.status(200).json({ success: true, valid: true });
  } catch (error) {
    console.error("Admin reset status error:", error.message);
    return res.status(500).json({
      success: false,
      valid: false,
      message: "Could not check that reset link.",
    });
  }
}

async function resetAdminPassword(req, res) {
  if (!assertConsumeRateLimit(req, "admin")) {
    return res.status(429).json({
      success: false,
      message: "Please wait before trying again.",
    });
  }

  const token = String(req.body?.token || "").trim();
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

  try {
    const admin = await Admin.findOne({
      passwordResetTokenHash: hashResetToken(token),
    }).select(`${RESET_SELECT} +inviteTokenHash`);

    const check = evaluateResetToken(admin, token);
    if (!check.ok) {
      if (admin && check.reason === "expired") {
        admin.passwordResetTokenHash = null;
        admin.passwordResetExpiresAt = null;
        await admin.save();
      }
      return res.status(400).json({
        success: false,
        message: resetFailureMessage(check.reason),
      });
    }

    if (!adminEligibleForReset(admin)) {
      return res.status(400).json({
        success: false,
        message: resetFailureMessage("invalid"),
      });
    }

    const previousRole = admin.role;
    const previousLevel = admin.assignedLevel;
    const previousActive = admin.isActive;

    admin.password = await bcrypt.hash(String(req.body.password), 12);
    admin.passwordResetTokenHash = null;
    admin.passwordResetExpiresAt = null;
    admin.mustChangePassword = false;
    await admin.save();

    if (
      admin.role !== previousRole ||
      admin.assignedLevel !== previousLevel ||
      admin.isActive !== previousActive
    ) {
      admin.role = previousRole;
      admin.assignedLevel = previousLevel;
      admin.isActive = previousActive;
      await admin.save();
    }

    return res.status(200).json({
      success: true,
      message: "Password updated. You can now sign in with your new password.",
      loginPath: "/admin/login",
    });
  } catch (error) {
    console.error("Admin reset password error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not reset that password. Please try again.",
    });
  }
}

module.exports = {
  requestStudentReset,
  studentResetStatus,
  resetStudentPassword,
  requestAdminReset,
  adminResetStatus,
  resetAdminPassword,
};
