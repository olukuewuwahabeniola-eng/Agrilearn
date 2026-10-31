const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { getUploadsRoot, hashBuffer, resolveStoredPath, createReadStream } =
  require("./noteStorage");
const {
  MAX_PDF_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_TOTAL_BYTES,
  MAX_IMAGES_PER_PAPER,
  pdfTooLargeMessage,
  imageTooLargeMessage,
  imagesTotalTooLargeMessage,
} = require("./uploadLimits");

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

function getPastQuestionsRoot() {
  return path.join(getUploadsRoot(), "past-questions");
}

function sanitizeSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "file";
}

function extensionForMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  return ".bin";
}

async function ensurePastQuestionDir(level, courseCode) {
  const dir = path.join(
    getPastQuestionsRoot(),
    sanitizeSegment(level),
    sanitizeSegment(courseCode).toUpperCase()
  );
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

function validateFileSize(buffer, mimeType) {
  const isPdf = mimeType === "application/pdf";
  const max = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error("File content is empty.");
    error.code = "EMPTY_FILE";
    throw error;
  }
  if (buffer.length > max) {
    const error = new Error(
      isPdf ? pdfTooLargeMessage() : imageTooLargeMessage()
    );
    error.code = "LIMIT_FILE_SIZE";
    throw error;
  }
}

function validateImagesTotalSize(buffers) {
  const total = (Array.isArray(buffers) ? buffers : []).reduce(
    (sum, buffer) => sum + (Buffer.isBuffer(buffer) ? buffer.length : 0),
    0
  );
  if (total > MAX_IMAGES_TOTAL_BYTES) {
    const error = new Error(imagesTotalTooLargeMessage());
    error.code = "LIMIT_FILE_SIZE";
    throw error;
  }
}

/**
 * Persist one past-question file under uploads/past-questions/{level}/{courseCode}/.
 */
async function savePastQuestionFile({
  buffer,
  level,
  courseCode,
  originalName,
  mimeType,
}) {
  const normalizedMime = String(mimeType || "").toLowerCase();
  if (!ALLOWED_MIMES.has(normalizedMime)) {
    const error = new Error("Unsupported file type.");
    error.code = "INVALID_MIME";
    throw error;
  }

  validateFileSize(buffer, normalizedMime);

  const contentHash = hashBuffer(buffer);
  const dir = await ensurePastQuestionDir(level, courseCode);
  const base = sanitizeSegment(path.parse(originalName || "past-paper").name);
  const ext = extensionForMime(normalizedMime);
  const storedName = `${Date.now()}-${contentHash.slice(0, 12)}-${base}${ext}`;
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
    size: buffer.length,
    mimeType: normalizedMime,
    originalName: originalName || storedName,
  };
}

async function deleteStoredFile(storagePath) {
  if (!storagePath) return;
  try {
    const absolute = resolveStoredPath(storagePath);
    await fsp.unlink(absolute);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Past question file delete warning:", error.message);
    }
  }
}

async function deletePastQuestionFiles(files) {
  if (!Array.isArray(files)) return;
  await Promise.all(files.map((f) => deleteStoredFile(f.storagePath)));
}

module.exports = {
  MAX_PDF_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_TOTAL_BYTES,
  MAX_IMAGES_PER_PAPER,
  ALLOWED_MIMES,
  validateImagesTotalSize,
  savePastQuestionFile,
  deletePastQuestionFiles,
  deleteStoredFile,
  createReadStream,
  resolveStoredPath,
};
