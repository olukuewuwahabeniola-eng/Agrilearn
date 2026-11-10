const nodemailer = require("nodemailer");

/**
 * Returns true when SMTP + support inbox env vars are all set.
 * Does not invent or log credential values.
 */
function envFilled(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

function isSmtpConfigured() {
  return ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"].every(envFilled);
}

function isEmailDeliveryConfigured() {
  return isSmtpConfigured() && envFilled("SUPPORT_EMAIL");
}

function smtpPort() {
  const port = Number(String(process.env.SMTP_PORT || "").trim());
  return Number.isInteger(port) && port > 0 ? port : 0;
}

function smtpAuthPass() {
  // Gmail App Passwords are often copied with spaces.
  return String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
}

let cachedTransporter = null;

function createTransporter() {
  const port = smtpPort();
  if (!isSmtpConfigured() || !port) {
    const error = new Error("Email delivery is not configured.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  // Port 465 uses implicit TLS; 587 uses STARTTLS.
  const secure = port === 465;

  return nodemailer.createTransport({
    host: String(process.env.SMTP_HOST).trim(),
    port,
    secure,
    requireTLS: port === 587,
    family: 4,
    auth: {
      user: String(process.env.SMTP_USER).trim(),
      pass: smtpAuthPass(),
    },
    connectionTimeout: 15000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
    tls: {
      minVersion: "TLSv1.2",
    },
  });
}

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = createTransporter();
  }
  return cachedTransporter;
}

function resetMailerCache() {
  if (cachedTransporter && typeof cachedTransporter.close === "function") {
    cachedTransporter.close();
  }
  cachedTransporter = null;
}

function notConfiguredError() {
  const error = new Error("Email delivery is not configured.");
  error.code = "EMAIL_NOT_CONFIGURED";
  return error;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sends a saved support message to SUPPORT_EMAIL via Gmail SMTP.
 * Caller must save to MongoDB first. Throws on transport/send failure.
 */
async function sendSupportNotification(savedMessage) {
  if (!isEmailDeliveryConfigured()) {
    throw notConfiguredError();
  }

  const transporter = getTransporter();
  const supportInbox = String(process.env.SUPPORT_EMAIL).trim();
  const fromAddress = String(process.env.SMTP_USER).trim();
  const studentName = savedMessage.name;
  const studentEmail = savedMessage.email;

  await transporter.sendMail({
    from: `"AgriLearn Support" <${fromAddress}>`,
    to: supportInbox,
    replyTo: studentEmail,
    subject: `[AgriLearn Support] ${savedMessage.category} — ${studentName}`,
    text: [
      "A new AgriLearn support request was submitted.",
      "",
      `Support ID: ${savedMessage._id}`,
      `Student name: ${studentName}`,
      `Student email: ${studentEmail}`,
      `Category: ${savedMessage.category}`,
      `Submitted: ${savedMessage.createdAt.toISOString()}`,
      "",
      "Message:",
      savedMessage.message,
    ].join("\n"),
    html: `
      <p>A new AgriLearn support request was submitted.</p>
      <ul>
        <li><strong>Support ID:</strong> ${savedMessage._id}</li>
        <li><strong>Student name:</strong> ${escapeHtml(studentName)}</li>
        <li><strong>Student email:</strong> ${escapeHtml(studentEmail)}</li>
        <li><strong>Category:</strong> ${escapeHtml(savedMessage.category)}</li>
        <li><strong>Submitted:</strong> ${savedMessage.createdAt.toISOString()}</li>
      </ul>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(savedMessage.message).replace(/\n/g, "<br />")}</p>
    `,
  });
}

/**
 * Homepage contact form — same SMTP inbox as dashboard support.
 */
async function sendContactMessage({ name, email, title, message }) {
  if (!isEmailDeliveryConfigured()) {
    throw notConfiguredError();
  }

  const transporter = getTransporter();
  const supportInbox = String(process.env.SUPPORT_EMAIL).trim();
  const fromAddress = String(process.env.SMTP_USER).trim();
  const safeName = String(name || "").trim();
  const safeEmail = String(email || "").trim();
  const safeTitle = String(title || "").trim();
  const safeMessage = String(message || "").trim();

  await transporter.sendMail({
    from: `"AgriLearn Contact" <${fromAddress}>`,
    to: supportInbox,
    replyTo: safeEmail,
    subject: `[AgriLearn Contact] ${safeTitle} — ${safeName}`,
    text: [
      "A new AgriLearn homepage contact message was submitted.",
      "",
      `Name: ${safeName}`,
      `Email: ${safeEmail}`,
      `Subject: ${safeTitle}`,
      "",
      "Message:",
      safeMessage,
    ].join("\n"),
    html: `
      <p>A new AgriLearn homepage contact message was submitted.</p>
      <ul>
        <li><strong>Name:</strong> ${escapeHtml(safeName)}</li>
        <li><strong>Email:</strong> ${escapeHtml(safeEmail)}</li>
        <li><strong>Subject:</strong> ${escapeHtml(safeTitle)}</li>
      </ul>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(safeMessage).replace(/\n/g, "<br />")}</p>
    `,
  });
}

/**
 * Sends a password reset link. Never includes the user's password.
 */
async function sendPasswordResetEmail({ to, name, resetUrl, audience = "student" }) {
  if (!isSmtpConfigured()) {
    throw notConfiguredError();
  }

  const transporter = getTransporter();
  const fromAddress = String(process.env.SMTP_USER).trim();
  const safeName = String(name || "there").trim() || "there";
  const kind = audience === "admin" ? "administrator" : "student";
  const subject =
    audience === "admin"
      ? "Reset your AgriLearn admin password"
      : "Reset your AgriLearn password";

  await transporter.sendMail({
    from: `"AgriLearn" <${fromAddress}>`,
    to: String(to || "").trim(),
    subject,
    text: [
      `Hi ${safeName},`,
      "",
      `We received a request to reset your AgriLearn ${kind} account password.`,
      "This link expires in 30 minutes and can be used only once:",
      resetUrl,
      "",
      "If you did not request this, you can ignore this email. Your password will stay the same.",
      "",
      "— AgriLearn",
    ].join("\n"),
    html: `
      <p>Hi ${escapeHtml(safeName)},</p>
      <p>We received a request to reset your AgriLearn ${kind} account password.</p>
      <p>This link expires in <strong>30 minutes</strong> and can be used only once:</p>
      <p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p>
      <p>If the button does not work, copy this URL into your browser:</p>
      <p>${escapeHtml(resetUrl)}</p>
      <p>If you did not request this, you can ignore this email. Your password will stay the same.</p>
      <p>— AgriLearn</p>
    `,
  });
}

function logEmailConfigStatus(context = "startup") {
  console.log(
    `[email] ${context} smtpConfigured=${isSmtpConfigured()} supportInboxConfigured=${isEmailDeliveryConfigured()}`
  );
  if (!isSmtpConfigured()) {
    console.error(
      "[email] password-reset and contact emails will fail until SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS are set"
    );
  } else if (!isEmailDeliveryConfigured()) {
    console.error(
      "[email] support/contact notifications will fail until SUPPORT_EMAIL is set"
    );
  }
}

function emailCredentialStatus() {
  return {
    smtpConfigured: isSmtpConfigured(),
    supportInboxConfigured: isEmailDeliveryConfigured(),
  };
}

async function verifySmtp() {
  if (!isSmtpConfigured()) {
    throw notConfiguredError();
  }
  await getTransporter().verify();
}

module.exports = {
  isSmtpConfigured,
  isEmailDeliveryConfigured,
  sendSupportNotification,
  sendContactMessage,
  sendPasswordResetEmail,
  logEmailConfigStatus,
  emailCredentialStatus,
  resetMailerCache,
  verifySmtp,
};
