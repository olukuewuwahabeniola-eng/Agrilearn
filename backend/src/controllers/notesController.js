const NoteResource = require("../models/NoteResource");
const { findCourseForStudent } = require("../data/coursesByLevel");
const {
  buildLibraryFilter,
  studentCanAccessNote,
  studentCanDeleteNote,
} = require("../utils/noteAccess");
const {
  deleteStoredNoteFile,
  deleteStoredNoteFilesForNote,
  openStoredReadStream,
} = require("../utils/noteStorage");
const {
  runNotesUpload,
  handleNotesUploadError,
  collectNoteUploads,
  combinedContentHash,
  persistNotePages,
  defaultNoteTitle,
  findDuplicateNote,
  resolveNotePages,
} = require("../utils/notesUpload");
const {
  logMaterialViewIfNeeded,
  logMaterialDownloadIfNeeded,
  logCourseAccessIfNeeded,
  recordPersonalUpload,
} = require("../utils/activityTracker");

/**
 * GET /api/notes?library=official|personal&courseCode=&q=
 */
async function listNotes(req, res) {
  try {
    const student = req.student;
    const library = String(req.query.library || "official").trim().toLowerCase();
    const courseCode = String(req.query.courseCode || "").trim().toUpperCase();
    const q = String(req.query.q || "").trim();

    if (library !== "official" && library !== "personal") {
      return res.status(400).json({
        success: false,
        message: 'Use library=official or library=personal.',
      });
    }

    const filter = buildLibraryFilter(student, library);

    if (courseCode) {
      const course = findCourseForStudent(student.level, courseCode);
      if (!course) {
        return res.status(403).json({
          success: false,
          message:
            "That course is not available for your academic level. Choose a course from your level dashboard.",
        });
      }
      filter.courseCode = course.code;
    }

    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { title: regex },
            { description: regex },
            { originalName: regex },
            { courseCode: regex },
            { courseTitle: regex },
          ],
        },
      ];
    }

    const notes = await NoteResource.find(filter)
      .sort({ createdAt: -1 })
      .limit(200);

    if (courseCode) {
      const course = findCourseForStudent(student.level, courseCode);
      if (course) {
        await logCourseAccessIfNeeded(student, course);
      }
    }

    return res.status(200).json({
      success: true,
      library,
      level: student.level,
      count: notes.length,
      notes: notes.map((note) => note.toPublicObject()),
    });
  } catch (error) {
    console.error("List notes error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load notes right now. Please try again.",
    });
  }
}

/**
 * POST /api/notes — student personal upload only.
 */
async function uploadNote(req, res) {
  try {
    await runNotesUpload(req, res);

    const student = req.student;
    const courseCode = String(req.body?.courseCode || "").trim();
    const titleInput = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();

    if (!courseCode) {
      return res.status(400).json({
        success: false,
        message: "Select a course before uploading.",
      });
    }

    const course = findCourseForStudent(student.level, courseCode);
    if (!course) {
      return res.status(403).json({
        success: false,
        message:
          "That course is not available for your academic level. Choose a course from your level dashboard.",
      });
    }

    const { format, files } = collectNoteUploads(req);
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "Please choose a PDF or one or more images to upload.",
      });
    }

    const contentHash = combinedContentHash(files.map((file) => file.buffer));
    const existing = await findDuplicateNote({
      level: student.level,
      courseCode: course.code,
      contentHash,
      source: "personal",
      studentOwner: student._id,
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        duplicated: true,
        message: "This note is already in your personal library.",
        note: existing.toPublicObject(),
      });
    }

    const savedFiles = await persistNotePages({
      files,
      format,
      level: student.level,
      courseCode: course.code,
      folderKind: "notes/personal",
      ownerSegment: student._id.toString(),
    });

    const first = savedFiles[0];
    const title = defaultNoteTitle({
      titleInput,
      files,
      format,
      courseCode: course.code,
    });

    let note;
    try {
      note = await NoteResource.create({
        title,
        description: description.slice(0, 500) || "Personal upload",
        originalName: first.originalName,
        storedName: first.storedName,
        storagePath: first.storagePath,
        mimeType: first.mimeType,
        size: savedFiles.reduce((sum, file) => sum + file.size, 0),
        contentHash,
        format,
        files: savedFiles,
        level: student.level,
        courseCode: course.code,
        courseTitle: course.title,
        source: "personal",
        studentOwner: student._id,
        uploadedBy: student._id,
      });
    } catch (createError) {
      await Promise.all(
        savedFiles.map((file) => deleteStoredNoteFile(file.storagePath))
      );
      throw createError;
    }

    await recordPersonalUpload(student, note, { via: "notes" });

    return res.status(201).json({
      success: true,
      duplicated: false,
      message:
        format === "images"
          ? `Saved ${savedFiles.length} pages to My Personal Uploads.`
          : "PDF saved to My Personal Uploads.",
      note: note.toPublicObject(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      try {
        const courseCode = String(req.body?.courseCode || "").trim();
        const course = findCourseForStudent(req.student.level, courseCode);
        const { files } = collectNoteUploads(req);
        const contentHash = files.length
          ? combinedContentHash(files.map((file) => file.buffer))
          : null;
        if (course && contentHash) {
          const existing = await findDuplicateNote({
            level: req.student.level,
            courseCode: course.code,
            contentHash,
            source: "personal",
            studentOwner: req.student._id,
          });
          if (existing) {
            return res.status(200).json({
              success: true,
              duplicated: true,
              message: "This note is already in your personal library.",
              note: existing.toPublicObject(),
            });
          }
        }
      } catch {
        /* fall through */
      }
    }
    return handleNotesUploadError(error, res, "Could not save the note. Please try again.");
  }
}

