const express = require("express");
const { signup, login, me } = require("../controllers/authController");
const {
  requestStudentReset,
  studentResetStatus,
  resetStudentPassword,
} = require("../controllers/passwordResetController");
const { protect } = require("../middleware/authMiddleware");
const { requireDb } = require("../middleware/requireDb");
const {
  authLimiter,
  signupLimiter,
  passwordResetLimiter,
} = require("../middleware/rateLimit");

const router = express.Router();

// POST /api/auth/signup
router.post("/signup", signupLimiter, requireDb, signup);

// POST /api/auth/login
router.post("/login", authLimiter, requireDb, login);

router.post("/forgot-password", passwordResetLimiter, requireDb, requestStudentReset);
router.get("/reset-status", requireDb, studentResetStatus);
router.post("/reset-password", passwordResetLimiter, requireDb, resetStudentPassword);

// GET /api/auth/me — current logged-in student (protected)
router.get("/me", requireDb, protect, me);

module.exports = router;
