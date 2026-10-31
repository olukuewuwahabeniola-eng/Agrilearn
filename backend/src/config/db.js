const mongoose = require("mongoose");

let isConnected = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let handlersRegistered = false;

mongoose.set("bufferCommands", false);

const MAX_STARTUP_RETRIES = 5;
const STARTUP_RETRY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

/**
 * Optional explicit DB name from env. Never invent a new default DB name —
 * changing it silently (e.g. to "agrilearn") points at an empty database and
 * breaks existing admin/student accounts that already live in Atlas "test".
 */
function getExplicitDbName() {
  if (!Object.prototype.hasOwnProperty.call(process.env, "MONGODB_DB_NAME")) {
    return "";
  }
  const name = String(process.env.MONGODB_DB_NAME || "").trim();
  return name.replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Preserve the URI database path. Only fill a missing path when MONGODB_DB_NAME
 * is set. Always add recommended Atlas query params when absent.
 */
function normalizeMongoUri(rawUri) {
  const explicitDb = getExplicitDbName();
  let uri = String(rawUri || "").trim();
  if (!uri) return uri;

  const qIndex = uri.indexOf("?");
  const basePart = qIndex === -1 ? uri : uri.slice(0, qIndex);
  const queryPart = qIndex === -1 ? "" : uri.slice(qIndex + 1);

  const match = basePart.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/(.*))?$/);
  if (!match) return uri;

  const hostBase = match[1];
  const pathSegment = (match[2] || "").replace(/\/+$/, "");

  let withDb = basePart;
  if (pathSegment) {
    withDb = `${hostBase}/${pathSegment.split("/")[0]}`;
  } else if (explicitDb) {
    withDb = `${hostBase}/${explicitDb}`;
  } else {
    // Keep path empty so the driver uses its historical default (usually "test").
    withDb = `${hostBase}/`;
  }

  const params = new URLSearchParams(queryPart);
  if (!params.has("retryWrites")) params.set("retryWrites", "true");
  if (!params.has("w")) params.set("w", "majority");

  const qs = params.toString();
  return qs ? `${withDb}?${qs}` : withDb;
}

function getMongoOptions() {
  return {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    autoIndex: process.env.NODE_ENV !== "production",
  };
}

/**
 * Hide passwords / connection strings if they appear in error text.
 */
function sanitizeErrorMessage(message) {
  return String(message)
    .replace(/mongodb(\+srv)?:\/\/\S+/gi, "[REDACTED_URI]")
    .replace(/:([^:@/]+)@/g, ":***@");
}

function registerConnectionHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  mongoose.connection.on("connected", () => {
    isConnected = true;
    reconnectAttempts = 0;
  });

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.warn("MongoDB disconnected — scheduling reconnect…");
    scheduleReconnect(STARTUP_RETRY_MS);
  });

  mongoose.connection.on("error", (err) => {
    isConnected = false;
    console.error("MongoDB connection error:", sanitizeErrorMessage(err.message));
  });
}

function scheduleReconnect(delayMs) {
  if (reconnectTimer) return;
  const delay = Math.min(
    MAX_RECONNECT_DELAY_MS,
    Math.max(STARTUP_RETRY_MS, delayMs)
  );
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await attemptReconnect();
  }, delay);
}

async function attemptReconnect() {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return true;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri?.trim()) return false;

  reconnectAttempts += 1;
  try {
    await mongoose.connect(normalizeMongoUri(uri), getMongoOptions());
    isConnected = true;
    reconnectAttempts = 0;
    console.log("MongoDB reconnected successfully");
    return true;
  } catch (error) {
    isConnected = false;
    const safeMessage = sanitizeErrorMessage(error.message);
    console.error(
      `MongoDB reconnect attempt ${reconnectAttempts} failed:`,
      safeMessage
    );
    scheduleReconnect(STARTUP_RETRY_MS * reconnectAttempts);
    return false;
  }
}

/**
 * Connect to MongoDB using MONGODB_URI from .env (call after dotenv loads).
 */
async function connectDB() {
  registerConnectionHandlers();

  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.trim()) {
    isConnected = false;
    throw new Error(
      "MONGODB_URI is missing or empty. Add your Atlas connection string to backend/.env"
    );
  }

  const normalized = normalizeMongoUri(uri);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_STARTUP_RETRIES; attempt += 1) {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect().catch(() => {});
      }
      await mongoose.connect(normalized, getMongoOptions());
      isConnected = true;
      console.log("MongoDB connected successfully");
      if (attempt > 1) {
        console.log(`Connected on attempt ${attempt}/${MAX_STARTUP_RETRIES}`);
      }
      return true;
    } catch (error) {
      lastError = error;
      isConnected = false;
      const safeMessage = sanitizeErrorMessage(error.message);
      console.error(
        `MongoDB connection attempt ${attempt}/${MAX_STARTUP_RETRIES} failed:`,
        safeMessage
      );
      if (attempt < MAX_STARTUP_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, STARTUP_RETRY_MS));
      }
    }
  }

  console.error(
    "Tip: MongoDB Atlas → Network Access → add your current IP or 0.0.0.0/0 (dev only), then restart the backend."
  );
  console.error(
    "Tip: Or set MONGODB_URI to a local instance, e.g. mongodb://127.0.0.1:27017/agrilearn (see docker-compose.yml)."
  );
  scheduleReconnect(STARTUP_RETRY_MS);
  throw lastError || new Error("MongoDB connection failed");
}

function getDbStatus() {
  const ready = mongoose.connection.readyState === 1;
  isConnected = ready;
  return ready ? "connected" : "disconnected";
}

function isDbConnected() {
  return getDbStatus() === "connected";
}

module.exports = {
  connectDB,
  attemptReconnect,
  getDbStatus,
  isDbConnected,
  normalizeMongoUri,
};