async function getNote(req, res) {
  try {
    const note = await NoteResource.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found.",
      });
    }
    if (!studentCanAccessNote(note, req.student)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this material.",
      });
    }
    await logMaterialViewIfNeeded(req.student, note);
    return res.status(200).json({
      success: true,
      note: note.toPublicObject(),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid note id.",
    });
  }
}

async function streamNotePage(req, res, fileIndex) {
  const note = await NoteResource.findById(req.params.id);
  if (!note) {
    return res.status(404).json({
      success: false,
      message: "Note not found.",
    });
  }
  if (!studentCanAccessNote(note, req.student)) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this material.",
    });
  }

  const pages = resolveNotePages(note);
  const page = pages[fileIndex];
  if (!page?.storagePath) {
    return res.status(404).json({
      success: false,
      message: "That page was not found.",
    });
  }

  await logMaterialDownloadIfNeeded(req.student, note);

  const filename = page.originalName || note.originalName || "notes";
  res.setHeader("Content-Type", page.mimeType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(filename)}"`
  );
  if (page.size) {
    res.setHeader("Content-Length", String(page.size));
  }

  const stream = await openStoredReadStream(page.storagePath);
  stream.on("error", (err) => {
    console.error("Note stream error:", err.message);
    if (!res.headersSent) {
      res.status(404).json({
        success: false,
        message: "File is missing on the server.",
      });
    } else {
      res.end();
    }
  });
  stream.pipe(res);
  return undefined;
}

async function downloadNoteFile(req, res) {
  try {
    return await streamNotePage(req, res, 0);
  } catch (error) {
    console.error("Download note error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not download that file.",
    });
  }
}

async function downloadNotePageFile(req, res) {
  try {
    const fileIndex = parseInt(String(req.params.fileIndex || "0"), 10);
    if (!Number.isFinite(fileIndex) || fileIndex < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid page number.",
      });
    }
    return await streamNotePage(req, res, fileIndex);
  } catch (error) {
    console.error("Download note page error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not open that page.",
    });
  }
}

/**
 * DELETE /api/notes/:id — personal uploads only, owner only.
 */
async function deleteNote(req, res) {
  try {
    const note = await NoteResource.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found.",
      });
    }
    if (!studentCanDeleteNote(note, req.student)) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own personal uploads.",
      });
    }

    await note.deleteOne();
    await deleteStoredNoteFilesForNote(note);

    return res.status(200).json({
      success: true,
      message: "Personal upload removed.",
      id: req.params.id,
    });
  } catch (error) {
    console.error("Delete note error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete that upload.",
    });
  }
}

module.exports = {
  listNotes,
  uploadNote,
  getNote,
  downloadNoteFile,
  downloadNotePageFile,
  deleteNote,
};
