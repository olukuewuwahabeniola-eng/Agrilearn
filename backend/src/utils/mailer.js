const nodemailer = require("nodemailer");

/**
 * Shared AgriLearn email service.
 * All mail (dashboard support, homepage contact, password reset) uses this
 * one Nodemailer SMTP transport — the same method that already delivers
 * Student Dashboard Contact Us messages.
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

function notConfiguredError() {
  const error = new Error("Email delivery is not configured.");
  error.code = "EMAIL_NOT_CONFIGURED";
  return error;
}

/**
 * Same SMTP transport used by dashboard Contact Us in production.
 * Do not add a second provider or a second transporter implementation.
 */
function createTransporter() {
  const port = smtpPort();
  if (!isSmtpConfigured() || !port) {
    throw notConfiguredError();
  }

  const secure = port === 465;
  const options = {
    host: String(process.env.SMTP_HOST).trim(),
    port,
    secure,
    auth: {
      user: String(process.env.SMTP_USER).trim(),
      pass: smtpAuthPass(),
    },
  };

  // Windows (local) often needs IPv4; Render/Linux uses Node's default lookup.
  if (process.platform === "win32") {
    options.family = 4;
  }

  return nodemailer.createTransport(options);
}

function resetMailerCache() {
  // Transporters are created per send, matching the working dashboard method.
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendMail(fields) {
  const transporter = createTransporter();
  try {
    await transporter.sendMail(fields);
  } finally {
    if (transporter && typeof transporter.close === "function") {
      transporter.close();
    }
  }
}

function fromAddress() {
  return String(process.env.SMTP_USER).trim();
}

function supportInbox() {
  return String(process.env.SUPPORT_EMAIL).trim();
}

function buildSupportEmail(savedMessage) {
  const studentName = String(savedMessage.name || "").trim();
  const studentEmail = String(savedMessage.email || "").trim();
  const category = String(savedMessage.category || "Other").trim();
  const submitted = savedMessage.createdAt
    ? new Date(savedMessage.createdAt).toISOString()
    : new Date().toISOString();
  const body = String(savedMessage.message || "");
  const supportId = savedMessage._id ? String(savedMessage._id) : "";

  return {
    from: `"AgriLearn Support" <${fromAddress()}>`,
    to: supportInbox(),
    replyTo: studentEmail,
    subject: "New AgriLearn Dashboard Support Request",
    text: [
      "A new AgriLearn dashboard support request was submitted.",
      "",
      supportId ? `Support ID: ${supportId}` : null,
      `Student name: ${studentName}`,
      `Student email: ${studentEmail}`,
      `Category: ${category}`,
      `Submitted: ${submitted}`,
      "",
      "Message:",
      body,
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <p>A new AgriLearn dashboard support request was submitted.</p>
      <ul>
        ${supportId ? `<li><strong>Support ID:</strong> ${escapeHtml(supportId)}</li>` : ""}
        <li><strong>Student name:</strong> ${escapeHtml(studentName)}</li>
        <li><strong>Student email:</strong> ${escapeHtml(studentEmail)}</li>
        <li><strong>Category:</strong> ${escapeHtml(category)}</li>
        <li><strong>Submitted:</strong> ${escapeHtml(submitted)}</li>
      </ul>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(body).replace(/\n/g, "<br />")}</p>
    `,
  };
}

function buildContactEmail({ name, email, title, message }) {
  const safeName = String(name || "").trim();
  const safeEmail = String(email || "").trim();
  const safeTitle = String(title || "").trim();
  const safeMessage = String(message || "").trim();

  return {
    from: `"AgriLearn Contact" <${fromAddress()}>`,
    to: supportInbox(),
    replyTo: safeEmail,
    subject: `New AgriLearn Homepage Contact — ${safeTitle}`,
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
  };
}

function resetAudienceCopy(audience) {
  if (audience === "level_admin") {
    return {
      kind: "Level Admin",
      subject: "Reset your AgriLearn Level Admin password",
    };
  }
  if (audience === "super_admin" || audience === "admin") {
    return {
      kind: "Super Admin",
      subject: "Reset your AgriLearn Super Admin password",
    };
  }
  return {
    kind: "student",
    subject: "Reset your AgriLearn password",
  };
}

function buildPasswordResetEmail({ to, name, resetUrl, audience = "student" }) {
  const safeName = String(name || "there").trim() || "there";
  const { kind, subject } = resetAudienceCopy(audience);
  const url = String(resetUrl || "").trim();

  return {
    from: `"AgriLearn" <${fromAddress()}>`,
    to: String(to || "").trim(),
    subject,
    text: [
      `Hi ${safeName},`,
      "",
      `We received a request to reset the password for your AgriLearn ${kind} account.`,
      "This link expires in 30 minutes and can be used only once:",
      url,
      "",
      "If you did not request this, you can ignore this email. Your password will stay the same.",
      "",
      "— AgriLearn",
    ].join("\n"),
    html: `
      <p>Hi ${escapeHtml(safeName)},</p>
      <p>We received a request to reset the password for your AgriLearn ${kind} account.</p>
      <p>This link expires in <strong>30 minutes</strong> and can be used only once:</p>
      <p><a href="${escapeHtml(url)}">Reset your password</a></p>
      <p>If the button does not work, copy this URL into your browser:</p>
      <p>${escapeHtml(url)}</p>
      <p>If you did not request this, you can ignore this email. Your password will stay the same.</p>
      <p>— AgriLearn</p>
    `,
  };
}

async function sendSupportNotification(savedMessage) {
  if (!isEmailDeliveryConfigured()) {
    throw notConfiguredError();
  }
  await sendMail(buildSupportEmail(savedMessage));
}

async function sendContactMessage(payload) {
  if (!isEmailDeliveryConfigured()) {
    throw notConfiguredError();
  }
  await sendMail(buildContactEmail(payload));
}

async function sendPasswordResetEmail({ to, name, resetUrl, audience = "student" }) {
  if (!isSmtpConfigured()) {
    throw notConfiguredError();
  }
  await sendMail(buildPasswordResetEmail({ to, name, resetUrl, audience }));
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
  const transporter = createTransporter();
  try {
    await transporter.verify();
  } finally {
    if (transporter && typeof transporter.close === "function") {
      transporter.close();
    }
  }
}

module.exports = {
  isSmtpConfigured,
  isEmailDeliveryConfigured,
  sendSupportNotification,
  sendContactMessage,
  sendPasswordResetEmail,
  buildSupportEmail,
  buildContactEmail,
  buildPasswordResetEmail,
  logEmailConfigStatus,
  emailCredentialStatus,
  resetMailerCache,
  verifySmtp,
};
