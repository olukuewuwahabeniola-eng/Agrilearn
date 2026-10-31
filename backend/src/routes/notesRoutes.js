const express = require("express");
const {
  listNotes,
  uploadNote,
  getNote,
  downloadNoteFile,
  deleteNote,
} = require("../controllers/notesController");
const { protect } = require("../middleware/authMiddleware");
const { requireDb } = require("../middleware/requireDb");

const router = express.Router();

// All notes routes require DB + authenticated student (level gated in controller)
router.get("/", requireDb, protect, listNotes);
router.post("/", requireDb, protect, uploadNote);
router.get("/:id", requireDb, protect, getNote);
router.get("/:id/file", requireDb, protect, downloadNoteFile);
router.delete("/:id", requireDb, protect, deleteNote);

module.exports = router;
