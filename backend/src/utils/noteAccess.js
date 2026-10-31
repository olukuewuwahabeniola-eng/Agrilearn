const OFFICIAL_MARKERS = [
  "Uploaded by AgriLearn Admin",
  "Official AgriLearn material",
];

/**
 * Resolve library source for legacy documents created before `source` existed.
 */
function resolveNoteSource(note) {
  if (note.source === "official" || note.source === "personal") {
    return note.source;
  }
  const desc = String(note.description || "");
  if (OFFICIAL_MARKERS.some((m) => desc.includes(m))) {
    return "official";
  }
  return "personal";
}

function studentCanAccessNote(note, student) {
  if (!note || !student) return false;
  if (note.level !== student.level) return false;

  const source = resolveNoteSource(note);
  if (source === "official") return true;

  const owner = note.studentOwner || note.uploadedBy;
  return Boolean(owner && String(owner) === String(student._id));
}

function buildLibraryFilter(student, library) {
  const base = { level: student.level };

  if (library === "official") {
    return {
      ...base,
      $or: [
        { source: "official" },
        {
          source: { $exists: false },
          description: { $regex: /AgriLearn Admin|Official AgriLearn/i },
        },
      ],
    };
  }

  if (library === "personal") {
    return {
      ...base,
      $or: [
        { source: "personal", studentOwner: student._id },
        { source: { $exists: false }, uploadedBy: student._id },
      ],
    };
  }

  // Combined view (not used for student list — kept for safety)
  return {
    ...base,
    $or: [
      { source: "official" },
      {
        source: { $exists: false },
        description: { $regex: /AgriLearn Admin|Official AgriLearn/i },
      },
      { source: "personal", studentOwner: student._id },
      { source: { $exists: false }, uploadedBy: student._id },
    ],
  };
}

function studentCanDeleteNote(note, student) {
  if (!studentCanAccessNote(note, student)) return false;
  return resolveNoteSource(note) === "personal";
}

module.exports = {
  resolveNoteSource,
  studentCanAccessNote,
  studentCanDeleteNote,
  buildLibraryFilter,
};
