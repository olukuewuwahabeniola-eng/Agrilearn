const assert = require("assert");
const bcrypt = require("bcryptjs");
const {
  RESET_TTL_MS,
  GENERIC_RESET_REQUEST_MESSAGE,
  generateResetToken,
  hashResetToken,
  resetExpiryDate,
  evaluateResetToken,
  resetFailureMessage,
  takeRateLimit,
  validateStudentResetPassword,
  validateAdminPassword,
  buildStudentResetUrl,
  buildAdminResetUrl,
  clearRateLimitStore,
  isValidEmail,
} = require("../utils/passwordReset");

function run() {
  clearRateLimitStore();

  assert.strictEqual(RESET_TTL_MS, 30 * 60 * 1000);
  assert.ok(GENERIC_RESET_REQUEST_MESSAGE.toLowerCase().includes("if that email"));

  const first = generateResetToken();
  const second = generateResetToken();
  assert.notStrictEqual(first.token, second.token);
  assert.strictEqual(first.hash, hashResetToken(first.token));
  assert.notStrictEqual(first.token, first.hash);
  assert.ok(!first.hash.includes(first.token));

  const record = {
    passwordResetTokenHash: first.hash,
    passwordResetExpiresAt: resetExpiryDate(),
  };
  assert.strictEqual(evaluateResetToken(record, first.token).ok, true);
  assert.strictEqual(evaluateResetToken(record, second.token).reason, "invalid");
  assert.strictEqual(evaluateResetToken(null, first.token).reason, "invalid");
  assert.strictEqual(evaluateResetToken(record, "").reason, "invalid");

  const expired = {
    passwordResetTokenHash: first.hash,
    passwordResetExpiresAt: new Date(Date.now() - 1000),
  };
  assert.strictEqual(evaluateResetToken(expired, first.token).reason, "expired");
  assert.ok(resetFailureMessage("expired").toLowerCase().includes("expired"));

  const used = {
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
  };
  assert.strictEqual(evaluateResetToken(used, first.token).reason, "invalid");
  assert.ok(resetFailureMessage("invalid").toLowerCase().includes("already been used"));

  const studentPw = validateStudentResetPassword("newpass99", "newpass99");
  assert.strictEqual(studentPw.ok, true);
  assert.strictEqual(validateStudentResetPassword("short", "short").ok, false);
  assert.strictEqual(
    validateStudentResetPassword("newpass99", "otherpass99").message,
    "Passwords do not match."
  );

  const adminPw = validateAdminPassword("Adminpass1", "Adminpass1");
  assert.strictEqual(adminPw.ok, true);
  assert.strictEqual(validateAdminPassword("allletters", "allletters").ok, false);

  assert.strictEqual(isValidEmail("student@example.com"), true);
  assert.strictEqual(isValidEmail("not-an-email"), false);

  const studentUrl = buildStudentResetUrl(first.token);
  const adminUrl = buildAdminResetUrl(first.token);
  assert.ok(studentUrl.includes("/reset-password?token="));
  assert.ok(adminUrl.includes("/admin/reset-password?token="));
  assert.ok(!studentUrl.includes("/admin/"));

  const limitKey = "test-ip";
  for (let i = 0; i < 3; i += 1) {
    assert.strictEqual(takeRateLimit(limitKey, 3).ok, true);
  }
  assert.strictEqual(takeRateLimit(limitKey, 3).ok, false);

  const fakeHash = "not-a-real-password-hash";
  assert.notStrictEqual(fakeHash, first.token);

  console.log("testPasswordReset: token, expiry, reuse, validation, and rate-limit checks passed");
}

async function hashSanity() {
  const hashed = await bcrypt.hash("RecoverMe1", 12);
  const match = await bcrypt.compare("RecoverMe1", hashed);
  assert.strictEqual(match, true);
  assert.notStrictEqual(hashed, "RecoverMe1");
}

