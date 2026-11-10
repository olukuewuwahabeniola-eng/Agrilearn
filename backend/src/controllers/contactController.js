const mailer = require("../utils/mailer");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateContactBody(body) {
  const errors = {};
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();

  if (!name) errors.name = "Please enter your full name.";
  else if (name.length < 2) errors.name = "Name must be at least 2 characters.";

  if (!email) errors.email = "Please enter your email address.";
  else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!title) errors.title = "Please enter a subject.";
  else if (title.length > 160) errors.title = "Please shorten the subject.";

  if (!message) errors.message = "Please write your message.";
  else if (message.length < 10) {
    errors.message = "Please write a bit more detail (at least 10 characters).";
  }

  return { errors, data: { name, email, title, message } };
}

async function submitContact(req, res) {
  try {
    const { errors, data } = validateContactBody(req.body || {});
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please fix the highlighted fields.",
        errors,
      });
    }

    if (!mailer.isEmailDeliveryConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          "We could not send your message right now. Please email agrilearn22@gmail.com and we will get back to you.",
      });
    }

    await mailer.sendContactMessage(data);
    return res.status(200).json({
      success: true,
      message: "Message sent successfully. We will get back to you soon.",
    });
  } catch (error) {
    console.error(
      "Homepage contact email failed:",
      error && error.message ? error.message : "unknown error"
    );
    return res.status(502).json({
      success: false,
      message:
        "Sorry, we could not send your message right now. Please try again in a moment, or email agrilearn22@gmail.com directly.",
    });
  }
}

module.exports = {
  submitContact,
  validateContactBody,
};
