const MB = 1024 * 1024;

/** Lecture notes, past-question PDFs, and AI/device PDF uploads. */
const MAX_PDF_BYTES = 25 * MB;

/** Per-image limit for past-question page scans (JPG/JPEG/PNG). */
const MAX_IMAGE_BYTES = 10 * MB;

/** Combined size when multiple images are uploaded as one paper. */
const MAX_IMAGES_TOTAL_BYTES = 50 * MB;

/** Maximum number of image pages per past-question paper or multi-page note. */
const MAX_IMAGES_PER_PAPER = 15;
const MAX_IMAGES_PER_NOTE = MAX_IMAGES_PER_PAPER;

function pdfTooLargeMessage() {
  return "PDF is too large. Please upload a file under 25 MB.";
}

function imageTooLargeMessage() {
  return "Image is too large. Please upload a file under 10 MB.";
}

function imagesTotalTooLargeMessage() {
  return "Combined images exceed 50 MB. Please upload fewer or smaller images.";
}

function pastQuestionMulterSizeMessage() {
  return "A file exceeds the size limit (PDF 25 MB, images 10 MB).";
}

function imagesCountTooLargeMessage(max = MAX_IMAGES_PER_NOTE) {
  return `You can upload at most ${max} images as one note.`;
}

module.exports = {
  MB,
  MAX_PDF_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_TOTAL_BYTES,
  MAX_IMAGES_PER_PAPER,
  MAX_IMAGES_PER_NOTE,
  pdfTooLargeMessage,
  imageTooLargeMessage,
  imagesTotalTooLargeMessage,
  imagesCountTooLargeMessage,
  pastQuestionMulterSizeMessage,
};
