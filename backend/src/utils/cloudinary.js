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

/**
 * Resolve credentials from the three standard env vars, or from CLOUDINARY_URL
 * (cloudinary://API_KEY:API_SECRET@CLOUD_NAME) when those are empty.
 * Same credential source for notes, past questions, and Community uploads.
 */
function resolveCloudinaryCredentials() {
  let cloudName = envValue("CLOUDINARY_CLOUD_NAME");
  let apiKey = envValue("CLOUDINARY_API_KEY");
  let apiSecret = envValue("CLOUDINARY_API_SECRET");

  if (!cloudName || !apiKey || !apiSecret) {
    const url = envValue("CLOUDINARY_URL");
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "cloudinary:") {
          cloudName = cloudName || decodeURIComponent(parsed.hostname || "");
          apiKey = apiKey || decodeURIComponent(parsed.username || "");
          apiSecret = apiSecret || decodeURIComponent(parsed.password || "");
        }
      } catch {
        /* ignore malformed CLOUDINARY_URL */
      }
    }
  }

  return { cloudName, apiKey, apiSecret };
}

function getCloudinaryFolder() {
  const configuredFolder = envValue("CLOUDINARY_FOLDER");
  if (configuredFolder) {
    return configuredFolder.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
  }
  return DEFAULT_FOLDER;
}

function cloudinaryCredentialStatus() {
  const credentials = resolveCloudinaryCredentials();
  return {
    cloudName: Boolean(credentials.cloudName),
    apiKey: Boolean(credentials.apiKey),
    apiSecret: Boolean(credentials.apiSecret),
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
    const credentials = resolveCloudinaryCredentials();
    cloudinary.config({
      cloud_name: credentials.cloudName,
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
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
  if (mime === "image/webp") return "webp";
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

function extractFormatFromPublicId(publicId) {
  const match = String(publicId || "").match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Build a short-lived Admin API download URL for authenticated/private assets.
 * Delivery URLs from cloudinary.url(..., { sign_url: true }) return HTTP 401 for
 * type=authenticated resources — private_download_url is the correct retrieval API.
 */
function buildPrivateDownloadUrl({
  resourceType,
  publicId,
  format,
  deliveryType,
}) {
  ensureCloudinaryConfigured();
  return cloudinary.utils.private_download_url(publicId, format || null, {
    resource_type: resourceType,
    type: deliveryType,
    expires_at: Math.floor(Date.now() / 1000) + 600,
  });
}

function downloadAttemptsFor(storagePath) {
  const { resourceType, publicId } = parseCloudinaryStoragePath(storagePath);
  const format = extractFormatFromPublicId(publicId);
  const withoutExt = format
    ? publicId.slice(0, -(format.length + 1))
    : publicId;

  // Uploads use type=authenticated. Keep that first. Extra attempts only cover
  // public_id/format edge cases — never switches assets to public delivery.
  const attempts = [
    {
      resourceType,
      publicId,
      format: format || null,
      deliveryType: "authenticated",
      label: "authenticated-full-id",
    },
  ];

  if (format && withoutExt && withoutExt !== publicId) {
    attempts.push({
      resourceType,
      publicId: withoutExt,
      format,
      deliveryType: "authenticated",
      label: "authenticated-id-plus-format",
    });
  }

  return attempts;
}

async function fetchCloudinaryResponse(storagePath) {
  ensureCloudinaryConfigured();
  const attempts = downloadAttemptsFor(storagePath);
  let lastStatus = 0;
  let lastLabel = "";

  for (const attempt of attempts) {
    const url = buildPrivateDownloadUrl(attempt);
    lastLabel = attempt.label;
    let response;
    try {
      response = await fetch(url);
    } catch (error) {
      logCloudinaryFailure(
        "download network error",
        error,
        `resource=${attempt.resourceType} attempt=${attempt.label}`
      );
      continue;
    }

    if (response.ok) {
      return response;
    }

    lastStatus = response.status;
    logCloudinaryFailure(
      "download attempt failed",
      {
        code: "CLOUDINARY_DOWNLOAD_FAILED",
        http_code: response.status,
        message: `Cloudinary download attempt failed (${response.status}).`,
      },
      `resource=${attempt.resourceType} attempt=${attempt.label}`
    );
  }

  const error = new Error(
    `Cloudinary download failed (${lastStatus || "unknown"}).`
  );
  error.code = "CLOUDINARY_DOWNLOAD_FAILED";
  error.http_code = lastStatus || 401;
  logCloudinaryFailure("download failed", error, `lastAttempt=${lastLabel}`);
  throw error;
}

async function downloadCloudinaryBuffer(storagePath) {
  const response = await fetchCloudinaryResponse(storagePath);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function openCloudinaryReadStream(storagePath) {
  const response = await fetchCloudinaryResponse(storagePath);
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
  downloadAttemptsFor,
  buildPrivateDownloadUrl,
  resourceTypeForMime,
  sanitizeSegment,
};
