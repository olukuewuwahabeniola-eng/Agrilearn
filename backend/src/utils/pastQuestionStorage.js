const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const {
  hashBuffer,
  resolveStoredPath,
  openStoredReadStream,
  isCloudinaryStoragePath,
} = require("./noteStorage");
const {
  MAX_PDF_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_TOTAL_BYTES,
  MAX_IMAGES_PER_PAPER,
  pdfTooLargeMessage,
  imageTooLargeMessage,
  imagesTotalTooLargeMessage,
} = require("./uploadLimits");
const {
  isCloudinaryConfigured,
  uploadBuffer,
  destroyCloudinaryAsset,
} = require("./cloudinary");

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

function sanitizeSegment(value) {
  return (
    String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "file"
  );
}

function extensionForMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  return ".bin";
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
 * Persist one past-question file to Cloudinary (new uploads only).
 * Legacy local disk paths remain readable via openStoredReadStream.
 * storagePath is opaque (cloudinary:…) — never a public URL.
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

  if (!isCloudinaryConfigured()) {
    const error = new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
    error.code = "CLOUDINARY_NOT_CONFIGURED";
    throw error;
  }

  const contentHash = hashBuffer(buffer);
  const base = sanitizeSegment(path.parse(originalName || "past-paper").name);
  const ext = extensionForMime(normalizedMime);
  const storedName = `${Date.now()}-${contentHash.slice(0, 12)}-${base}${ext}`;
  const levelSeg = sanitizeSegment(level);
  const courseSeg = sanitizeSegment(courseCode).toUpperCase();

  const uploaded = await uploadBuffer({
    buffer,
    mimeType: normalizedMime,
    folderParts: ["past-questions", levelSeg, courseSeg],
    storedName,
    originalName,
  });

  return {
    contentHash,
    storedName,
    storagePath: uploaded.storagePath,
    size: uploaded.bytes || buffer.length,
    mimeType: normalizedMime,
    originalName: originalName || storedName,
    storageProvider: "cloudinary",
  };
}

async function deleteStoredFile(storagePath) {
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
      console.error("Past question file delete warning:", error.message);
    }
  }
}

async function deletePastQuestionFiles(files) {
  if (!Array.isArray(files)) return;
  await Promise.all(files.map((f) => deleteStoredFile(f.storagePath)));
}

/** Sync local-only; prefer openStoredReadStream for dual storage. */
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
  openStoredReadStream,
  resolveStoredPath,
  isCloudinaryStoragePath,
};
