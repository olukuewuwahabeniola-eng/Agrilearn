const multer = require("multer");
const CommunityMessage = require("../models/CommunityMessage");
const CommunityReport = require("../models/CommunityReport");
const Student = require("../models/Student");
const {
  assertStudentCommunityLevel,
  assertStudentCanPost,
  assertStudentCanRead,
  communityAccessError,
} = require("../utils/communityAccess");
const {
  saveCommunityFile,
  saveAvatarFile,
  destroyCloudinaryAsset,
  openCloudinaryReadStream,
  classifyChatFile,
} = require("../utils/communityStorage");
const { onlineStudentIdsForLevel } = require("../utils/communityPresence");
const { emitToCommunityLevel } = require("../utils/communityRealtime");
const {
  MAX_COMMUNITY_PDF_BYTES,
  MAX_COMMUNITY_AVATAR_BYTES,
  communityMulterSizeMessage,
  communityAvatarMulterSizeMessage,
} = require("../utils/uploadLimits");
const { touchStudentLastActive } = require("../utils/activityTracker");
const {
  isDownloadQuery,
  setFileStreamHeaders,
} = require("../utils/fileStreamHeaders");

const MESSAGE_PAGE = 30;

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COMMUNITY_PDF_BYTES, files: 1 },
});

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COMMUNITY_AVATAR_BYTES, files: 1 },
});

function runChatUpload(req, res) {
  return new Promise((resolve, reject) => {
    chatUpload.single("file")(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function runAvatarUpload(req, res) {
  return new Promise((resolve, reject) => {
    avatarUpload.single("file")(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function emitToLevel(req, level, event, payload) {
  emitToCommunityLevel(level, event, payload, req);
}

function populateSender(query) {
  return query.populate("student", "fullName avatar.storagePath level");
}

async function memberStats(level) {
  const [members, onlineIds] = await Promise.all([
    Student.countDocuments({ level }),
    Promise.resolve(onlineStudentIdsForLevel(level)),
  ]);
  return {
    members,
    online: onlineIds.length,
  };
}

async function listOnlineMembers(level, limit = 40) {
  const ids = onlineStudentIdsForLevel(level).slice(0, limit);
  if (!ids.length) return [];
  const students = await Student.find({ _id: { $in: ids }, level })
    .select("fullName avatar.storagePath")
    .lean();
  const order = new Map(ids.map((id, index) => [id, index]));
  return students
    .sort(
      (a, b) =>
        (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0)
    )
    .map((student) => ({
      id: String(student._id),
      fullName: student.fullName,
      hasAvatar: Boolean(student.avatar?.storagePath),
      online: true,
    }));
}

/**
 * GET /api/community
 */
async function getCommunity(req, res) {
  try {
    const level = assertStudentCommunityLevel(req.student, req.query.level);
    await touchStudentLastActive(req.student._id);
    const stats = await memberStats(level);
    const onlineMembers = await listOnlineMembers(level);
    return res.status(200).json({
      success: true,
      community: {
        level,
        title: `${level} Level Community`,
        description: `Chat with other ${level}-level students`,
        members: stats.members,
        online: stats.online,
        restricted: Boolean(req.student.communityRestricted),
      },
      onlineMembers,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Could not load the community.",
    });
  }
}

/**
 * GET /api/community/messages
 */
async function listMessages(req, res) {
  try {
    const level = assertStudentCanRead(req.student, req.query.level);
    const before = String(req.query.before || "").trim();
    const filter = { level };
    if (before) {
      const cursor = await CommunityMessage.findById(before).select("createdAt");
      if (cursor) filter.createdAt = { $lt: cursor.createdAt };
    }

    const rows = await populateSender(
      CommunityMessage.find(filter).sort({ createdAt: -1 }).limit(MESSAGE_PAGE)
    );
    const messages = rows
      .reverse()
      .map((row) =>
        row.toPublicObject({
          viewerId: req.student._id.toString(),
          viewerKind: "student",
        })
      );

    return res.status(200).json({
      success: true,
      level,
      hasMore: rows.length === MESSAGE_PAGE,
      messages,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Could not load messages.",
    });
  }
}

async function persistStudentMessage(req, { text, attachment }) {
  const level = assertStudentCanPost(req.student);
  const trimmed = String(text || "").trim().slice(0, 2000);
  if (!trimmed && !attachment) {
    throw communityAccessError("Type a message or attach a file.", 400, "EMPTY_MESSAGE");
  }

  const type = attachment?.kind || "text";
  const message = await CommunityMessage.create({
    level,
    senderKind: "student",
    student: req.student._id,
    senderName: req.student.fullName,
    type,
    text: trimmed,
    attachment: attachment || undefined,
  });
  message.student = req.student;
  return message.toPublicObject({
    viewerId: req.student._id.toString(),
    viewerKind: "student",
  });
}

/**
 * POST /api/community/messages
 */
async function postMessage(req, res) {
  try {
    const payload = await persistStudentMessage(req, {
      text: req.body?.text,
      attachment: null,
    });
    emitToLevel(req, payload.level, "community:message", payload);
    return res.status(201).json({ success: true, message: payload });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Could not send the message.",
    });
  }
}

/**
 * POST /api/community/messages/upload
 */
async function uploadMessageFile(req, res) {
  let stored = null;
  try {
    await runChatUpload(req, res);
    const level = assertStudentCanPost(req.student);
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
      ownerSegment: req.student._id.toString(),
    });
    const payload = await persistStudentMessage(req, {
      text: req.body?.text,
      attachment: stored,
    });
    emitToLevel(req, payload.level, "community:message", payload);
    return res.status(201).json({ success: true, message: payload });
  } catch (error) {
    if (stored?.storagePath) {
      await destroyCloudinaryAsset(stored.storagePath);
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: communityMulterSizeMessage(),
      });
    }
    const status =
      error.status ||
      (error.code === "INVALID_MIME" ||
      error.code === "LIMIT_FILE_SIZE" ||
      error.code === "EMPTY_FILE" ||
      error.code === "CLOUDINARY_NOT_CONFIGURED"
        ? 400
        : 500);
    return res.status(status).json({
      success: false,
      message: error.message || "Could not upload that file.",
    });
  }
}

async function streamMessageFile(req, res) {
  try {
    const level = assertStudentCanRead(req.student);
    const message = await CommunityMessage.findById(req.params.id);
    if (!message || message.level !== level || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found.",
      });
    }
    if (!message.attachment?.storagePath) {
      return res.status(404).json({
        success: false,
        message: "That message has no file.",
      });
    }

    const filename = message.attachment.originalName || "attachment";
    const download = isDownloadQuery(req);
    setFileStreamHeaders(res, {
      mimeType: message.attachment.mimeType,
      filename,
      download,
      size: message.attachment.size,
    });
    const stream = await openCloudinaryReadStream(message.attachment.storagePath);
    stream.on("error", (err) => {
      console.error("Community file stream error:", err.message);
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: "File is missing." });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
    return undefined;
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Could not open that file.",
    });
  }
}

