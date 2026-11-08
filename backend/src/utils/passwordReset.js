const crypto = require("crypto");
const { getPublicAppBaseUrl, validateAdminPassword } = require("./adminPassword");

const RESET_TTL_MS = 30 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 8;
const MAX_REQUESTS_PER_EMAIL = 3;
const MAX_CONSUME_PER_IP = 20;

const GENERIC_RESET_REQUEST_MESSAGE =
  "If that email is registered with AgriLearn, we sent a password reset link. Check your inbox and spam folder.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const rateHits = new Map();

function generateResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = hashResetToken(token);
  return { token, hash };
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function resetExpiryDate(from = Date.now()) {
  return new Date(from + RESET_TTL_MS);
}

function hashesMatch(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function evaluateResetToken(record, token) {
  const raw = String(token || "").trim();
  if (!raw || raw.length < 32) {
    return { ok: false, reason: "invalid" };
  }
  if (!record?.passwordResetTokenHash) {
    return { ok: false, reason: "invalid" };
  }
  if (!hashesMatch(record.passwordResetTokenHash, hashResetToken(raw))) {
    return { ok: false, reason: "invalid" };
  }
  const expiresAt = record.passwordResetExpiresAt
    ? new Date(record.passwordResetExpiresAt).getTime()
    : 0;
  if (!expiresAt || expiresAt <= Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

function resetFailureMessage(reason) {
  if (reason === "expired") {
    return "This reset link has expired. Request a new one.";
  }
  return "This reset link is invalid or has already been used.";
}

function takeRateLimit(key, max, windowMs = RATE_WINDOW_MS) {
  const now = Date.now();
  const entry = rateHits.get(key);
  if (!entry || entry.resetAt <= now) {
    rateHits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1 };
  }
  if (entry.count >= max) {
    return { ok: false, retryAt: entry.resetAt };
  }
  entry.count += 1;
  return { ok: true, remaining: max - entry.count };
}

function clientIp(req) {
  return (
    String(req?.ip || req?.socket?.remoteAddress || "unknown")
      .replace(/^::ffff:/, "")
      .split(",")[0]
      .trim()
      .slice(0, 120) || "unknown"
  );
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

function assertRequestRateLimit(req, kind, email) {
  const ip = clientIp(req);
  const ipLimit = takeRateLimit(`${kind}-reset-ip:${ip}`, MAX_REQUESTS_PER_IP);
  const emailLimit = takeRateLimit(
    `${kind}-reset-email:${normalizeEmail(email) || "empty"}`,
    MAX_REQUESTS_PER_EMAIL
  );
  return ipLimit.ok && emailLimit.ok;
}

function assertConsumeRateLimit(req, kind) {
  return takeRateLimit(`${kind}-reset-use:${clientIp(req)}`, MAX_CONSUME_PER_IP).ok;
}

function validateStudentResetPassword(password, confirmPassword) {
  const value = String(password || "");
  const confirm = String(confirmPassword || "");
  if (value.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (value.length > 128) {
    return { ok: false, message: "Password must be at most 128 characters." };
  }
  if (confirm !== value) {
    return { ok: false, message: "Passwords do not match." };
  }
  return { ok: true };
}

function buildStudentResetUrl(token) {
  return `${getPublicAppBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

function buildAdminResetUrl(token) {
  return `${getPublicAppBaseUrl()}/admin/reset-password?token=${encodeURIComponent(token)}`;
}

function clearRateLimitStore() {
  rateHits.clear();
}

module.exports = {
  RESET_TTL_MS,
  RATE_WINDOW_MS,
  MAX_REQUESTS_PER_IP,
  MAX_REQUESTS_PER_EMAIL,
  MAX_CONSUME_PER_IP,
  GENERIC_RESET_REQUEST_MESSAGE,
  generateResetToken,
  hashResetToken,
  resetExpiryDate,
  evaluateResetToken,
  resetFailureMessage,
  takeRateLimit,
  clientIp,
  normalizeEmail,
  isValidEmail,
  assertRequestRateLimit,
  assertConsumeRateLimit,
  validateStudentResetPassword,
  validateAdminPassword,
  buildStudentResetUrl,
  buildAdminResetUrl,
  clearRateLimitStore,
};
