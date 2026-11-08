const multer = require("multer");
const CommunityMessage = require("../models/CommunityMessage");
const CommunityReport = require("../models/CommunityReport");
const CommunityModerationLog = require("../models/CommunityModerationLog");
const Student = require("../models/Student");
const {
  ALLOWED_LEVELS,
  assertAdminCommunityLevel,
} = require("../utils/communityAccess");
const { isSuperAdmin: superAdmin, sendAdminAccessError } = require("../utils/adminAccess");
const {
  saveCommunityFile,
  destroyCloudinaryAsset,
  openCloudinaryReadStream,
} = require("../utils/communityStorage");
const { emitToCommunityLevel } = require("../utils/communityRealtime");
const {
  memberStats,
  listOnlineMembers,
  populateSender,
  MESSAGE_PAGE,
} = require("./communityController");
const {
  MAX_COMMUNITY_PDF_BYTES,
  communityMulterSizeMessage,
} = require("../utils/uploadLimits");
const {
  isDownloadQuery,
  setFileStreamHeaders,
} = require("../utils/fileStreamHeaders");

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COMMUNITY_PDF_BYTES, files: 1 },
});

function runChatUpload(req, res) {
  return new Promise((resolve, reject) => {
    chatUpload.single("file")(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function emitToLevel(req, level, event, payload) {
  emitToCommunityLevel(level, event, payload, req);
}

async function writeModLog({
  admin,
  action,
  level = null,
  targetStudent = null,
  message = null,
  report = null,
  summary,
}) {
  try {
    await CommunityModerationLog.create({
      admin: admin._id,
      adminEmail: admin.email,
      action,
      level,
      targetStudent,
      message,
      report,
      summary,
    });
  } catch (error) {
    console.error("Community moderation log warning:", error.message);
  }
}

function viewerOpts(admin) {
  return { viewerId: admin._id.toString(), viewerKind: "admin" };
}

async function overview(req, res) {
  try {
    const levels = superAdmin(req.admin)
      ? ALLOWED_LEVELS
      : [assertAdminCommunityLevel(req.admin, req.admin.assignedLevel)];

    const cards = [];
    for (const level of levels) {
      const stats = await memberStats(level);
      cards.push({
        level,
        title: `${level} Level`,
        members: stats.members,
        online: stats.online,
        active: stats.online > 0,
      });
    }

    return res.status(200).json({
      success: true,
      isSuperAdmin: superAdmin(req.admin),
      assignedLevel: req.admin.assignedLevel || null,
      cards,
    });
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function getLevelCommunity(req, res) {
  try {
    const level = assertAdminCommunityLevel(req.admin, req.params.level);
    const stats = await memberStats(level);
    const onlineMembers = await listOnlineMembers(level, 80);
    return res.status(200).json({
      success: true,
      community: {
        level,
        title: `${level} Level Community`,
        members: stats.members,
        online: stats.online,
      },
      onlineMembers,
    });
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function listMessages(req, res) {
  try {
    const level = assertAdminCommunityLevel(
      req.admin,
      req.params.level || req.query.level
    );
    const before = String(req.query.before || "").trim();
    const filter = { level };
    if (before) {
      const cursor = await CommunityMessage.findById(before).select("createdAt");
      if (cursor) filter.createdAt = { $lt: cursor.createdAt };
    }
    const rows = await populateSender(
      CommunityMessage.find(filter).sort({ createdAt: -1 }).limit(MESSAGE_PAGE)
    );
    return res.status(200).json({
      success: true,
      level,
      hasMore: rows.length === MESSAGE_PAGE,
      messages: rows
        .reverse()
        .map((row) => row.toPublicObject(viewerOpts(req.admin))),
    });
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function postAnnouncement(req, res) {
  try {
    const level = assertAdminCommunityLevel(
      req.admin,
      req.params.level || req.body?.level
    );
    const text = String(req.body?.text || "").trim().slice(0, 2000);
    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Enter an announcement to post.",
      });
    }
    const message = await CommunityMessage.create({
      level,
      senderKind: "admin",
      admin: req.admin._id,
      senderName: "Admin",
      type: "text",
      text,
    });
    const payload = message.toPublicObject(viewerOpts(req.admin));
    emitToLevel(req, level, "community:message", payload);
    await writeModLog({
      admin: req.admin,
      action: "post_announcement",
      level,
      message: message._id,
      summary: `Posted an announcement in ${level} Level community.`,
    });
    return res.status(201).json({ success: true, message: payload });
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function uploadAnnouncement(req, res) {
  let stored = null;
  try {
    await runChatUpload(req, res);
    const level = assertAdminCommunityLevel(
      req.admin,
      req.params.level || req.body?.level
    );
    if (!req.file?.buffer?.length) {
      return res.status(400).json({
        success: false,
        message: "Choose a PDF or image to share.",
      });
    }
    stored = await saveCommunityFile({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      level,
      ownerSegment: `admin-${req.admin._id.toString()}`,
    });
    const text = String(req.body?.text || "").trim().slice(0, 2000);
    const message = await CommunityMessage.create({
      level,
      senderKind: "admin",
      admin: req.admin._id,
      senderName: "Admin",
      type: stored.kind,
      text,
      attachment: stored,
    });
    const payload = message.toPublicObject(viewerOpts(req.admin));
    emitToLevel(req, level, "community:message", payload);
    await writeModLog({
      admin: req.admin,
      action: "post_announcement",
      level,
      message: message._id,
      summary: `Posted a ${stored.kind} announcement in ${level} Level community.`,
    });
    return res.status(201).json({ success: true, message: payload });
  } catch (error) {
    if (stored?.storagePath) await destroyCloudinaryAsset(stored.storagePath);
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: communityMulterSizeMessage(),
      });
    }
    if (
      error.code === "LIMIT_FILE_SIZE" ||
      error.code === "INVALID_MIME" ||
      error.code === "EMPTY_FILE" ||
      error.code === "CLOUDINARY_NOT_CONFIGURED"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message || "Could not upload that file.",
      });
    }
    return sendAdminAccessError(res, error);
  }
}

async function deleteMessage(req, res) {
  try {
    const message = await CommunityMessage.findById(req.params.id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }
    const level = assertAdminCommunityLevel(req.admin, message.level);
    if (!message.deletedAt) {
      message.deletedAt = new Date();
      message.deletedBy = req.admin._id;
      message.deletedByKind = "admin";
      await message.save();
    }
    const payload = message.toPublicObject(viewerOpts(req.admin));
    emitToLevel(req, level, "community:message:update", payload);
    await writeModLog({
      admin: req.admin,
      action: "delete_message",
      level,
      message: message._id,
      targetStudent: message.student,
      summary: `Deleted a ${level} Level community message.`,
    });
    return res.status(200).json({
      success: true,
      message: "Message removed.",
      item: payload,
    });
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function listReports(req, res) {
  try {
    const requested = String(req.query.level || "").trim();
    const filter = { status: String(req.query.status || "open") };
    if (superAdmin(req.admin)) {
      if (ALLOWED_LEVELS.includes(requested)) filter.level = requested;
    } else {
      filter.level = assertAdminCommunityLevel(req.admin, requested);
    }

    const reports = await CommunityReport.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("reporter", "fullName email level")
      .populate("message");

    return res.status(200).json({
      success: true,
      reports: reports.map((report) => ({
        id: report._id.toString(),
        level: report.level,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
        reporter: report.reporter
          ? {
              id: report.reporter._id.toString(),
              fullName: report.reporter.fullName,
              email: report.reporter.email,
            }
          : null,
        message: report.message
          ? report.message.toPublicObject(viewerOpts(req.admin))
          : null,
      })),
    });
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function reviewReport(req, res) {
  try {
    const report = await CommunityReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found.",
      });
    }
    const level = assertAdminCommunityLevel(req.admin, report.level);
    const status =
      String(req.body?.status || "reviewed") === "dismissed"
        ? "dismissed"
        : "reviewed";
    report.status = status;
    report.reviewedBy = req.admin._id;
    report.reviewedAt = new Date();
    report.reviewNote = String(req.body?.note || "").trim().slice(0, 400);
    await report.save();
    await writeModLog({
      admin: req.admin,
      action: status === "dismissed" ? "dismiss_report" : "review_report",
      level,
      report: report._id,
      message: report.message,
      summary: `${status === "dismissed" ? "Dismissed" : "Reviewed"} a ${level} Level community report.`,
    });
    return res.status(200).json({ success: true, message: "Report updated." });
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function setStudentAccess(req, res) {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }
    const level = assertAdminCommunityLevel(req.admin, student.level);
    const restricted = Boolean(req.body?.restricted);
    student.communityRestricted = restricted;
    student.communityRestrictedAt = restricted ? new Date() : null;
    student.communityRestrictedReason = restricted
      ? String(req.body?.reason || "").trim().slice(0, 400)
      : "";
    student.communityRestrictedBy = restricted ? req.admin._id : null;
    await student.save();
    await writeModLog({
      admin: req.admin,
      action: restricted ? "restrict_student" : "restore_student",
      level,
      targetStudent: student._id,
      summary: restricted
        ? `Restricted ${student.fullName} from the ${level} Level community.`
        : `Restored community access for ${student.fullName}.`,
    });
    emitToLevel(req, level, "community:access", {
      studentId: student._id.toString(),
      restricted,
    });
    return res.status(200).json({
      success: true,
      message: restricted
        ? "Student community access restricted."
        : "Student community access restored.",
      student: {
        id: student._id.toString(),
        fullName: student.fullName,
        level: student.level,
        communityRestricted: student.communityRestricted,
      },
    });
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function searchMessages(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Enter at least 2 characters to search.",
      });
    }
    const filter = { deletedAt: null };
    const requested = String(req.query.level || "").trim();
    if (superAdmin(req.admin)) {
      if (ALLOWED_LEVELS.includes(requested)) filter.level = requested;
    } else {
      filter.level = assertAdminCommunityLevel(req.admin, requested);
    }
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.text = { $regex: safe, $options: "i" };
    const rows = await populateSender(
      CommunityMessage.find(filter).sort({ createdAt: -1 }).limit(50)
    );
    return res.status(200).json({
      success: true,
      messages: rows.map((row) => row.toPublicObject(viewerOpts(req.admin))),
    });
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function listAttachments(req, res) {
  try {
    const level = assertAdminCommunityLevel(
      req.admin,
      req.params.level || req.query.level
    );
    const kind = String(req.query.kind || "").trim();
    const filter = {
      level,
      deletedAt: null,
      attachment: { $exists: true, $ne: null },
    };
    if (kind === "pdf" || kind === "image") filter["attachment.kind"] = kind;
    const rows = await populateSender(
      CommunityMessage.find(filter).sort({ createdAt: -1 }).limit(80)
    );
    return res.status(200).json({
      success: true,
      attachments: rows.map((row) => row.toPublicObject(viewerOpts(req.admin))),
    });
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function streamMessageFile(req, res) {
  try {
    const message = await CommunityMessage.findById(req.params.id);
    if (!message || message.deletedAt || !message.attachment?.storagePath) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found.",
      });
    }
    assertAdminCommunityLevel(req.admin, message.level);
    const filename = message.attachment.originalName || "attachment";
    setFileStreamHeaders(res, {
      mimeType: message.attachment.mimeType,
      filename,
      download: isDownloadQuery(req),
      size: message.attachment.size,
    });
    const stream = await openCloudinaryReadStream(message.attachment.storagePath);
    stream.pipe(res);
    return undefined;
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function streamAvatar(req, res) {
  try {
    const student = await Student.findById(req.params.studentId).select(
      "level avatar"
    );
    if (!student?.avatar?.storagePath) {
      return res.status(404).json({
        success: false,
        message: "Profile picture not found.",
      });
    }
    assertAdminCommunityLevel(req.admin, student.level);
    res.setHeader("Content-Type", student.avatar.mimeType || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=120");
    const stream = await openCloudinaryReadStream(student.avatar.storagePath);
    stream.pipe(res);
    return undefined;
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

async function listModerationLog(req, res) {
  try {
    const filter = {};
    const requested = String(req.query.level || "").trim();
    if (superAdmin(req.admin)) {
      if (ALLOWED_LEVELS.includes(requested)) filter.level = requested;
    } else {
      filter.level = assertAdminCommunityLevel(req.admin, requested);
    }
    const rows = await CommunityModerationLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();
    return res.status(200).json({
      success: true,
      logs: rows.map((row) => ({
        id: String(row._id),
        action: row.action,
        level: row.level,
        summary: row.summary,
        adminEmail: row.adminEmail,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    return sendAdminAccessError(res, error);
  }
}

module.exports = {
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
};
