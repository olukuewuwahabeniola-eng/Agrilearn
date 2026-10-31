/**
 * Shared admin password validation and invite helpers.
 */

const crypto = require("crypto");

const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

function validateAdminPassword(password, confirmPassword) {
  const value = String(password || "");
  const confirm = String(confirmPassword || "");

  if (value.length < 8) {
    return {
      ok: false,
      message: "Password must be at least 8 characters.",
    };
  }
  if (value.length > 128) {
    return {
      ok: false,
      message: "Password must be at most 128 characters.",
    };
  }
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return {
      ok: false,
      message: "Password must include at least one letter and one number.",
    };
  }
  if (confirm !== value) {
    return {
      ok: false,
      message: "Passwords do not match.",
    };
  }
  return { ok: true };
}

function generateInviteToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

function hashInviteToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

/** Unusable placeholder so schema password required is satisfied until invite is accepted. */
function generateUnusablePasswordPlain() {
  return `pending.${crypto.randomBytes(24).toString("hex")}`;
}

/**
 * Prefer PUBLIC_APP_URL (deployed site), else first CLIENT_URL entry.
 */
function getPublicAppBaseUrl() {
  const preferred = String(process.env.PUBLIC_APP_URL || "").trim();
  const fallback = String(
    process.env.CLIENT_URL || "http://localhost:5173"
  ).trim();
  const raw = preferred || fallback;
  return raw.split(",")[0].trim().replace(/\/$/, "");
}

function buildInviteUrl(token) {
  return `${getPublicAppBaseUrl()}/admin/accept-invite?token=${encodeURIComponent(token)}`;
}

function inviteExpiryDate(from = Date.now()) {
  return new Date(from + INVITE_TTL_MS);
}

module.exports = {
  INVITE_TTL_MS,
  validateAdminPassword,
  generateInviteToken,
  hashInviteToken,
  generateUnusablePasswordPlain,
  getPublicAppBaseUrl,
  buildInviteUrl,
  inviteExpiryDate,
};
