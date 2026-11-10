/**
 * Mailer configuration and contact validation checks.
 * Does not print secrets or send live email.
 */
const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const {
  isSmtpConfigured,
  isEmailDeliveryConfigured,
  sendContactMessage,
  sendPasswordResetEmail,
  sendSupportNotification,
  buildSupportEmail,
  buildContactEmail,
  buildPasswordResetEmail,
  resetMailerCache,
  emailCredentialStatus,
} = require("../utils/mailer");
const { validateContactBody } = require("../controllers/contactController");

async function withEnv(overrides, fn) {
  const previous = {};
  const keys = Object.keys(overrides);
  for (const key of keys) {
    previous[key] = process.env[key];
    if (overrides[key] == null) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  resetMailerCache();
  try {
    return await fn();
  } finally {
    for (const key of keys) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
    resetMailerCache();
  }
}

async function expectCode(fn, code) {
  let caught = null;
  try {
    await fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, "expected an error");
  assert.strictEqual(caught.code, code);
}

async function run() {
  const missing = {
    SMTP_HOST: "",
    SMTP_PORT: "",
    SMTP_USER: "",
    SMTP_PASS: "",
    SUPPORT_EMAIL: "",
  };

  await withEnv(missing, () => {
    assert.strictEqual(isSmtpConfigured(), false);
    assert.strictEqual(isEmailDeliveryConfigured(), false);
    const status = emailCredentialStatus();
    assert.strictEqual(status.smtpConfigured, false);
    assert.strictEqual(status.supportInboxConfigured, false);
  });

  await withEnv(
    {
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "465",
      SMTP_USER: "demo@example.com",
      SMTP_PASS: "app-password-value",
      SUPPORT_EMAIL: "",
    },
    () => {
      assert.strictEqual(isSmtpConfigured(), true);
      assert.strictEqual(isEmailDeliveryConfigured(), false);
    }
  );

  await withEnv(
    {
      SMTP_HOST: "",
      SMTP_PORT: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      SUPPORT_EMAIL: "",
    },
    async () => {
      await expectCode(
        () =>
          sendContactMessage({
            name: "Ada",
            email: "ada@example.com",
            title: "Help",
            message: "Please help with my account.",
          }),
        "EMAIL_NOT_CONFIGURED"
      );
      await expectCode(
        () =>
          sendPasswordResetEmail({
            to: "ada@example.com",
            name: "Ada",
            resetUrl: "https://example.com/reset",
          }),
        "EMAIL_NOT_CONFIGURED"
      );
      await expectCode(
        () =>
          sendSupportNotification({
            _id: "1",
            name: "Ada",
            email: "ada@example.com",
            category: "Other",
            message: "Need help",
            createdAt: new Date(),
          }),
        "EMAIL_NOT_CONFIGURED"
      );
    }
  );

  const invalid = validateContactBody({
    name: "",
    email: "not-an-email",
    title: "",
    message: "short",
  });
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.email);
  assert.ok(invalid.errors.title);
  assert.ok(invalid.errors.message);

  const valid = validateContactBody({
    name: "Ada Student",
    email: "ada@example.com",
    title: "Course notes",
    message: "I cannot open the 200 Level notes PDF.",
  });
  assert.deepStrictEqual(valid.errors, {});
  assert.strictEqual(valid.data.email, "ada@example.com");

  const supportMail = buildSupportEmail({
    _id: "abc123",
    name: "Ada Student",
    email: "ada@example.com",
    category: "Bug Report",
    message: "The notes page does not open after login.",
    createdAt: new Date("2026-11-10T10:00:00.000Z"),
  });
  assert.strictEqual(
    supportMail.subject,
    "New AgriLearn Dashboard Support Request"
  );
  assert.ok(supportMail.text.includes("dashboard support request"));
  assert.ok(!supportMail.text.toLowerCase().includes("homepage"));
  assert.ok(!supportMail.html.toLowerCase().includes("homepage"));

  const contactMail = buildContactEmail({
    name: "Ada Student",
    email: "ada@example.com",
    title: "Course notes",
    message: "I cannot open the 200 Level notes PDF.",
  });
  assert.ok(contactMail.subject.includes("Homepage Contact"));
  assert.ok(contactMail.text.includes("homepage contact message"));
  assert.ok(!contactMail.text.toLowerCase().includes("dashboard support"));

  const studentReset = buildPasswordResetEmail({
    to: "ada@example.com",
    name: "Ada",
    resetUrl: "https://myagrilearn.vercel.app/reset-password?token=example",
    audience: "student",
  });
  assert.ok(studentReset.subject.toLowerCase().includes("reset"));
  assert.ok(studentReset.text.includes("student"));
  assert.ok(!studentReset.text.toLowerCase().includes("password is"));

  const superReset = buildPasswordResetEmail({
    to: "admin@example.com",
    name: "Admin",
    resetUrl: "https://myagrilearn.vercel.app/admin/reset-password?token=example",
    audience: "super_admin",
  });
  assert.ok(superReset.subject.includes("Super Admin"));

  const levelReset = buildPasswordResetEmail({
    to: "level@example.com",
    name: "Level Admin",
    resetUrl: "https://myagrilearn.vercel.app/admin/reset-password?token=example",
    audience: "level_admin",
  });
  assert.ok(levelReset.subject.includes("Level Admin"));

  console.log("testMailer: configuration, templates, and contact validation passed");
}

run().catch((error) => {
  console.error("testMailer failed:", error.message);
  process.exit(1);
});
