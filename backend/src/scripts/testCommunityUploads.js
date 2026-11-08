/**
 * Community upload limit + Cloudinary wiring checks.
 * Does not require a running server or live Cloudinary credentials.
 */
const assert = require("assert");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const {
  MAX_PDF_BYTES,
  MAX_IMAGE_BYTES,
  MAX_COMMUNITY_PDF_BYTES,
  MAX_COMMUNITY_IMAGE_BYTES,
  MAX_COMMUNITY_AVATAR_BYTES,
  pdfTooLargeMessage,
  imageTooLargeMessage,
} = require("../utils/uploadLimits");
const {
  validateChatFile,
  validateAvatarFile,
} = require("../utils/communityStorage");
const {
  isCloudinaryConfigured,
  cloudinaryCredentialStatus,
} = require("../utils/cloudinary");

function expectReject(fn, code) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    assert.strictEqual(error.code, code, error.message);
  }
  assert.ok(threw, "expected rejection");
}

function validateNotesSize(buffer, mimeType) {
  const isPdf = String(mimeType || "").toLowerCase() === "application/pdf";
  const max = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (buffer.length > max) {
    const error = new Error(isPdf ? pdfTooLargeMessage() : imageTooLargeMessage());
    error.code = "LIMIT_FILE_SIZE";
    throw error;
  }
}

function withSignature(size, kind) {
  const buffer = Buffer.alloc(size);
  if (kind === "jpeg") {
    buffer[0] = 0xff;
    buffer[1] = 0xd8;
    buffer[2] = 0xff;
  } else if (kind === "png") {
    buffer[0] = 0x89;
    buffer[1] = 0x50;
    buffer[2] = 0x4e;
    buffer[3] = 0x47;
  } else if (kind === "pdf") {
    buffer.write("%PDF-", 0, "ascii");
  }
  return buffer;
}

function run() {
  assert.strictEqual(MAX_COMMUNITY_AVATAR_BYTES, 5 * 1024 * 1024);
  assert.strictEqual(MAX_COMMUNITY_IMAGE_BYTES, 10 * 1024 * 1024);
  assert.strictEqual(MAX_COMMUNITY_PDF_BYTES, 20 * 1024 * 1024);
  assert.strictEqual(MAX_PDF_BYTES, 25 * 1024 * 1024);
  assert.strictEqual(MAX_IMAGE_BYTES, 10 * 1024 * 1024);

  const underAvatar = withSignature(MAX_COMMUNITY_AVATAR_BYTES, "jpeg");
  const overAvatar = withSignature(MAX_COMMUNITY_AVATAR_BYTES + 1, "jpeg");
  assert.strictEqual(validateAvatarFile(underAvatar, "image/jpeg"), "image");
  expectReject(() => validateAvatarFile(overAvatar, "image/jpeg"), "LIMIT_FILE_SIZE");

  const underImage = withSignature(MAX_COMMUNITY_IMAGE_BYTES, "png");
  const overImage = withSignature(MAX_COMMUNITY_IMAGE_BYTES + 1, "png");
  assert.strictEqual(validateChatFile(underImage, "image/png"), "image");
  expectReject(() => validateChatFile(overImage, "image/png"), "LIMIT_FILE_SIZE");

  const underPdf = withSignature(MAX_COMMUNITY_PDF_BYTES, "pdf");
  const overPdf = withSignature(MAX_COMMUNITY_PDF_BYTES + 1, "pdf");
  assert.strictEqual(validateChatFile(underPdf, "application/pdf"), "pdf");
  expectReject(() => validateChatFile(overPdf, "application/pdf"), "LIMIT_FILE_SIZE");

  expectReject(
    () => validateChatFile(Buffer.from("not-a-pdf"), "application/pdf"),
    "INVALID_MIME"
  );
  expectReject(
    () => validateAvatarFile(Buffer.from("%PDF-fake"), "image/jpeg"),
    "INVALID_MIME"
  );

  // A 21 MB PDF is rejected by Community (20 MB) but still under notes/PQ (25 MB).
  const notesPdfOk = Buffer.alloc(MAX_COMMUNITY_PDF_BYTES + 1024);
  validateNotesSize(notesPdfOk, "application/pdf");
  expectReject(
    () => validateChatFile(notesPdfOk, "application/pdf"),
    "LIMIT_FILE_SIZE"
  );

  const status = cloudinaryCredentialStatus();
  console.log(
    `[testCommunityUploads] cloudinary configured=${isCloudinaryConfigured()} cloudName=${status.cloudName} apiKey=${status.apiKey} apiSecret=${status.apiSecret}`
  );

  console.log("testCommunityUploads: all size-limit checks passed");
}

run();
