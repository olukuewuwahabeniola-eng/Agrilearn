/**
 * Admin session helpers — HTTP-only cookie + JWT (same secret as student auth).
 * Cookie name is admin-specific so student sessions are unaffected.
 */

const ADMIN_COOKIE = "agrilearn_admin_token";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function getAdminTokenFromRequest(req) {
  const header = req.headers.authorization || "";
  const [scheme, bearer] = header.split(" ");
  if (scheme === "Bearer" && bearer) {
    return bearer.trim();
  }

  const cookies = parseCookies(req.headers.cookie);
  const fromCookie = cookies[ADMIN_COOKIE];
  return fromCookie ? String(fromCookie).trim() : "";
}

function setAdminAuthCookie(res, token) {
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${Math.floor(SEVEN_DAYS_MS / 1000)}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isProduction()) {
    parts.push("Secure");
  }
  res.append("Set-Cookie", parts.join("; "));
}

function clearAdminAuthCookie(res) {
  const parts = [
    `${ADMIN_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isProduction()) {
    parts.push("Secure");
  }
  res.append("Set-Cookie", parts.join("; "));
}

module.exports = {
  ADMIN_COOKIE,
  getAdminTokenFromRequest,
  setAdminAuthCookie,
  clearAdminAuthCookie,
};
