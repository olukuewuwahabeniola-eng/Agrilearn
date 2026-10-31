const { isDbConnected, attemptReconnect } = require("../config/db");

/**
 * Block API handlers that need MongoDB when disconnected.
 * Triggers a background reconnect; returns 503 instead of hanging queries.
 */
function requireDb(req, res, next) {
  if (isDbConnected()) {
    return next();
  }

  attemptReconnect().catch(() => {});

  return res.status(503).json({
    success: false,
    message:
      "Database is temporarily unavailable. If you use MongoDB Atlas, allow your IP under Network Access (or use local MongoDB via docker compose). The server will keep trying to reconnect.",
    database: "disconnected",
  });
}

module.exports = {
  requireDb,
};