async function liveStoreChecks() {
  const path = require("path");
  require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
  const mongoose = require("mongoose");
  const uri = String(process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.log("testPasswordReset: skipped live Mongo checks (no MONGODB_URI)");
    return;
  }

  const Student = require("../models/Student");
  const Admin = require("../models/Admin");
  const {
    resetStudentPassword,
    resetAdminPassword,
    requestStudentReset,
    requestAdminReset,
  } = require("../controllers/passwordResetController");

  function mockReq(body, ip = "127.0.0.1") {
    return {
      body,
      query: {},
      headers: {},
      socket: { remoteAddress: ip },
    };
  }

  function mockRes() {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    return res;
  }

  await mongoose.connect(uri);
  const stamp = Date.now();
  const studentEmail = `reset.student.${stamp}@agrilearn.test`;
  const adminEmail = `reset.admin.${stamp}@agrilearn.test`;
  let student;
  let admin;

  try {
    const unknown = mockRes();
    await requestStudentReset(mockReq({ email: "nobody-reset@example.com" }, "10.0.0.8"), unknown);
    assert.strictEqual(unknown.statusCode, 200);
    assert.strictEqual(unknown.body.message, GENERIC_RESET_REQUEST_MESSAGE);

    const adminUnknown = mockRes();
    await requestAdminReset(mockReq({ email: "nobody-admin-reset@example.com" }, "10.0.0.9"), adminUnknown);
    assert.strictEqual(adminUnknown.statusCode, 200);
    assert.strictEqual(adminUnknown.body.message, GENERIC_RESET_REQUEST_MESSAGE);

    const invalid = mockRes();
    await requestStudentReset(mockReq({ email: "not-an-email" }, "10.0.0.10"), invalid);
    assert.strictEqual(invalid.statusCode, 400);

    student = await Student.create({
      fullName: "Reset Test Student",
      email: studentEmail,
      matricNumber: `RST${stamp}`.slice(0, 16),
      level: "200",
      password: await bcrypt.hash("OldStudent9", 12),
      isTestAccount: true,
    });
    const studentToken = generateResetToken();
    student.passwordResetTokenHash = studentToken.hash;
    student.passwordResetExpiresAt = resetExpiryDate();
    await student.save();

    const studentRes = mockRes();
    await resetStudentPassword(
      mockReq({
        token: studentToken.token,
        password: "NewStudent9",
        confirmPassword: "NewStudent9",
      }),
      studentRes
    );
    assert.strictEqual(studentRes.statusCode, 200, studentRes.body?.message);

    const reloadedStudent = await Student.findById(student._id).select("+password");
    assert.strictEqual(reloadedStudent.level, "200");
    assert.ok(await bcrypt.compare("NewStudent9", reloadedStudent.password));
    assert.strictEqual(reloadedStudent.passwordResetTokenHash, undefined);

    const reuse = mockRes();
    await resetStudentPassword(
      mockReq({
        token: studentToken.token,
        password: "NewerStudent9",
        confirmPassword: "NewerStudent9",
      }),
      reuse
    );
    assert.strictEqual(reuse.statusCode, 400);

    const expiredToken = generateResetToken();
    reloadedStudent.passwordResetTokenHash = expiredToken.hash;
    reloadedStudent.passwordResetExpiresAt = new Date(Date.now() - 60 * 1000);
    await reloadedStudent.save();
    const expiredRes = mockRes();
    await resetStudentPassword(
      mockReq({
        token: expiredToken.token,
        password: "ExpiredPass9",
        confirmPassword: "ExpiredPass9",
      }),
      expiredRes
    );
    assert.strictEqual(expiredRes.statusCode, 400);
    assert.ok(String(expiredRes.body.message).toLowerCase().includes("expired"));

    admin = await Admin.create({
      fullName: "Reset Test Level Admin",
      email: adminEmail,
      password: await bcrypt.hash("OldAdmin99", 12),
      role: "level_admin",
      assignedLevel: "300",
      isActive: true,
    });
    const adminToken = generateResetToken();
    admin.passwordResetTokenHash = adminToken.hash;
    admin.passwordResetExpiresAt = resetExpiryDate();
    await admin.save();

    const adminRes = mockRes();
    await resetAdminPassword(
      mockReq({
        token: adminToken.token,
        password: "NewAdmin99",
        confirmPassword: "NewAdmin99",
      }),
      adminRes
    );
    assert.strictEqual(adminRes.statusCode, 200, adminRes.body?.message);

    const reloadedAdmin = await Admin.findById(admin._id).select("+password");
    assert.strictEqual(reloadedAdmin.role, "level_admin");
    assert.strictEqual(reloadedAdmin.assignedLevel, "300");
    assert.ok(await bcrypt.compare("NewAdmin99", reloadedAdmin.password));

    console.log("testPasswordReset: live student + level-admin reset/expiry/reuse checks passed");
  } finally {
    if (student?._id) await Student.deleteOne({ _id: student._id });
    if (admin?._id) await Admin.deleteOne({ _id: admin._id });
    await mongoose.disconnect();
  }
}

hashSanity()
  .then(() => {
    run();
    return liveStoreChecks();
  })
  .catch((error) => {
    console.error("testPasswordReset failed:", error.message);
    process.exit(1);
  });
