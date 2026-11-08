const {
  MAX_COMMUNITY_AVATAR_BYTES,
  MAX_COMMUNITY_IMAGE_BYTES,
  MAX_COMMUNITY_PDF_BYTES,
  communityAvatarTooLargeMessage,
  communityImageTooLargeMessage,
  communityPdfTooLargeMessage,
} = require("./uploadLimits");
const {
  isCloudinaryConfigured,
  uploadBuffer,
  destroyCloudinaryAsset,
  openCloudinaryReadStream,
} = require("./cloudinary");
const { hashBuffer } = require("./noteStorage");
const { assertFileSignature } = require("./fileSignature");

const CHAT_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const CHAT_PDF_MIME = "application/pdf";

function extensionForMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  return ".bin";
}

function classifyChatFile(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === CHAT_PDF_MIME) return "pdf";
  if (CHAT_IMAGE_MIMES.has(mime)) return "image";
  return null;
}

function assertCloudinaryReady() {
  if (!isCloudinaryConfigured()) {
    const error = new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
    error.code = "CLOUDINARY_NOT_CONFIGURED";
    throw error;
  }
}

function validateChatFile(buffer, mimeType) {
  const kind = classifyChatFile(mimeType);
  if (!kind) {
    const error = new Error("Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.");
    error.code = "INVALID_MIME";
    throw error;
  }
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error("File content is empty.");
    error.code = "EMPTY_FILE";
    throw error;
  }
  const max = kind === "pdf" ? MAX_COMMUNITY_PDF_BYTES : MAX_COMMUNITY_IMAGE_BYTES;
  if (buffer.length > max) {
    const error = new Error(
      kind === "pdf" ? communityPdfTooLargeMessage() : communityImageTooLargeMessage()
    );
    error.code = "LIMIT_FILE_SIZE";
    throw error;
  }
  assertFileSignature(buffer, mimeType);
  return kind;
}

function validateAvatarFile(buffer, mimeType) {
  const kind = classifyChatFile(mimeType);
  if (kind !== "image") {
    const error = new Error("Profile pictures must be JPG, JPEG, PNG, or WEBP.");
    error.code = "INVALID_MIME";
    throw error;
  }
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error("File content is empty.");
    error.code = "EMPTY_FILE";
    throw error;
  }
  if (buffer.length > MAX_COMMUNITY_AVATAR_BYTES) {
    const error = new Error(communityAvatarTooLargeMessage());
    error.code = "LIMIT_FILE_SIZE";
    throw error;
  }
  assertFileSignature(buffer, mimeType);
  return kind;
}

async function saveCommunityFile({
  buffer,
  mimeType,
  originalName,
  level,
  ownerSegment,
  folderKind = "community/chat",
}) {
  const kind = validateChatFile(buffer, mimeType);
  assertCloudinaryReady();

  const contentHash = hashBuffer(buffer);
  const storedName = `${Date.now()}-${contentHash.slice(0, 12)}${extensionForMime(mimeType)}`;
  const uploaded = await uploadBuffer({
    buffer,
    mimeType: String(mimeType || "").toLowerCase(),
    folderParts: [folderKind, String(level || "all"), String(ownerSegment || "file")],
    storedName,
  });

  return {
    originalName: originalName || storedName,
    storedName,
    storagePath: uploaded.storagePath,
    mimeType: String(mimeType || "").toLowerCase(),
    size: uploaded.bytes || buffer.length,
    kind,
  };
}

async function saveAvatarFile({ buffer, mimeType, originalName, studentId }) {
  validateAvatarFile(buffer, mimeType);
  assertCloudinaryReady();

  const contentHash = hashBuffer(buffer);
  const storedName = `${Date.now()}-${contentHash.slice(0, 12)}${extensionForMime(mimeType)}`;
  const uploaded = await uploadBuffer({
    buffer,
    mimeType: String(mimeType || "").toLowerCase(),
    folderParts: ["community/avatars", String(studentId || "student")],
    storedName,
  });

  return {
    originalName: originalName || storedName,
    storedName,
    storagePath: uploaded.storagePath,
    mimeType: String(mimeType || "").toLowerCase(),
    size: uploaded.bytes || buffer.length,
    kind: "image",
  };
}

module.exports = {
  CHAT_IMAGE_MIMES,
  classifyChatFile,
  validateChatFile,
  validateAvatarFile,
  saveCommunityFile,
  saveAvatarFile,
  destroyCloudinaryAsset,
  openCloudinaryReadStream,
};
