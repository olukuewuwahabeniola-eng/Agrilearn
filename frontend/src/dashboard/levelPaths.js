/** Academic levels collected at signup and stored on the Student account. */
export const ACADEMIC_LEVELS = ["100", "200", "300", "500"];

export function normalizeLevel(level) {
  const value = String(level ?? "").trim();
  return ACADEMIC_LEVELS.includes(value) ? value : null;
}

export function isValidLevel(level) {
  return Boolean(normalizeLevel(level));
}

/** Base path for a student's level dashboard, e.g. /dashboard/500 */
export function getDashboardBasePath(level) {
  const normalized = normalizeLevel(level);
  if (!normalized) return "/dashboard";
  return `/dashboard/${normalized}`;
}

export function isLevelDashboardPath(pathname, level) {
  const base = getDashboardBasePath(level);
  if (!pathname) return false;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * After login (or when opening /dashboard), send the student to their
 * level dashboard. Keep deep links only when they already match that level.
 */
export function resolvePostLoginPath(fromPath, level) {
  const base = getDashboardBasePath(level);
  if (!normalizeLevel(level)) return "/login";

  if (fromPath && isLevelDashboardPath(fromPath, level)) {
    return fromPath;
  }

  // Legacy bookmarks like /dashboard/courses → /dashboard/{level}/courses
  if (fromPath && fromPath.startsWith("/dashboard")) {
    const rest = fromPath.slice("/dashboard".length) || "";
    if (!rest || rest === "/") return base;
    if (/^\/(100|200|300|500)(\/|$)/.test(rest)) return base;
    return `${base}${rest}`;
  }

  return base;
}