async function searchMessages(req, res) {
  try {
    const level = assertStudentCanRead(req.student, req.query.level);
    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Enter at least 2 characters to search.",
      });
    }
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rows = await populateSender(
      CommunityMessage.find({
        level,
        deletedAt: null,
        text: { $regex: safe, $options: "i" },
      })
        .sort({ createdAt: -1 })
        .limit(40)
    );
    return res.status(200).json({
      success: true,
      messages: rows.map((row) =>
        row.toPublicObject({
          viewerId: req.student._id.toString(),
          viewerKind: "student",
        })
      ),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Could not search messages.",
    });
  }
}

async function reportMessage(req, res) {
  try {
    const level = assertStudentCanRead(req.student);
    const message = await CommunityMessage.findById(req.params.id);
    if (!message || message.level !== level || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }
    const reason = String(req.body?.reason || "Inappropriate").trim().slice(0, 400);
    const report = await CommunityReport.findOneAndUpdate(
      { message: message._id, reporter: req.student._id },
      { $setOnInsert: { level, reason, status: "open" } },
      { upsert: true, new: true }
    );
    return res.status(201).json({
      success: true,
      message: "Message reported. Administrators will review it.",
      reportId: report._id.toString(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({
        success: true,
        message: "You have already reported this message.",
      });
    }
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Could not report that message.",
    });
  }
}

async function streamAvatar(req, res) {
  try {
    const viewerLevel = assertStudentCommunityLevel(req.student);
    const student = await Student.findById(req.params.studentId).select(
      "level avatar"
    );
    if (!student || student.level !== viewerLevel) {
      return res.status(404).json({
        success: false,
        message: "Profile picture not found.",
      });
    }
    if (!student.avatar?.storagePath) {
      return res.status(404).json({
        success: false,
        message: "No profile picture uploaded.",
      });
    }
    res.setHeader("Content-Type", student.avatar.mimeType || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=120");
    const stream = await openCloudinaryReadStream(student.avatar.storagePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: "Picture missing." });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
    return undefined;
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Could not load profile picture.",
    });
  }
}

async function uploadAvatar(req, res) {
  let stored = null;
  try {
    await runAvatarUpload(req, res);
    if (!req.file?.buffer?.length) {
      return res.status(400).json({
        success: false,
        message: "Choose an image for your profile picture.",
      });
    }
    if (classifyChatFile(req.file.mimetype) !== "image") {
      return res.status(400).json({
        success: false,
        message: "Profile pictures must be JPG, JPEG, PNG, or WEBP.",
      });
    }
    stored = await saveAvatarFile({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      studentId: req.student._id.toString(),
    });
    const previous = req.student.avatar?.storagePath;
    req.student.avatar = {
      storagePath: stored.storagePath,
      mimeType: stored.mimeType,
      originalName: stored.originalName,
      size: stored.size,
    };
    await req.student.save();
    if (previous && previous !== stored.storagePath) {
      await destroyCloudinaryAsset(previous);
    }
    return res.status(200).json({
      success: true,
      message: "Profile picture updated.",
      student: req.student.toSafeObject(),
    });
  } catch (error) {
    if (stored?.storagePath) await destroyCloudinaryAsset(stored.storagePath);
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: communityAvatarMulterSizeMessage(),
      });
    }
    return res.status(error.status || 400).json({
      success: false,
      message: error.message || "Could not update your profile picture.",
    });
  }
}

module.exports = {
  getCommunity,
  listMessages,
  postMessage,
  uploadMessageFile,
  streamMessageFile,
  searchMessages,
  reportMessage,
  streamAvatar,
  uploadAvatar,
  memberStats,
  listOnlineMembers,
  populateSender,
  MESSAGE_PAGE,
};
