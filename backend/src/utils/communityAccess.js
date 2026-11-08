const { ALLOWED_LEVELS } = require("../models/Student");
const {
  isSuperAdmin,
  resolveScopedLevel,
} = require("./adminAccess");

function communityAccessError(message, status = 403, code = "COMMUNITY_FORBIDDEN") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function studentOwnLevel(student) {
  const level = String(student?.level || "").trim();
  if (!ALLOWED_LEVELS.includes(level)) {
    throw communityAccessError(
      "Your academic level is not assigned to a community.",
      403,
      "COMMUNITY_LEVEL_INVALID"
    );
  }
  return level;
}

/**
 * Students may only ever access their authenticated account level.
 * A client-supplied level is rejected unless it matches that account.
 */
function assertStudentCommunityLevel(student, requestedLevel) {
  const own = studentOwnLevel(student);
  const requested = String(requestedLevel || "").trim();
  if (requested && requested !== own) {
    throw communityAccessError(
      "You can only access your own level community."
    );
  }
  return own;
}

function assertStudentCanPost(student) {
  return assertStudentCanRead(student);
}

function assertStudentCanRead(student, requestedLevel) {
  const level = assertStudentCommunityLevel(student, requestedLevel);
  if (student.communityRestricted) {
    throw communityAccessError(
      "Your community access has been restricted. Contact an administrator."
    );
  }
  return level;
}

function assertAdminCommunityLevel(admin, requestedLevel) {
  const requested = String(requestedLevel || "").trim();
  if (isSuperAdmin(admin)) {
    if (!ALLOWED_LEVELS.includes(requested)) {
      throw communityAccessError(
        "Select a valid academic level (100, 200, 300, or 500).",
        400,
        "COMMUNITY_LEVEL_REQUIRED"
      );
    }
    return requested;
  }
  const scoped = resolveScopedLevel(admin, requested || undefined);
  if (!scoped) {
    throw communityAccessError(
      "You only have access to your assigned academic level."
    );
  }
  return scoped;
}

function adminCanAccessLevel(admin, level) {
  try {
    assertAdminCommunityLevel(admin, level);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  ALLOWED_LEVELS,
  communityAccessError,
  studentOwnLevel,
  assertStudentCommunityLevel,
  assertStudentCanPost,
  assertStudentCanRead,
  assertAdminCommunityLevel,
  adminCanAccessLevel,
};
