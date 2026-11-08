const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

// Load .env before anything that needs env vars (always from backend/.env)
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { connectDB, getDbStatus } = require("./config/db");
const {
  isCloudinaryConfigured,
  logCloudinaryConfigStatus,
} = require("./utils/cloudinary");
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const supportRoutes = require("./routes/supportRoutes");
const aiRoutes = require("./routes/aiRoutes");
const notesRoutes = require("./routes/notesRoutes");
const pastQuestionRoutes = require("./routes/pastQuestionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const communityRoutes = require("./routes/communityRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { attachCommunitySocket } = require("./realtime/communitySocket");
const { setCommunityIo } = require("./utils/communityRealtime");
const errorHandler = require("./middleware/errorHandler");
const securityHeaders = require("./middleware/securityHeaders");

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

if (process.env.TRUST_PROXY === "1" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

function normalizeOrigin(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();
}

function getAllowedOrigins() {
  const fromEnv = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
  const productionFrontends = [
    "https://myagrilearn.vercel.app",
    "https://frontend-six-kappa-93.vercel.app",
  ];
  const devDefaults = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ];
  if (process.env.NODE_ENV === "production") {
    return [...new Set([...fromEnv, ...productionFrontends])];
  }
  return [...new Set([...fromEnv, ...productionFrontends, ...devDefaults])];
}

const allowedOrigins = getAllowedOrigins();

function allowCorsOrigin(origin, callback) {
  if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
    callback(null, true);
    return;
  }
  callback(null, false);
}

const io = new Server(httpServer, {
  cors: {
    origin: allowCorsOrigin,
    credentials: true,
  },
  transports: ["websocket", "polling"],
});
app.set("io", io);
setCommunityIo(io);
attachCommunitySocket(io);

app.use(securityHeaders);

// Allow the React frontend to call this API (credentials needed for admin HTTP-only cookie)
app.use(
  cors({
    origin: allowCorsOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/past-questions", pastQuestionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/admin", adminRoutes);

// Simple root message
app.get("/", (req, res) => {
  res.json({
    message: "AgriLearn API is running. Try GET /api/health",
    database: getDbStatus(),
  });
});

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    await connectDB();
  } catch (error) {
    console.error(
      "Server will start without a database connection. Fix MONGODB_URI and restart."
    );
  }

  logCloudinaryConfigStatus("startup");
  if (!isCloudinaryConfigured()) {
    console.error(
      "[cloudinary] uploads will fail until CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set"
    );
  }

  httpServer.listen(PORT, () => {
    console.log(`AgriLearn backend running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Database status: ${getDbStatus()}`);
  });
}

startServer();
