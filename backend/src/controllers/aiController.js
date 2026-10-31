const multer = require("multer");
const NoteResource = require("../models/NoteResource");
const { studentCanAccessNote } = require("../utils/noteAccess");
const AiConversation = require("../models/AiConversation");
const { findOwnedConversation } = require("./conversationController");
const { findCourseForStudent } = require("../data/coursesByLevel");
const {
  generateAgriLearnReply,
  getGeminiModelId,
  isGeminiConfigured,
  sanitizeGeminiMessage,
} = require("../utils/gemini");
const {
  MAX_PDF_BYTES,
  hashBuffer,
  savePdfBuffer,
  readStoredPdf,
} = require("../utils/noteStorage");
const { pdfTooLargeMessage } = require("../utils/uploadLimits");
const {
  logAiInteraction,
  logMaterialViewIfNeeded,
  recordPersonalUpload,
} = require("../utils/activityTracker");

const ALLOWED_ACTIONS = ["ask", "summarise", "quiz"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF files are allowed."));
  },
});

const pdfUpload = upload.single("pdf");

function runPdfUpload(req, res) {
  return new Promise((resolve, reject) => {
    pdfUpload(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function formatHistoryForPrompt(messages, limit = 8) {
  if (!Array.isArray(messages) || !messages.length) return "";
  const recent = messages.slice(-limit);
  const lines = recent.map((m) => {
    const who = m.role === "user" ? "Student" : "Assistant";
    const text = String(m.text || "").slice(0, 1200);
    return `${who}: ${text}`;
  });
  return (
    `\nPrior conversation (for continuity — answer the latest request):\n` +
    `${lines.join("\n")}\n`
  );
}

function buildPrompt({
  action,
  question,
  student,
  course,
  pdfName,
  historyMessages,
}) {
  const level = student.level;
  const courseLine = course
    ? `Selected course: ${course.code} — ${course.title} (${level} Level).`
    : `No specific course selected. Student is ${level} Level.`;
  const pdfLine = pdfName
    ? `Attached lecture PDF: ${pdfName}.`
    : "No lecture PDF attached.";
  const historyBlock = formatHistoryForPrompt(historyMessages);

  const base =
    `Student name: ${student.fullName || "Student"}.\n` +
    `Academic level: ${level} Level.\n` +
    `${courseLine}\n` +
    `${pdfLine}\n` +
    `Only use materials for this student's level. Do not discuss other levels' syllabi unless asked generally.\n` +
    historyBlock;

  if (action === "summarise") {
    return (
      `${base}\n` +
      `Task: Summarise the attached lecture PDF into clear study notes for a ${level} Level agriculture student.\n` +
      `Use short headings and bullet points. Highlight key definitions and takeaways.\n` +
      (question ? `Extra student request: ${question}\n` : "")
    );
  }

  if (action === "quiz") {
    return (
      `${base}\n` +
      `Task: Generate a short practice quiz (6–10 questions) for this ${level} Level student.\n` +
      `Prefer the attached PDF when present; otherwise use the selected course topic.\n` +
      `Include a mix of short-answer and multiple-choice items, then provide an answer key.\n` +
      (question ? `Focus areas from student: ${question}\n` : "")
    );
  }

  return (
    `${base}\n` +
    `Task: Answer the student's academic question clearly for ${level} Level.\n` +
    `If a PDF is attached, use it as the primary source.\n` +
    `If a course is selected but no PDF is attached, teach from the course topic and general academic knowledge.\n\n` +
    `Student question:\n${question}\n`
  );
}

/**
 * Create or update a conversation owned by this student after a successful AI reply.
 */
async function persistConversationTurn({
  conversationId,
  student,
  course,
  noteId,
  action,
  userText,
  botText,
}) {
  let conversation = null;

  if (conversationId) {
    conversation = await findOwnedConversation(conversationId, student._id);
  }

  if (!conversation) {
    conversation = new AiConversation({
      student: student._id,
      level: student.level,
      title: AiConversation.makeTitleFromQuestion(userText),
      courseCode: course?.code || "",
      courseTitle: course?.title || "",
      noteId: noteId || null,
      messages: [],
    });
  } else {
    if (course) {
      conversation.courseCode = course.code;
      conversation.courseTitle = course.title;
    }
    if (noteId) {
      conversation.noteId = noteId;
    }
    if (
      !conversation.title ||
      conversation.title === "New conversation" ||
      conversation.messages.length === 0
    ) {
      conversation.title = AiConversation.makeTitleFromQuestion(userText);
    }
  }

  conversation.messages.push(
    { role: "user", text: userText, action },
    { role: "bot", text: botText, action }
  );

  await conversation.save();
  return conversation;
}

/**
 * Load a library PDF for this student (level-gated).
 */
async function loadLibraryPdf(noteId, student) {
  if (!noteId) return null;

  const note = await NoteResource.findById(noteId);
  if (!note) {
    const error = new Error("Selected library PDF was not found.");
    error.code = "NOTE_NOT_FOUND";
    throw error;
  }
  if (!studentCanAccessNote(note, student)) {
    const error = new Error(
      "You do not have access to this material."
    );
    error.code = "NOTE_LEVEL_FORBIDDEN";
    throw error;
  }

  const buffer = await readStoredPdf(note.storagePath);
  return {
    buffer,
    mimeType: note.mimeType || "application/pdf",
    name: note.originalName || note.title,
    note,
  };
}

/**
 * Persist a freshly uploaded PDF into the course library when a valid course is set.
 * Deduplicates by content hash within level + course.
 */
async function persistUploadToLibrary({ file, student, course }) {
  if (!file?.buffer?.length || !course) return null;

  const contentHash = hashBuffer(file.buffer);
  const existing = await NoteResource.findOne({
    level: student.level,
    courseCode: course.code,
    contentHash,
    source: "personal",
    studentOwner: student._id,
  });
  if (existing) return existing;

  const saved = await savePdfBuffer({
    buffer: file.buffer,
    level: student.level,
    courseCode: course.code,
    originalName: file.originalname,
  });

  const title =
    String(file.originalname || "Lecture notes")
      .replace(/\.pdf$/i, "")
      .trim()
      .slice(0, 160) || `${course.code} lecture notes`;

  try {
    return await NoteResource.create({
      title,
      description: "Personal upload from AI Assistant",
      originalName: file.originalname || saved.storedName,
      storedName: saved.storedName,
      storagePath: saved.storagePath,
      mimeType: file.mimetype || "application/pdf",
      size: saved.size,
      contentHash: saved.contentHash,
      level: student.level,
      courseCode: course.code,
      courseTitle: course.title,
      source: "personal",
      studentOwner: student._id,
      uploadedBy: student._id,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return NoteResource.findOne({
        level: student.level,
        courseCode: course.code,
        contentHash,
        source: "personal",
        studentOwner: student._id,
      });
    }
    throw error;
  }
}

async function assist(req, res) {
  try {
    await runPdfUpload(req, res);

    if (!isGeminiConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          "AI is not configured yet. Add GEMINI_API_KEY (free tier) to backend/.env and restart the server.",
      });
    }

    const action = String(req.body?.action || "ask").trim().toLowerCase();
    const question = String(req.body?.question || "").trim();
    const courseCode = String(req.body?.courseCode || "").trim();
    const noteId = String(req.body?.noteId || "").trim();
    const conversationId = String(req.body?.conversationId || "").trim();
    const student = req.student;

    if (!ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid AI action. Use ask, summarise, or quiz.",
      });
    }

    if (action === "ask" && !question) {
      return res.status(400).json({
        success: false,
        message: "Please enter a question for the AI Assistant.",
      });
    }

    let existingConversation = null;
    if (conversationId) {
      existingConversation = await findOwnedConversation(
        conversationId,
        student._id
      );
      if (!existingConversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found, or it does not belong to you.",
        });
      }
    }

    let course = null;
    if (courseCode) {
      course = findCourseForStudent(student.level, courseCode);
      if (!course) {
        return res.status(403).json({
          success: false,
          message:
            "That course is not available for your academic level. Choose a course from your level dashboard.",
        });
      }
    } else if (existingConversation?.courseCode) {
      course = findCourseForStudent(
        student.level,
        existingConversation.courseCode
      );
    }

    let pdfBuffer = null;
    let pdfMimeType = null;
    let pdfName = null;
    let libraryNote = null;

    if (req.file?.buffer?.length) {
      pdfBuffer = req.file.buffer;
      pdfMimeType = req.file.mimetype;
      pdfName = req.file.originalname;

      if (course) {
        try {
          libraryNote = await persistUploadToLibrary({
            file: req.file,
            student,
            course,
          });
        } catch (persistError) {
          console.error("AI library persist warning:", persistError.message);
        }
      }
    } else if (noteId) {
      const loaded = await loadLibraryPdf(noteId, student);
      pdfBuffer = loaded.buffer;
      pdfMimeType = loaded.mimeType;
      pdfName = loaded.name;
      libraryNote = loaded.note;
      await logMaterialViewIfNeeded(student, loaded.note);

      if (!course && loaded.note?.courseCode) {
        course = findCourseForStudent(student.level, loaded.note.courseCode);
      }
    }

    const hasPdf = Boolean(pdfBuffer?.length);

    if ((action === "summarise" || action === "quiz") && !hasPdf && !course) {
      return res.status(400).json({
        success: false,
        message:
          "Select a course or choose/upload a PDF before summarising or generating a quiz.",
      });
    }

    if (action === "summarise" && !hasPdf) {
      return res.status(400).json({
        success: false,
        message: "Choose a library PDF or upload a lecture PDF to summarise.",
      });
    }

    const prompt = buildPrompt({
      action,
      question,
      student,
      course,
      pdfName,
      historyMessages: existingConversation?.messages || [],
    });
    const reply = await generateAgriLearnReply({
      prompt,
      pdfBuffer: hasPdf ? pdfBuffer : null,
      pdfMimeType: hasPdf ? pdfMimeType : null,
    });

    const resolvedNoteId = libraryNote
      ? libraryNote._id
      : noteId || existingConversation?.noteId || null;

    let savedConversation = null;
    const isNewConversation = !existingConversation;
    try {
      savedConversation = await persistConversationTurn({
        conversationId: existingConversation?._id?.toString() || "",
        student,
        course,
        noteId: resolvedNoteId,
        action,
        userText: question,
        botText: reply,
      });
    } catch (persistError) {
      console.error("Conversation persist warning:", persistError.message);
    }

    if (libraryNote && req.file?.buffer?.length) {
      await recordPersonalUpload(student, libraryNote, { via: "ai_assistant" });
    }

    const convId =
      savedConversation?._id ||
      existingConversation?._id ||
      null;

    await logAiInteraction({
      student,
      action,
      question:
        question ||
        (action === "summarise"
          ? "Summarise lecture PDF"
          : action === "quiz"
            ? "Generate practice quiz"
            : ""),
      course,
      conversationId: convId,
      isNewConversation,
    });

    return res.status(200).json({
      success: true,
      reply,
      model: getGeminiModelId(),
      action,
      course: course
        ? { code: course.code, title: course.title }
        : null,
      pdfUsed: hasPdf,
      pdfName: hasPdf ? pdfName : null,
      noteId: resolvedNoteId ? String(resolvedNoteId) : null,
      conversationId: savedConversation
        ? savedConversation._id.toString()
        : existingConversation?._id?.toString() || null,
      conversation: savedConversation
        ? savedConversation.toListItem()
        : null,
      tier: "free",
    });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: pdfTooLargeMessage(),
        });
      }
      return res.status(400).json({
        success: false,
        message: "Could not read the uploaded PDF. Please try again.",
      });
    }

    if (error && error.message === "Only PDF files are allowed.") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "NOTE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "NOTE_LEVEL_FORBIDDEN") {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "INVALID_PATH" || error.code === "ENOENT") {
      return res.status(404).json({
        success: false,
        message: "Selected PDF file is missing on the server.",
      });
    }

    const message = sanitizeGeminiMessage(error?.message || "");
    console.error("AI assist error:", message);

    if (error.code === "GEMINI_NOT_CONFIGURED") {
      return res.status(503).json({
        success: false,
        message,
      });
    }

    if (error.code === "GEMINI_BLOCKED" || error.code === "GEMINI_EMPTY") {
      return res.status(502).json({
        success: false,
        message,
      });
    }

    if (/404|no longer available|not found|not available to new users/i.test(message)) {
      return res.status(502).json({
        success: false,
        message:
          `Gemini model "${getGeminiModelId()}" is not available for this API key. ` +
          "Set GEMINI_MODEL=gemini-3.5-flash-lite in backend/.env (free tier), then restart the backend.",
      });
    }

    if (/429|quota|rate limit|resource_exhausted/i.test(message)) {
      return res.status(429).json({
        success: false,
        message:
          "Gemini free-tier rate limit reached. Please wait a minute and try again. No paid upgrade was used.",
      });
    }

    if (/API key|PERMISSION_DENIED|401|403|invalid.*key/i.test(message)) {
      return res.status(502).json({
        success: false,
        message:
          "Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env (free-tier key from AI Studio, no billing).",
      });
    }

    if (/INVALID_ARGUMENT|request.*invalid|payload/i.test(message)) {
      return res.status(400).json({
        success: false,
        message:
          "Gemini rejected the request format (question or PDF). Try a shorter question or a smaller PDF under 25 MB.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "The AI Assistant could not complete that request. " +
        (message
          ? `Details: ${message.slice(0, 240)}`
          : "Please try again."),
    });
  }
}

module.exports = {
  assist,
};
