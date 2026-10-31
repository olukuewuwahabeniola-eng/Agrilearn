const nodemailer = require("nodemailer");

/**
 * Returns true when SMTP + support inbox env vars are all set.
 * Does not invent or log credential values.
 */
function isEmailDeliveryConfigured() {
  const required = [
    process.env.SMTP_HOST,
    process.env.SMTP_PORT,
    process.env.SMTP_USER,
    process.env.SMTP_PASS,
    process.env.SUPPORT_EMAIL,
  ];
  return required.every((value) => Boolean(value && String(value).trim()));
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT);
  // Port 465 uses implicit TLS; 587 uses STARTTLS.
  const secure = port === 465;

  return nodemailer.createTransport({
    host: String(process.env.SMTP_HOST).trim(),
    port,
    secure,
    auth: {
      user: String(process.env.SMTP_USER).trim(),
      pass: String(process.env.SMTP_PASS).trim(),
    },
  });
}

/**
 * Sends a saved support message to SUPPORT_EMAIL via Gmail SMTP.
 * Caller must save to MongoDB first. Throws on transport/send failure.
 */
async function sendSupportNotification(savedMessage) {
  if (!isEmailDeliveryConfigured()) {
    const error = new Error("Email delivery is not configured.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const transporter = createTransporter();
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  isEmailDeliveryConfigured,
  sendSupportNotification,
};
