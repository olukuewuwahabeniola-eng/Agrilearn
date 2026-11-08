const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const {
  MAX_PDF_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_TOTAL_BYTES,
  MAX_IMAGES_PER_NOTE,
  pdfTooLargeMessage,
  imageTooLargeMessage,
  imagesTotalTooLargeMessage,
} = require("./uploadLimits");
const {
  isCloudinaryConfigured,
  isCloudinaryStoragePath,
  uploadBuffer,
  downloadCloudinaryBuffer,
  openCloudinaryReadStream,
  destroyCloudinaryAsset,
} = require("./cloudinary");
const { assertFileSignature } = require("./fileSignature");

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
  return (
    String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "file"
  );
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function extensionForNoteMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  return ".bin";
}

function buildStoredName(originalName, contentHash, mimeType = "application/pdf") {
  const base = sanitizeSegment(path.parse(originalName || "lecture").name);
  return `${Date.now()}-${contentHash.slice(0, 12)}-${base}${extensionForNoteMime(mimeType)}`;
}

const NOTE_ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function validateNoteFileSize(buffer, mimeType) {
  const isPdf = String(mimeType || "").toLowerCase() === "application/pdf";
  const max = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error("File content is empty.");
    error.code = "EMPTY_FILE";
    throw error;
  }
  if (buffer.length > max) {
    const error = new Error(isPdf ? pdfTooLargeMessage() : imageTooLargeMessage());
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
 * Persist a PDF to Cloudinary (new uploads only).
 * Legacy local disk paths remain readable via readStoredPdf / openStoredReadStream.
 * Returns cloudinary: storagePath — never a public URL.
 */
async function saveNoteFile({
  buffer,
  level,
  courseCode,
  originalName,
  mimeType = "application/pdf",
  folderKind = "notes",
  ownerSegment = null,
}) {
  const normalizedMime = String(mimeType || "").toLowerCase();
  if (!NOTE_ALLOWED_MIMES.has(normalizedMime)) {
    const error = new Error(
      "Only PDF, JPG, JPEG, PNG, and WEBP files are allowed."
    );
    error.code = "INVALID_MIME";
    throw error;
  }

  validateNoteFileSize(buffer, normalizedMime);
  assertFileSignature(buffer, normalizedMime);

  if (!isCloudinaryConfigured()) {
    const error = new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
    error.code = "CLOUDINARY_NOT_CONFIGURED";
    throw error;
  }

  const contentHash = hashBuffer(buffer);
  const storedName = buildStoredName(originalName, contentHash, normalizedMime);
  const levelSeg = sanitizeSegment(level);
  const courseSeg = sanitizeSegment(courseCode).toUpperCase();

  const folderParts = String(folderKind || "notes")
    .split("/")
    .map((part) => sanitizeSegment(part))
    .filter(Boolean);
  if (ownerSegment) folderParts.push(sanitizeSegment(ownerSegment));
  folderParts.push(levelSeg, courseSeg);

  const uploaded = await uploadBuffer({
    buffer,
    mimeType: normalizedMime,
    folderParts,
    storedName,
    originalName,
  });

  return {
    contentHash,
    storedName,
    storagePath: uploaded.storagePath,
    absolutePath: null,
    size: uploaded.bytes || buffer.length,
    mimeType: normalizedMime,
    originalName: originalName || storedName,
    storageProvider: "cloudinary",
  };
}

async function savePdfBuffer(options) {
  return saveNoteFile({
    ...options,
    mimeType: "application/pdf",
  });
}

function allNoteStoragePaths(note) {
  const paths = [];
  if (note?.storagePath) paths.push(note.storagePath);
  for (const file of note?.files || []) {
    if (file?.storagePath) paths.push(file.storagePath);
  }
  return [...new Set(paths)];
}

async function deleteStoredNoteFilesForNote(note) {
  const paths = allNoteStoragePaths(note);
  await Promise.all(paths.map((storagePath) => deleteStoredNoteFile(storagePath)));
}

function resolveStoredPath(storagePath) {
  if (isCloudinaryStoragePath(storagePath)) {
    const error = new Error("Cloudinary assets are not local files.");
    error.code = "NOT_LOCAL_PATH";
    throw error;
  }

  const root = path.resolve(getUploadsRoot());
  const absolute = path.resolve(root, storagePath);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    const error = new Error("Invalid storage path.");
    error.code = "INVALID_PATH";
    throw error;
  }
  return absolute;
}

async function readStoredPdf(storagePath) {
  if (isCloudinaryStoragePath(storagePath)) {
    return downloadCloudinaryBuffer(storagePath);
  }
  const absolute = resolveStoredPath(storagePath);
  return fsp.readFile(absolute);
}

/**
 * Open a readable stream for a stored file (local disk or Cloudinary).
 * Async so Cloudinary signed downloads can be fetched after auth checks.
 */
async function openStoredReadStream(storagePath) {
  if (isCloudinaryStoragePath(storagePath)) {
    return openCloudinaryReadStream(storagePath);
  }
  const absolute = resolveStoredPath(storagePath);
  return fs.createReadStream(absolute);
}

/** @deprecated Prefer openStoredReadStream — sync local-only helper kept for callers. */
function createReadStream(storagePath) {
  if (isCloudinaryStoragePath(storagePath)) {
    const error = new Error(
      "Use openStoredReadStream for Cloudinary-backed files."
    );
    error.code = "ASYNC_STREAM_REQUIRED";
    throw error;
  }
  const absolute = resolveStoredPath(storagePath);
  return fs.createReadStream(absolute);
}

async function deleteStoredNoteFile(storagePath) {
  if (!storagePath) return;
  try {
    if (isCloudinaryStoragePath(storagePath)) {
      await destroyCloudinaryAsset(storagePath);
      return;
    }
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
  MAX_IMAGE_BYTES,
  MAX_IMAGES_TOTAL_BYTES,
  MAX_IMAGES_PER_NOTE,
  NOTE_ALLOWED_MIMES,
  getUploadsRoot,
  getNotesRoot,
  hashBuffer,
  savePdfBuffer,
  saveNoteFile,
  validateImagesTotalSize,
  readStoredPdf,
  createReadStream,
  openStoredReadStream,
  resolveStoredPath,
  deleteStoredNoteFile,
  allNoteStoragePaths,
  deleteStoredNoteFilesForNote,
  isCloudinaryStoragePath,
};
