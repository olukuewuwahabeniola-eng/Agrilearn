/**
 * Shared Content-Type / Content-Disposition for streamed files.
 * View uses inline + PDF/image MIME; Download uses attachment.
 */

function isPdf(mimeType, filename = "") {
  const mime = String(mimeType || "").toLowerCase();
  return mime === "application/pdf" || /\.pdf$/i.test(String(filename));
}

function resolveContentType(mimeType, filename = "") {
  const mime = String(mimeType || "").toLowerCase().trim();
  if (isPdf(mime, filename)) return "application/pdf";
  if (mime.startsWith("image/")) return mime;
  if (mime && mime !== "application/octet-stream") return mime;
  return "application/octet-stream";
}

function contentDisposition(filename = "file", download = false) {
  const safe = encodeURIComponent(String(filename || "file").replace(/"/g, ""));
  return `${download ? "attachment" : "inline"}; filename="${safe}"`;
}

function setFileStreamHeaders(res, { mimeType, filename, download = false, size } = {}) {
  res.setHeader("Content-Type", resolveContentType(mimeType, filename));
  res.setHeader("Content-Disposition", contentDisposition(filename, download));
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (size) res.setHeader("Content-Length", String(size));
}

function isDownloadQuery(req) {
  return String(req?.query?.download || "") === "1";
}

module.exports = {
  isPdf,
  resolveContentType,
  contentDisposition,
  setFileStreamHeaders,
  isDownloadQuery,
};
