const express = require("express");
const cors = require("cors");

// Load .env before anything that needs env vars
require("dotenv").config();

const { connectDB, getDbStatus } = require("./config/db");
const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const supportRoutes = require("./routes/supportRoutes");
const aiRoutes = require("./routes/aiRoutes");
const notesRoutes = require("./routes/notesRoutes");
const pastQuestionRoutes = require("./routes/pastQuestionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminRoutes = require("./routes/adminRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;

function getAllowedOrigins() {
  const fromEnv = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const devDefaults = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ];
  if (process.env.NODE_ENV === "production") {
    return fromEnv;
  }
  return [...new Set([...fromEnv, ...devDefaults])];
}

const allowedOrigins = getAllowedOrigins();

// Allow the React frontend to call this API (credentials needed for admin HTTP-only cookie)
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  })
);

// Read JSON bodies from requests
app.use(express.json());

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/past-questions", pastQuestionRoutes);
app.use("/api/dashboard", dashboardRoutes);
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

  app.listen(PORT, () => {
    console.log(`AgriLearn backend running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Database status: ${getDbStatus()}`);
  });
}

startServer();
