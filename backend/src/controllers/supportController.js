const SupportMessage = require("../models/SupportMessage");
const { CATEGORIES } = require("../models/SupportMessage");
const {
  isEmailDeliveryConfigured,
  sendSupportNotification,
} = require("../utils/mailer");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSupportBody(body) {
  const errors = {};
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const category = String(body.category || "").trim();
  const message = String(body.message || "").trim();

  if (!name) errors.name = "Please enter your name.";
  else if (name.length < 2) errors.name = "Name must be at least 2 characters.";

  if (!email) errors.email = "Please enter your email.";
  else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!category) errors.category = "Please select an issue category.";
  else if (!CATEGORIES.includes(category)) {
    errors.category = "Please choose a valid issue category.";
  }

  if (!message) errors.message = "Please write your message.";
  else if (message.length < 10) {
    errors.message = "Please add a bit more detail (at least 10 characters).";
  }

  return { errors, data: { name, email, category, message } };
}

function buildSavedResponse({ saved, emailDelivered, emailDeliveryConfigured, emailError }) {
  let message =
    "Your support request was saved successfully. Our team will review it.";

  if (emailDelivered) {
    message =
      "Your support request was saved and emailed to the AgriLearn support inbox.";
  } else if (emailDeliveryConfigured) {
    message =
      "Your support request was saved, but email delivery to the support inbox failed. Our team can still review it in the system.";
  } else {
    message =
      "Your support request was saved successfully. Email delivery is not configured yet, so the support inbox was not notified.";
  }

  return {
    success: true,
    message,
    saved: true,
    support: {
      id: saved._id,
      category: saved.category,
      createdAt: saved.createdAt,
    },
    emailDeliveryConfigured,
    emailDelivered,
    ...(emailError ? { emailError } : {}),
  };
}

async function createSupportMessage(req, res) {
  try {
    const { errors, data } = validateSupportBody(req.body || {});

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please fix the highlighted fields.",
        errors,
      });
    }

    // Persist first — email failures must not undo a successful save.
    const saved = await SupportMessage.create({
      ...data,
      student: req.student._id,
    });

    const emailDeliveryConfigured = isEmailDeliveryConfigured();
    let emailDelivered = false;
    let emailError;

    if (emailDeliveryConfigured) {
      try {
        await sendSupportNotification(saved);
        emailDelivered = true;
      } catch (deliveryError) {
        emailDelivered = false;
        emailError = "Email delivery failed after the message was saved.";
        console.error(
          "Support email delivery failed:",
          deliveryError && deliveryError.message
            ? deliveryError.message
            : "unknown error"
        );
      }
    }

    return res.status(201).json(
      buildSavedResponse({
        saved,
        emailDelivered,
        emailDeliveryConfigured,
        emailError,
      })
    );
  } catch (error) {
    console.error("Support submit error:", error.message);
    return res.status(500).json({
      success: false,
      saved: false,
      emailDelivered: false,
      message: "Could not submit your message right now. Please try again.",
    });
  }
}

module.exports = {
  createSupportMessage,
};
