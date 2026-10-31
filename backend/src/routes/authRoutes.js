const express = require("express");
const { signup, login, me } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { requireDb } = require("../middleware/requireDb");

const router = express.Router();

// POST /api/auth/signup
router.post("/signup", requireDb, signup);

// POST /api/auth/login
router.post("/login", requireDb, login);

// GET /api/auth/me — current logged-in student (protected)
router.get("/me", requireDb, protect, me);

module.exports = router;
