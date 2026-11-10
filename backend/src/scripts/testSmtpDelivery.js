/**
 * Verifies SMTP configuration without printing secrets.
 * Set SMTP_VERIFY_SEND=1 to also send one inbox test message.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const {
  isSmtpConfigured,
  isEmailDeliveryConfigured,
  emailCredentialStatus,
  verifySmtp,
  sendContactMessage,
  sendSupportNotification,
  sendPasswordResetEmail,
  resetMailerCache,
} = require("../utils/mailer");

function mask(value) {
  const text = String(value || "").trim();
  if (!text) return "(empty)";
  if (text.includes("@")) {
    const [local, domain] = text.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
  return "(set)";
}

async function run() {
  resetMailerCache();
  const status = emailCredentialStatus();
  console.log("smtpConfigured=", status.smtpConfigured);
  console.log("supportInboxConfigured=", status.supportInboxConfigured);
  console.log("SMTP_HOST set=", isSmtpConfigured());
  console.log("SMTP_PORT=", String(process.env.SMTP_PORT || "").trim() || "(empty)");
  console.log("SMTP_USER=", mask(process.env.SMTP_USER));
  console.log("SMTP_PASS set=", Boolean(String(process.env.SMTP_PASS || "").trim()));
  console.log("SUPPORT_EMAIL=", mask(process.env.SUPPORT_EMAIL));

  if (!isSmtpConfigured()) {
    console.error("SMTP env vars are missing. Cannot verify delivery.");
    process.exitCode = 1;
    return;
  }

  try {
    await verifySmtp();
    console.log("smtpVerify=ok");
  } catch (error) {
    console.error("smtpVerify=failed");
    console.error("code=", error.code || "none");
    console.error("message=", error.message || "unknown error");
    process.exitCode = 1;
    return;
  }

  if (String(process.env.SMTP_VERIFY_SEND || "").trim() !== "1") {
    return;
  }
  if (!isEmailDeliveryConfigured()) {
    console.error("SUPPORT_EMAIL is missing; inbox send skipped.");
    process.exitCode = 1;
    return;
  }

  const inbox = String(process.env.SUPPORT_EMAIL).trim();
  const stamp = new Date().toISOString();

  await sendContactMessage({
    name: "AgriLearn SMTP check",
    email: inbox,
    title: "Homepage contact delivery check",
    message:
      `Automated homepage contact check at ${stamp}. You can ignore it.`,
  });
  console.log("smtpSendHomepage=ok");

  await sendSupportNotification({
    _id: "local-delivery-check",
    name: "AgriLearn SMTP check",
    email: inbox,
    category: "Other",
    message: `Automated dashboard support check at ${stamp}. You can ignore it.`,
    createdAt: new Date(),
  });
  console.log("smtpSendDashboard=ok");

  await sendPasswordResetEmail({
    to: inbox,
    name: "AgriLearn SMTP check",
    resetUrl: "https://myagrilearn.vercel.app/reset-password?token=local-delivery-check",
    audience: "student",
  });
  console.log("smtpSendStudentReset=ok");

  await sendPasswordResetEmail({
    to: inbox,
    name: "AgriLearn SMTP check",
    resetUrl: "https://myagrilearn.vercel.app/admin/reset-password?token=local-delivery-check",
    audience: "super_admin",
  });
  console.log("smtpSendSuperAdminReset=ok");

  await sendPasswordResetEmail({
    to: inbox,
    name: "AgriLearn SMTP check",
    resetUrl: "https://myagrilearn.vercel.app/admin/reset-password?token=local-delivery-check",
    audience: "level_admin",
  });
  console.log("smtpSendLevelAdminReset=ok");
}

run().catch((error) => {
  console.error("smtpVerify=failed");
  console.error("message=", error.message || "unknown error");
  process.exit(1);
});
