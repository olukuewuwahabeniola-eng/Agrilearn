const { getDbStatus } = require("../config/db");
const { cloudinaryCredentialStatus } = require("../utils/cloudinary");

/**
 * Health check controller
 * Confirms the API server is running and reports DB status honestly.
 * Cloudinary presence only — never returns credential values.
 */
function getHealth(req, res) {
  const database = getDbStatus();
  const cloudinary = cloudinaryCredentialStatus();

  res.status(200).json({
    success: true,
    message: "AgriLearn backend is running",
    database,
    fileStorage: {
      provider: "cloudinary",
      configured: Boolean(
        cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret
      ),
      cloudName: cloudinary.cloudName,
      apiKey: cloudinary.apiKey,
      apiSecret: cloudinary.apiSecret,
    },
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  getHealth,
};
