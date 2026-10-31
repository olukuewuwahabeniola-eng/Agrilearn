const express = require("express");
const {
  login,
  me,
  logout,
  inviteStatus,
  acceptInvite,
} = require("../controllers/adminAuthController");
const { protectAdmin } = require("../middleware/adminAuthMiddleware");
const { requireDb } = require("../middleware/requireDb");

const router = express.Router();

router.post("/login", requireDb, login);
router.post("/logout", logout);
router.get("/invite-status", requireDb, inviteStatus);
router.post("/accept-invite", requireDb, acceptInvite);
router.get("/me", requireDb, protectAdmin, me);

module.exports = router;
