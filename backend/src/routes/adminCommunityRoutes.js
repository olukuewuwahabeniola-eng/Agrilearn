const express = require("express");
const {
  overview,
  getLevelCommunity,
  listMessages,
  postAnnouncement,
  uploadAnnouncement,
  deleteMessage,
  listReports,
  reviewReport,
  setStudentAccess,
  searchMessages,
  listAttachments,
  streamMessageFile,
  streamAvatar,
  listModerationLog,
} = require("../controllers/adminCommunityController");

const router = express.Router();

router.get("/overview", overview);
router.get("/search", searchMessages);
router.get("/reports", listReports);
router.patch("/reports/:id", reviewReport);
router.get("/moderation-log", listModerationLog);
router.get("/messages/:id/file", streamMessageFile);
router.delete("/messages/:id", deleteMessage);
router.patch("/students/:studentId/access", setStudentAccess);
router.get("/avatars/:studentId", streamAvatar);
router.get("/:level", getLevelCommunity);
router.get("/:level/messages", listMessages);
router.post("/:level/messages", postAnnouncement);
router.post("/:level/messages/upload", uploadAnnouncement);
router.get("/:level/attachments", listAttachments);

module.exports = router;
