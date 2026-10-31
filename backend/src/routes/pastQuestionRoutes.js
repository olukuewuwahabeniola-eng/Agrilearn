const express = require("express");
const {
  listPastQuestions,
  getPastQuestion,
  streamPastQuestionFile,
} = require("../controllers/pastQuestionController");
const { protect } = require("../middleware/authMiddleware");
const { requireDb } = require("../middleware/requireDb");

const router = express.Router();

router.get("/", requireDb, protect, listPastQuestions);
router.get("/:id/files/:fileIndex/file", requireDb, protect, streamPastQuestionFile);
router.get("/:id", requireDb, protect, getPastQuestion);

module.exports = router;
