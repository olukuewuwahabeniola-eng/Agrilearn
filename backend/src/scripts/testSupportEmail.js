/**
 * Support requests stay saved when SMTP notification fails.
 */
const assert = require("assert");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const mailer = require("../utils/mailer");
const Student = require("../models/Student");
const SupportMessage = require("../models/SupportMessage");
const { createSupportMessage } = require("../controllers/supportController");

function mockReq(body, student) {
  return {
    body,
    student,
  };
}

function mockRes() {
  return {
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
}

async function run() {
  const uri = String(process.env.MONGODB_URI || "").trim();
  if (!uri) {
    console.log("testSupportEmail: skipped (no MONGODB_URI)");
    return;
  }

  await mongoose.connect(uri);
  const stamp = Date.now();
  const email = `support.save.${stamp}@agrilearn.test`;
  let student;
  const originalSend = mailer.sendSupportNotification;
  mailer.sendSupportNotification = async () => {
    throw new Error("simulated smtp failure");
  };

  try {
    student = await Student.create({
      fullName: "Support Save Student",
      email,
      matricNumber: `SUP${stamp}`.slice(0, 16),
      level: "100",
      password: await bcrypt.hash("SupportSave9", 12),
      isTestAccount: true,
    });

    const previous = await SupportMessage.countDocuments({ student: student._id });
    const res = mockRes();
    await createSupportMessage(
      mockReq(
        {
          name: "Support Save Student",
          email,
          category: "Bug Report",
          message: "The notes page does not open after login.",
        },
        student
      ),
      res
    );

    assert.strictEqual(res.statusCode, 201, res.body?.message);
    assert.strictEqual(res.body.saved, true);
    assert.strictEqual(res.body.emailDelivered, false);
    assert.ok(String(res.body.message).toLowerCase().includes("received"));
    const stored = await SupportMessage.findOne({
      student: student._id,
      message: "The notes page does not open after login.",
    });
    assert.ok(stored, "support request must remain in MongoDB after email failure");
    const next = await SupportMessage.countDocuments({ student: student._id });
    assert.strictEqual(next, previous + 1);
    await SupportMessage.deleteOne({ _id: stored._id });
    console.log("testSupportEmail: MongoDB save survives SMTP failure");
  } finally {
    mailer.sendSupportNotification = originalSend;
    if (student?._id) {
      await SupportMessage.deleteMany({ student: student._id });
      await Student.deleteOne({ _id: student._id });
    }
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error("testSupportEmail failed:", error.message);
  process.exit(1);
});
