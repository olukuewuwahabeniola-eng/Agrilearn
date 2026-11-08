const express = require("express");
const {
  overview,
  listStudents,
  getStudent,
  listCourses,
  listNotes,
  uploadNote,
  streamNoteFile,
  updateProfile,
} = require("../controllers/adminController");
const adminActivityRoutes = require("./adminActivityRoutes");
const adminDataManagementRoutes = require("./adminDataManagementRoutes");
const adminAdministratorsRoutes = require("./adminAdministratorsRoutes");
const adminCommunityRoutes = require("./adminCommunityRoutes");
const {
  listPastQuestions,
  createPastQuestion,
  updatePastQuestion,
  replacePastQuestionFiles,
  deletePastQuestion,
  streamPastQuestionFile,
} = require("../controllers/adminPastQuestionController");
const { protectAdmin } = require("../middleware/adminAuthMiddleware");
const { requireDb } = require("../middleware/requireDb");
const { requireSuperAdmin } = require("../utils/adminAccess");
const adminAuthRoutes = require("./adminAuthRoutes");

const router = express.Router();

// Auth (login is public; me is protected inside adminAuthRoutes)
router.use("/auth", adminAuthRoutes);

// Everything below requires an authenticated administrator
router.use(requireDb, protectAdmin);

router.get("/overview", overview);
router.get("/students", listStudents);
router.get("/students/:id", getStudent);
router.get("/courses", listCourses);
router.get("/notes", listNotes);
router.post("/notes", uploadNote);
router.get("/notes/:id/files/:fileIndex/file", streamNoteFile);
router.get("/past-questions", listPastQuestions);
router.post("/past-questions", createPastQuestion);
router.patch("/past-questions/:id", updatePastQuestion);
router.put("/past-questions/:id/files", replacePastQuestionFiles);
router.delete("/past-questions/:id", deletePastQuestion);
router.get(
  "/past-questions/:id/files/:fileIndex/file",
  streamPastQuestionFile
);
router.use("/activity", adminActivityRoutes);
router.use("/community", adminCommunityRoutes);
router.use("/data-management", requireSuperAdmin, adminDataManagementRoutes);
router.use("/administrators", adminAdministratorsRoutes);
router.patch("/profile", updateProfile);

module.exports = router;
