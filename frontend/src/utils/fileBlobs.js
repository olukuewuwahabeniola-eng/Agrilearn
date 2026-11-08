/**
 * Ensure streamed files keep a usable MIME type for in-app viewing.
 * Cloudinary/legacy records sometimes arrive as application/octet-stream.
 */

export function typedBlob(blob, mimeType) {
  if (!blob) return blob;
  const type = String(blob.type || "").toLowerCase();
  if (type && type !== "application/octet-stream") return blob;
  return new Blob([blob], { type: mimeType || "application/octet-stream" });
}

export function pdfBlob(blob) {
  return typedBlob(blob, "application/pdf");
}

export function objectUrlForBlob(blob, mimeType) {
  return URL.createObjectURL(typedBlob(blob, mimeType));
}
