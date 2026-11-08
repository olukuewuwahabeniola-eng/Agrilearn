const express = require("express");
const {
  login,
  me,
  logout,
  inviteStatus,
  acceptInvite,
} = require("../controllers/adminAuthController");
const {
  requestAdminReset,
  adminResetStatus,
  resetAdminPassword,
} = require("../controllers/passwordResetController");
const { protectAdmin } = require("../middleware/adminAuthMiddleware");
const { requireDb } = require("../middleware/requireDb");
const {
  authLimiter,
  passwordResetLimiter,
} = require("../middleware/rateLimit");

const router = express.Router();

router.post("/login", authLimiter, requireDb, login);
router.post("/logout", logout);
router.get("/invite-status", requireDb, inviteStatus);
router.post("/accept-invite", passwordResetLimiter, requireDb, acceptInvite);
router.post("/forgot-password", passwordResetLimiter, requireDb, requestAdminReset);
router.get("/reset-status", requireDb, adminResetStatus);
router.post("/reset-password", passwordResetLimiter, requireDb, resetAdminPassword);
router.get("/me", requireDb, protectAdmin, me);

module.exports = router;
