const { Readable } = require("stream");
const { v2: cloudinary } = require("cloudinary");

const STORAGE_PREFIX = "cloudinary:";
const DEFAULT_FOLDER = "agrilearn";

let configured = false;

function envValue(name) {
  const value = process.env[name];
  if (value == null) return "";
  return String(value).trim().replace(/^["']|["']$/g, "");
}

function getCloudinaryFolder() {
  const configuredFolder = envValue("CLOUDINARY_FOLDER");
  if (configuredFolder) {
    return configuredFolder.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
  }
  return DEFAULT_FOLDER;
}

function cloudinaryCredentialStatus() {
  return {
    cloudName: Boolean(envValue("CLOUDINARY_CLOUD_NAME")),
    apiKey: Boolean(envValue("CLOUDINARY_API_KEY")),
    apiSecret: Boolean(envValue("CLOUDINARY_API_SECRET")),
    folder: getCloudinaryFolder(),
  };
}

function isCloudinaryConfigured() {
  const status = cloudinaryCredentialStatus();
  return status.cloudName && status.apiKey && status.apiSecret;
}

function logCloudinaryConfigStatus(context) {
  const status = cloudinaryCredentialStatus();
  console.log(
    `[cloudinary] ${context} configured=${status.cloudName && status.apiKey && status.apiSecret} cloudName=${status.cloudName} apiKey=${status.apiKey} apiSecret=${status.apiSecret} folder=${status.folder}`
  );
}

function ensureCloudinaryConfigured() {
  if (!isCloudinaryConfigured()) {
    logCloudinaryConfigStatus("missing credentials");
    const error = new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
    error.code = "CLOUDINARY_NOT_CONFIGURED";
    throw error;
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: envValue("CLOUDINARY_CLOUD_NAME"),
      api_key: envValue("CLOUDINARY_API_KEY"),
      api_secret: envValue("CLOUDINARY_API_SECRET"),
      secure: true,
    });
    configured = true;
    logCloudinaryConfigStatus("sdk configured");
  }
}

/**
 * Safe Cloudinary error line for Render logs. Never includes secrets.
 */
function logCloudinaryFailure(context, error, extra) {
  const httpCode =
    error?.http_code ||
    error?.cause?.http_code ||
    error?.error?.http_code ||
    "";
  const message = String(
    error?.message || error?.cause?.message || "unknown cloudinary error"
  )
    .replace(/cloudinary:\/\/\S+/gi, "[redacted]")
    .replace(/api_secret[=:]\S+/gi, "api_secret=[redacted]")
    .slice(0, 400);
  const detail = extra ? ` ${extra}` : "";
  console.error(
    `[cloudinary] ${context} code=${error?.code || ""} http=${httpCode || "n/a"} message=${message}${detail}`
  );
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
  // Keep the extension on the public_id for raw PDFs. Cloudinary rejects
  // resource_type=raw together with the format option.
  const publicIdWithExt =
    resourceType === "raw" && format && format !== "bin"
      ? `${publicId}.${format}`
      : publicId;

  return new Promise((resolve, reject) => {
    const options = {
      resource_type: resourceType,
      public_id: publicIdWithExt,
      // Authenticated assets require signed access; backend streams them after JWT checks.
      type: "authenticated",
      overwrite: false,
      unique_filename: false,
      use_filename: false,
    };
    if (resourceType === "image") {
      options.format = format;
    }

    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        logCloudinaryFailure("upload failed", error, `resource=${resourceType}`);
        const wrapped = new Error(error.message || "Cloudinary upload failed.");
        wrapped.code = "CLOUDINARY_UPLOAD_FAILED";
        wrapped.http_code = error.http_code;
        wrapped.cause = error;
        reject(wrapped);
        return;
      }
      if (!result?.public_id) {
        logCloudinaryFailure(
          "upload failed",
          new Error("Cloudinary upload returned no public_id."),
          `resource=${resourceType}`
        );
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
    });

    stream.on("error", (error) => {
      logCloudinaryFailure("upload stream error", error, `resource=${resourceType}`);
      const wrapped = new Error(error.message || "Cloudinary upload stream failed.");
      wrapped.code = "CLOUDINARY_UPLOAD_FAILED";
      reject(wrapped);
    });

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
    error.http_code = response.status;
    logCloudinaryFailure("download failed", error);
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
    error.http_code = response.status;
    logCloudinaryFailure("stream failed", error);
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
    logCloudinaryFailure("delete warning", error);
  }
}

module.exports = {
  STORAGE_PREFIX,
  DEFAULT_FOLDER,
  getCloudinaryFolder,
  cloudinaryCredentialStatus,
  isCloudinaryConfigured,
  logCloudinaryConfigStatus,
  logCloudinaryFailure,
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
