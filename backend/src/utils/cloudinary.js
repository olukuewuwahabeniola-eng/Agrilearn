const { Readable } = require("stream");
const { v2: cloudinary } = require("cloudinary");

const STORAGE_PREFIX = "cloudinary:";
const DEFAULT_FOLDER = "agrilearn";

let configured = false;

function getCloudinaryFolder() {
  const configuredFolder = process.env.CLOUDINARY_FOLDER;
  if (configuredFolder && configuredFolder.trim()) {
    return configuredFolder
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .replace(/\/+/g, "/");
  }
  return DEFAULT_FOLDER;
}

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function ensureCloudinaryConfigured() {
  if (!isCloudinaryConfigured()) {
    const error = new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
    error.code = "CLOUDINARY_NOT_CONFIGURED";
    throw error;
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
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

function resourceTypeForMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  return "raw";
}

function extensionForMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  return "bin";
}

/**
 * Encode Cloudinary location for MongoDB storagePath.
 * Format: cloudinary:{resourceType}:{publicId}
 * Listings never expose signed/public URLs — only this opaque path.
 */
function encodeCloudinaryStoragePath(resourceType, publicId) {
  return `${STORAGE_PREFIX}${resourceType}:${publicId}`;
}

function isCloudinaryStoragePath(storagePath) {
  return String(storagePath || "").startsWith(STORAGE_PREFIX);
}

function parseCloudinaryStoragePath(storagePath) {
  const value = String(storagePath || "");
  if (!isCloudinaryStoragePath(value)) {
    const error = new Error("Not a Cloudinary storage path.");
    error.code = "NOT_CLOUDINARY_PATH";
    throw error;
  }

  const payload = value.slice(STORAGE_PREFIX.length);
  const separator = payload.indexOf(":");
  if (separator <= 0) {
    const error = new Error("Invalid Cloudinary storage path.");
    error.code = "INVALID_CLOUDINARY_PATH";
    throw error;
  }

  const resourceType = payload.slice(0, separator);
  const publicId = payload.slice(separator + 1);
  if (!resourceType || !publicId) {
    const error = new Error("Invalid Cloudinary storage path.");
    error.code = "INVALID_CLOUDINARY_PATH";
    throw error;
  }

  return { resourceType, publicId };
}

function buildPublicId({ folderParts, storedName }) {
  const root = getCloudinaryFolder();
  const parts = [root, ...(folderParts || [])]
    .map((part) => sanitizeSegment(part))
    .filter(Boolean);
  const name = String(storedName || "file")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
  return [...parts, name || "file"].join("/");
}

function uploadBuffer({
  buffer,
  mimeType,
  folderParts,
  storedName,
  originalName,
}) {
  ensureCloudinaryConfigured();

  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error("File content is empty.");
    error.code = "EMPTY_FILE";
    throw error;
  }

  const resourceType = resourceTypeForMime(mimeType);
  const publicId = buildPublicId({ folderParts, storedName });
  const format = extensionForMime(mimeType);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        public_id: publicId,
        // Authenticated assets require signed access; backend streams them after JWT checks.
        type: "authenticated",
        overwrite: false,
        unique_filename: false,
        use_filename: false,
        format,
        context: originalName
          ? `original_filename=${String(originalName).slice(0, 180)}`
          : undefined,
      },
      (error, result) => {
        if (error) {
          const wrapped = new Error(
            error.message || "Cloudinary upload failed."
          );
          wrapped.code = "CLOUDINARY_UPLOAD_FAILED";
          wrapped.cause = error;
          reject(wrapped);
          return;
        }
        if (!result?.public_id) {
          const wrapped = new Error("Cloudinary upload returned no public_id.");
          wrapped.code = "CLOUDINARY_UPLOAD_FAILED";
          reject(wrapped);
          return;
        }

        resolve({
          publicId: result.public_id,
          resourceType: result.resource_type || resourceType,
          bytes: result.bytes || buffer.length,
          format: result.format || format,
          storagePath: encodeCloudinaryStoragePath(
            result.resource_type || resourceType,
            result.public_id
          ),
        });
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

function signedDownloadUrl(storagePath) {
  ensureCloudinaryConfigured();
  const { resourceType, publicId } = parseCloudinaryStoragePath(storagePath);
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
}

async function downloadCloudinaryBuffer(storagePath) {
  const url = signedDownloadUrl(storagePath);
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(
      `Cloudinary download failed (${response.status}).`
    );
    error.code = "CLOUDINARY_DOWNLOAD_FAILED";
    throw error;
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function openCloudinaryReadStream(storagePath) {
  const url = signedDownloadUrl(storagePath);
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(
      `Cloudinary stream failed (${response.status}).`
    );
    error.code = "CLOUDINARY_DOWNLOAD_FAILED";
    throw error;
  }
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return Readable.from(buffer);
  }
  return Readable.fromWeb(response.body);
}

async function destroyCloudinaryAsset(storagePath) {
  if (!isCloudinaryStoragePath(storagePath)) return;
  if (!isCloudinaryConfigured()) {
    console.error(
      "Cloudinary delete skipped: credentials not configured for",
      storagePath
    );
    return;
  }

  ensureCloudinaryConfigured();
  const { resourceType, publicId } = parseCloudinaryStoragePath(storagePath);

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: "authenticated",
      invalidate: true,
    });
  } catch (error) {
    console.error("Cloudinary delete warning:", error.message || error);
  }
}

module.exports = {
  STORAGE_PREFIX,
  DEFAULT_FOLDER,
  getCloudinaryFolder,
  isCloudinaryConfigured,
  isCloudinaryStoragePath,
  parseCloudinaryStoragePath,
  encodeCloudinaryStoragePath,
  uploadBuffer,
  downloadCloudinaryBuffer,
  openCloudinaryReadStream,
  destroyCloudinaryAsset,
  resourceTypeForMime,
  sanitizeSegment,
};
