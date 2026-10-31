/**
 * Controlled setup: create the first AgriLearn administrator.
 *
 * Usage (from backend/):
 *   set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME in .env (or env)
 *   npm run seed:admin
 *
 * If an admin already exists, the script exits unless ADMIN_FORCE=1.
 */
require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const uri = process.env.MONGODB_URI;
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  const fullName = String(process.env.ADMIN_FULL_NAME || "AgriLearn Admin").trim();
  const force = String(process.env.ADMIN_FORCE || "").trim() === "1";

  if (!uri) {
    console.error("MONGODB_URI is missing. Add it to backend/.env");
    process.exit(1);
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    console.error("Set a valid ADMIN_EMAIL in backend/.env");
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error("Set ADMIN_PASSWORD (at least 8 characters) in backend/.env");
    process.exit(1);
  }

  const { normalizeMongoUri } = require("../config/db");
  await mongoose.connect(normalizeMongoUri(uri), {
    serverSelectionTimeoutMS: 15000,
  });
  console.log("Connected to MongoDB");

  const existingCount = await Admin.countDocuments();
  if (existingCount > 0 && !force) {
    console.error(
      `An administrator already exists (${existingCount}). ` +
        "Refusing to create another. Set ADMIN_FORCE=1 to add another admin."
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const duplicate = await Admin.findOne({ email });
  if (duplicate) {
    console.error(`Admin with email ${email} already exists.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);
  const admin = await Admin.create({
    fullName: fullName.length >= 2 ? fullName : "AgriLearn Admin",
    email,
    password: hashed,
    role: "super_admin",
    assignedLevel: null,
    isActive: true,
  });

  console.log("Super Administrator created successfully:");
  console.log(`  id:    ${admin._id}`);
  console.log(`  name:  ${admin.fullName}`);
  console.log(`  email: ${admin.email}`);
  console.log(`  role:  ${admin.role}`);
  console.log("Log in at /admin/login");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (error) => {
  console.error("seed:admin failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
