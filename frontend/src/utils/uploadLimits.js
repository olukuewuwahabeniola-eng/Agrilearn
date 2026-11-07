const MB = 1024 * 1024;

/** Keep in sync with backend/src/utils/uploadLimits.js */
export const MAX_PDF_BYTES = 25 * MB;
export const MAX_IMAGE_BYTES = 10 * MB;
export const MAX_IMAGES_TOTAL_BYTES = 50 * MB;
export const MAX_IMAGES_PER_PAPER = 15;
export const MAX_IMAGES_PER_NOTE = MAX_IMAGES_PER_PAPER;

const NOTE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const PDF_TOO_LARGE_MESSAGE =
  "PDF is too large. Please upload a file under 25 MB.";
export const IMAGE_TOO_LARGE_MESSAGE =
  "Image is too large. Please upload a file under 10 MB.";
export const IMAGES_TOTAL_TOO_LARGE_MESSAGE =
  "Combined images exceed 50 MB. Please upload fewer or smaller images.";

/**
 * @param {File | null | undefined} file
 * @returns {string} Error message, or empty string when valid.
 */
export function validatePdfFile(file) {
  if (!file) return "Choose a PDF to upload.";
  const type = String(file.type || "").toLowerCase();
  if (type && type !== "application/pdf") {
    return "Only PDF files are allowed.";
  }
  if (file.size > MAX_PDF_BYTES) {
    return PDF_TOO_LARGE_MESSAGE;
  }
  return "";
}

/**
 * @param {File | null | undefined} file
 * @returns {string} Error message, or empty string when valid.
 */
export function validateImageFile(file) {
  if (!file) return "Choose an image to upload.";
  const type = String(file.type || "").toLowerCase();
  if (
    type &&
    type !== "image/jpeg" &&
    type !== "image/jpg" &&
    type !== "image/png" &&
    type !== "image/webp"
  ) {
    return "Only JPG, JPEG, PNG, or WEBP images are allowed.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return IMAGE_TOO_LARGE_MESSAGE;
  }
  return "";
}

/**
 * @param {File[]} files
 * @returns {string} Error message, or empty string when valid.
 */
export function validateImageFiles(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) {
    return "Choose one or more images for this examination paper.";
  }
  if (list.length > MAX_IMAGES_PER_PAPER) {
    return `You can upload at most ${MAX_IMAGES_PER_PAPER} images per paper.`;
  }

  let total = 0;
  for (const file of list) {
    const type = String(file.type || "").toLowerCase();
    if (
      type &&
      type !== "image/jpeg" &&
      type !== "image/jpg" &&
      type !== "image/png"
    ) {
      return "Only JPG, JPEG, and PNG images are allowed.";
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return IMAGE_TOO_LARGE_MESSAGE;
    }
    total += file.size;
  }

  if (total > MAX_IMAGES_TOTAL_BYTES) {
    return IMAGES_TOTAL_TOO_LARGE_MESSAGE;
  }

  return "";
}

function isAllowedNoteImage(file) {
  const type = String(file?.type || "").toLowerCase();
  if (NOTE_IMAGE_TYPES.has(type)) return true;
  if (!type) return /\.(jpe?g|png|webp)$/i.test(file?.name || "");
  return false;
}

/**
 * Validate images selected as one multi-page lecture note.
 * @param {File[]} files
 * @returns {string} Error message, or empty string when valid.
 */
export function validateNoteImageFiles(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) {
    return "Choose one or more images for this note.";
  }
  if (list.length > MAX_IMAGES_PER_NOTE) {
    return `You can upload at most ${MAX_IMAGES_PER_NOTE} images as one note.`;
  }

  let total = 0;
  for (const file of list) {
    if (!isAllowedNoteImage(file)) {
      return "Only JPG, JPEG, PNG, or WEBP images are allowed.";
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return IMAGE_TOO_LARGE_MESSAGE;
    }
    total += file.size;
  }

  if (total > MAX_IMAGES_TOTAL_BYTES) {
    return IMAGES_TOTAL_TOO_LARGE_MESSAGE;
  }

  return "";
}
