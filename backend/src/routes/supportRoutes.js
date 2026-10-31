const express = require("express");
const { createSupportMessage } = require("../controllers/supportController");
const { protect } = require("../middleware/authMiddleware");
const { requireDb } = require("../middleware/requireDb");

const router = express.Router();

// POST /api/support — authenticated students only
router.post("/", requireDb, protect, createSupportMessage);

module.exports = router;
