const express = require("express");
const {
  getOverview,
  getProgress,
  getActivity,
  recordCourseAccess,
  completeTopic,
  completeQuiz,
  listQuizAttempts,
} = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");
const { requireDb } = require("../middleware/requireDb");

const router = express.Router();

router.use(requireDb, protect);

router.get("/overview", getOverview);
router.get("/progress", getProgress);
router.get("/activity", getActivity);
router.get("/quizzes", listQuizAttempts);
router.post("/course-access", recordCourseAccess);
router.post("/topics/:noteId/complete", completeTopic);
router.post("/quizzes/complete", completeQuiz);

module.exports = router;
