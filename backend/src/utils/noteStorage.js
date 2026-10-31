const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const {
  MAX_PDF_BYTES,
  pdfTooLargeMessage,
} = require("./uploadLimits");

function getUploadsRoot() {
  const configured = process.env.UPLOADS_DIR;
  if (configured && configured.trim()) {
    return path.resolve(configured.trim());
  }
  return path.join(__dirname, "..", "..", "uploads");
}

function getNotesRoot() {
  return path.join(getUploadsRoot(), "notes");
}

function sanitizeSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "file";
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function ensureNotesDir(level, courseCode) {
  const dir = path.join(
    getNotesRoot(),
    sanitizeSegment(level),
    sanitizeSegment(courseCode).toUpperCase()
  );
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Persist a PDF under uploads/notes/{level}/{courseCode}/.
 * Returns relative storage path (from uploads root) plus absolute path.
 */
async function savePdfBuffer({ buffer, level, courseCode, originalName }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error("PDF content is empty.");
    error.code = "EMPTY_PDF";
    throw error;
  }
  if (buffer.length > MAX_PDF_BYTES) {
    const error = new Error(pdfTooLargeMessage());
    error.code = "LIMIT_FILE_SIZE";
    throw error;
  }

  const contentHash = hashBuffer(buffer);
  const dir = await ensureNotesDir(level, courseCode);
  const base = sanitizeSegment(path.parse(originalName || "lecture").name);
  const storedName = `${Date.now()}-${contentHash.slice(0, 12)}-${base}.pdf`;
  const absolutePath = path.join(dir, storedName);

  await fsp.writeFile(absolutePath, buffer);

  const relativePath = path
    .relative(getUploadsRoot(), absolutePath)
    .split(path.sep)
    .join("/");

  return {
    contentHash,
    storedName,
    storagePath: relativePath,
    absolutePath,
    size: buffer.length,
  };
}

function resolveStoredPath(storagePath) {
  const root = path.resolve(getUploadsRoot());
  const absolute = path.resolve(root, storagePath);
  const relative = path.relative(root, absolute);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    const error = new Error("Invalid storage path.");
    error.code = "INVALID_PATH";
    throw error;
  }
  return absolute;
}

async function readStoredPdf(storagePath) {
  const absolute = resolveStoredPath(storagePath);
  return fsp.readFile(absolute);
}

function createReadStream(storagePath) {
  const absolute = resolveStoredPath(storagePath);
  return fs.createReadStream(absolute);
}

async function deleteStoredNoteFile(storagePath) {
  if (!storagePath) return;
  try {
    const absolute = resolveStoredPath(storagePath);
    await fsp.unlink(absolute);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Note file delete warning:", error.message);
    }
  }
}

module.exports = {
  MAX_PDF_BYTES,
  getUploadsRoot,
  getNotesRoot,
  hashBuffer,
  savePdfBuffer,
  readStoredPdf,
  createReadStream,
  resolveStoredPath,
  deleteStoredNoteFile,
};
