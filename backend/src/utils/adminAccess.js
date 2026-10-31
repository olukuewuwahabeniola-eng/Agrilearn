const { ALLOWED_LEVELS } = require("../models/Student");

function isSuperAdmin(admin) {
  if (!admin) return false;
  return admin.role === "super_admin" || admin.role === "admin";
}

function isLevelAdmin(admin) {
  return Boolean(admin && admin.role === "level_admin");
}

function getAssignedLevel(admin) {
  if (!admin || isSuperAdmin(admin)) return null;
  return ALLOWED_LEVELS.includes(admin.assignedLevel)
    ? admin.assignedLevel
    : null;
}

/**
 * Resolve the academic level this request may operate on.
 * Never trusts a client-supplied level for level admins.
 * Super admins may optionally filter by requestedLevel.
 */
function resolveScopedLevel(admin, requestedLevel) {
  const requested = String(requestedLevel || "").trim();
  if (isSuperAdmin(admin)) {
    if (requested && ALLOWED_LEVELS.includes(requested)) return requested;
    return null; // all levels
  }

  const assigned = getAssignedLevel(admin);
  if (!assigned) {
    const error = new Error(
      "This administrator account has no valid assigned level."
    );
    error.code = "ADMIN_LEVEL_INVALID";
    error.status = 403;
    throw error;
  }

  if (requested && requested !== assigned) {
    const error = new Error(
      `You only have access to ${assigned} Level records.`
    );
    error.code = "ADMIN_LEVEL_FORBIDDEN";
    error.status = 403;
    throw error;
  }

  return assigned;
}

/**
 * Apply level scope onto a Mongo filter object (mutates and returns filter).
 */
function applyAdminLevelFilter(admin, filter = {}, requestedLevel) {
  const scoped = resolveScopedLevel(admin, requestedLevel);
  if (scoped) filter.level = scoped;
  return { filter, scopedLevel: scoped };
}

function assertResourceLevel(admin, resourceLevel) {
  if (isSuperAdmin(admin)) return;
  const assigned = getAssignedLevel(admin);
  if (!assigned || String(resourceLevel) !== assigned) {
    const error = new Error(
      "You do not have permission to access records for that academic level."
    );
    error.code = "ADMIN_LEVEL_FORBIDDEN";
    error.status = 403;
    throw error;
  }
}

function requireSuperAdmin(req, res, next) {
  if (!req.admin || !isSuperAdmin(req.admin)) {
    return res.status(403).json({
      success: false,
      message: "Super administrator access required.",
    });
  }
  return next();
}

function sendAdminAccessError(res, error) {
  const status = error.status || 403;
  return res.status(status).json({
    success: false,
    message: error.message || "Access denied.",
  });
}

module.exports = {
  ALLOWED_LEVELS,
  isSuperAdmin,
  isLevelAdmin,
  getAssignedLevel,
  resolveScopedLevel,
  applyAdminLevelFilter,
  assertResourceLevel,
  requireSuperAdmin,
  sendAdminAccessError,
};
