const mongoose = require("mongoose");
const PastQuestion = require("../models/PastQuestion");
const { findCourseForStudent } = require("../data/coursesByLevel");
const { openStoredReadStream } = require("../utils/pastQuestionStorage");
const { logPastQuestionAccessIfNeeded } = require("../utils/activityTracker");

function buildStudentFilter(req, student) {
  const filter = {
    published: true,
    level: student.level,
  };

  const courseCode = String(req.query.courseCode || "").trim().toUpperCase();
  const examYear = String(req.query.examYear || "").trim();
  const q = String(req.query.q || "").trim();

  if (courseCode) {
    const course = findCourseForStudent(student.level, courseCode);
    if (!course) {
      const error = new Error(
        "That course is not available for your academic level."
      );
      error.code = "COURSE_FORBIDDEN";
      throw error;
    }
    filter.courseCode = course.code;
  }

  if (examYear) {
    const year = parseInt(examYear, 10);
    if (Number.isFinite(year)) filter.examYear = year;
  }

  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safe, "i");
    filter.$or = [{ courseCode: regex }, { description: regex }];
  }

  return filter;
}

/**
 * GET /api/past-questions
 */
async function listPastQuestions(req, res) {
  try {
    const filter = buildStudentFilter(req, req.student);
    const items = await PastQuestion.find(filter)
      .sort({ examYear: -1, courseCode: 1, createdAt: -1 })
      .limit(300);

    return res.status(200).json({
      success: true,
      level: req.student.level,
      count: items.length,
      pastQuestions: items.map((item) => item.toPublicObject()),
    });
  } catch (error) {
    if (error.code === "COURSE_FORBIDDEN") {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    console.error("List past questions error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load past questions.",
    });
  }
}

/**
 * GET /api/past-questions/:id
 */
async function getPastQuestion(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid past question id.",
      });
    }

    const doc = await PastQuestion.findOne({
      _id: req.params.id,
      published: true,
      level: req.student.level,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Past question not found or not available for your level.",
      });
    }

    await logPastQuestionAccessIfNeeded(req.student, doc, { download: false });

    return res.status(200).json({
      success: true,
      pastQuestion: doc.toPublicObject(),
    });
  } catch (error) {
    console.error("Get past question error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load past question.",
    });
  }
}

/**
 * GET /api/past-questions/:id/files/:fileIndex/file
 */
async function streamPastQuestionFile(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid past question id.",
      });
    }

    const doc = await PastQuestion.findOne({
      _id: req.params.id,
      published: true,
      level: req.student.level,
    });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Past question not found or not available.",
      });
    }

    const fileIndex = parseInt(String(req.params.fileIndex || "0"), 10);
    const sorted = [...doc.files].sort(
      (a, b) => (a.pageOrder ?? 0) - (b.pageOrder ?? 0)
    );
    const file = sorted[fileIndex];
    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found.",
      });
    }

    const disposition =
      req.query.download === "1" ? "attachment" : "inline";

    await logPastQuestionAccessIfNeeded(req.student, doc, {
      download: disposition === "attachment",
    });

    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${encodeURIComponent(file.originalName || "file")}"`
    );
    if (file.size) res.setHeader("Content-Length", String(file.size));

    const stream = await openStoredReadStream(file.storagePath);
    stream.on("error", (err) => {
      console.error("Past question stream error:", err.message);
      if (!res.headersSent) {
        res.status(404).json({
          success: false,
          message: "File is missing on the server.",
        });
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Past question file error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not open file.",
    });
  }
}

module.exports = {
  listPastQuestions,
  getPastQuestion,
  streamPastQuestionFile,
};
