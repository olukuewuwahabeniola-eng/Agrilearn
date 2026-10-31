const { getDbStatus } = require("../config/db");

/**
 * Health check controller
 * Confirms the API server is running and reports DB status honestly.
 */
function getHealth(req, res) {
  const database = getDbStatus();

  res.status(200).json({
    success: true,
    message: "AgriLearn backend is running",
    database,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  getHealth,
};
