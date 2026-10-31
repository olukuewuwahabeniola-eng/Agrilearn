const express = require("express");
const {
  listResources,
  previewResourceDeletion,
  exportResources,
  deleteResources,
  listManagedStudents,
  setStudentTestFlag,
  previewStudentDeletion,
  exportStudents,
  deleteTestStudents,
  activityStats,
  previewActivityClear,
  exportActivity,
  clearActivity,
  listAuditLogs,
} = require("../controllers/adminDataManagementController");

const router = express.Router();

router.get("/resources", listResources);
router.post("/resources/preview", previewResourceDeletion);
router.post("/resources/export", exportResources);
router.post("/resources/delete", deleteResources);

router.get("/students", listManagedStudents);
router.patch("/students/:id/test-flag", setStudentTestFlag);
router.post("/students/preview", previewStudentDeletion);
router.post("/students/export", exportStudents);
router.post("/students/delete", deleteTestStudents);

router.get("/activity/stats", activityStats);
router.post("/activity/preview", previewActivityClear);
router.post("/activity/export", exportActivity);
router.post("/activity/clear", clearActivity);

router.get("/audit", listAuditLogs);

module.exports = router;
