function looksLikePdf(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString("latin1") === "%PDF-"
  );
}

function looksLikeJpeg(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

function looksLikePng(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

function looksLikeWebp(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  );
}

function assertFileSignature(buffer, mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  let ok = false;

  if (mime === "application/pdf") ok = looksLikePdf(buffer);
  else if (mime === "image/jpeg" || mime === "image/jpg") ok = looksLikeJpeg(buffer);
  else if (mime === "image/png") ok = looksLikePng(buffer);
  else if (mime === "image/webp") ok = looksLikeWebp(buffer);

  if (!ok) {
    const error = new Error("File content does not match the allowed type.");
    error.code = "INVALID_MIME";
    throw error;
  }
}

module.exports = {
  assertFileSignature,
  looksLikePdf,
  looksLikeJpeg,
  looksLikePng,
  looksLikeWebp,
};
