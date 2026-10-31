const express = require("express");
const {
  activityOverview,
  listRecentActivity,
  listLoginActivity,
  listMaterialActivity,
  listAiActivity,
  listQuizActivity,
  listUploadActivity,
  listAssignmentActivity,
  listPlatformActivity,
} = require("../controllers/adminActivityController");

const router = express.Router();

router.get("/overview", activityOverview);
router.get("/recent", listRecentActivity);
router.get("/logins", listLoginActivity);
router.get("/materials", listMaterialActivity);
router.get("/ai", listAiActivity);
router.get("/quizzes", listQuizActivity);
router.get("/uploads", listUploadActivity);
router.get("/assignments", listAssignmentActivity);
router.get("/platform", listPlatformActivity);

// Backward compatibility with earlier admin activity endpoint
router.get("/", listRecentActivity);

module.exports = router;
