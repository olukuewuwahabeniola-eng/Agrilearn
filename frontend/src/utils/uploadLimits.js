const MB = 1024 * 1024;

/** Keep in sync with backend/src/utils/uploadLimits.js */
export const MAX_PDF_BYTES = 25 * MB;
export const MAX_IMAGE_BYTES = 10 * MB;
export const MAX_IMAGES_TOTAL_BYTES = 50 * MB;
export const MAX_IMAGES_PER_PAPER = 15;
export const MAX_IMAGES_PER_NOTE = MAX_IMAGES_PER_PAPER;

/** Community limits — keep in sync with backend/src/utils/uploadLimits.js */
export const MAX_COMMUNITY_PDF_BYTES = 20 * MB;
export const MAX_COMMUNITY_IMAGE_BYTES = 10 * MB;
export const MAX_COMMUNITY_AVATAR_BYTES = 5 * MB;

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
export const COMMUNITY_PDF_TOO_LARGE_MESSAGE =
  "PDF is too large. Community chat PDFs must be under 20 MB.";
export const COMMUNITY_IMAGE_TOO_LARGE_MESSAGE =
  "Image is too large. Community chat images must be under 10 MB.";
export const COMMUNITY_AVATAR_TOO_LARGE_MESSAGE =
  "Profile picture is too large. Please upload an image under 5 MB.";
export const COMMUNITY_UPLOAD_HINT =
  "Images max 10 MB · PDFs max 20 MB";
export const COMMUNITY_AVATAR_HINT = "JPG, PNG, or WEBP · max 5 MB";

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

function isCommunityImage(file) {
  const type = String(file?.type || "").toLowerCase();
  if (NOTE_IMAGE_TYPES.has(type)) return true;
  if (!type) return /\.(jpe?g|png|webp)$/i.test(file?.name || "");
  return false;
}

/**
 * Validate a Community chat attachment (PDF or image).
 * @param {File | null | undefined} file
 * @returns {string} Error message, or empty string when valid.
 */
export function validateCommunityFile(file) {
  if (!file) return "Choose a PDF or image to share.";
  const type = String(file.type || "").toLowerCase();
  const isPdf = type === "application/pdf" || /\.pdf$/i.test(file.name || "");
  if (isPdf) {
    if (type && type !== "application/pdf") {
      return "Only PDF files are allowed for document shares.";
    }
    if (file.size > MAX_COMMUNITY_PDF_BYTES) {
      return COMMUNITY_PDF_TOO_LARGE_MESSAGE;
    }
    return "";
  }
  if (!isCommunityImage(file)) {
    return "Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.";
  }
  if (file.size > MAX_COMMUNITY_IMAGE_BYTES) {
    return COMMUNITY_IMAGE_TOO_LARGE_MESSAGE;
  }
  return "";
}

/**
 * Validate a student Community profile picture.
 * @param {File | null | undefined} file
 * @returns {string} Error message, or empty string when valid.
 */
export function validateCommunityAvatarFile(file) {
  if (!file) return "Choose an image for your profile picture.";
  if (!isCommunityImage(file)) {
    return "Only JPG, JPEG, PNG, or WEBP images are allowed.";
  }
  if (file.size > MAX_COMMUNITY_AVATAR_BYTES) {
    return COMMUNITY_AVATAR_TOO_LARGE_MESSAGE;
  }
  return "";
}
