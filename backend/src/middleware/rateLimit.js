/**
 * Lightweight in-memory rate limiter. No extra package required.
 * req.ip is used so spoofed X-Forwarded-For is ignored unless trust proxy is set.
 */

function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();

  function prune(now) {
    if (hits.size < 2500) return;
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    prune(now);
    const ip = String(req.ip || req.socket?.remoteAddress || "unknown")
      .replace(/^::ffff:/, "")
      .slice(0, 120);
    const key = ip || "unknown";
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retrySec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      return res.status(429).json({
        success: false,
        message: message || "Too many requests. Please wait and try again.",
      });
    }

    entry.count += 1;
    return next();
  };
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many sign-in attempts. Please wait a few minutes and try again.",
});

const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: "Too many signup attempts from this network. Please try again later.",
});

const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 12,
  message: "Too many password reset attempts. Please try again later.",
});

const aiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: "The AI assistant is receiving too many requests. Please wait and try again.",
});

module.exports = {
  createRateLimiter,
  authLimiter,
  signupLimiter,
  passwordResetLimiter,
  aiLimiter,
};
