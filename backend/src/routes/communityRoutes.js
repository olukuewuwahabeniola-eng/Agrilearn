const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { requireDb } = require("../middleware/requireDb");
const {
  getCommunity,
  listMessages,
  postMessage,
  uploadMessageFile,
  streamMessageFile,
  searchMessages,
  reportMessage,
  streamAvatar,
  uploadAvatar,
} = require("../controllers/communityController");

const router = express.Router();

router.use(requireDb, protect);

router.get("/", getCommunity);
router.get("/messages", listMessages);
router.post("/messages", postMessage);
router.post("/messages/upload", uploadMessageFile);
router.get("/messages/:id/file", streamMessageFile);
router.get("/search", searchMessages);
router.post("/messages/:id/report", reportMessage);
router.get("/avatars/:studentId", streamAvatar);
router.post("/avatar", uploadAvatar);

module.exports = router;
