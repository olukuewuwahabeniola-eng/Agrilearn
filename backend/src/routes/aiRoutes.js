const express = require("express");
const { assist } = require("../controllers/aiController");
const {
  listConversations,
  getConversation,
  deleteConversation,
} = require("../controllers/conversationController");
const { protect } = require("../middleware/authMiddleware");
const { requireDb } = require("../middleware/requireDb");
const { aiLimiter } = require("../middleware/rateLimit");

const router = express.Router();

// Conversation history — authenticated student only (own chats)
router.get("/conversations", requireDb, protect, listConversations);
router.get("/conversations/:id", requireDb, protect, getConversation);
router.delete("/conversations/:id", requireDb, protect, deleteConversation);

// POST /api/ai/assist — authenticated students only (Gemini free tier)
router.post("/assist", requireDb, protect, aiLimiter, assist);

module.exports = router;
