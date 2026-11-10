import { useState } from "react";
import { apiFetch } from "../utils/api";
import "./Contact.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INITIAL_VALUES = {
  name: "",
  email: "",
  title: "",
  message: "",
};

function validateContact(values) {
  const errors = {};

  if (!values.name.trim()) {
    errors.name = "Please enter your full name.";
  }

  if (!values.email.trim()) {
    errors.email = "Please enter your email address.";
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (!values.title.trim()) {
    errors.title = "Please enter a subject.";
  }

  if (!values.message.trim()) {
    errors.message = "Please write your message.";
  } else if (values.message.trim().length < 10) {
    errors.message = "Please write a bit more detail (at least 10 characters).";
  }

  return errors;
}

function Contact() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setStatus({ type: "", message: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (sending) return;

    const nextErrors = validateContact(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatus({ type: "", message: "" });
      return;
    }

    setSending(true);
    setStatus({ type: "", message: "" });

    try {
      const data = await apiFetch("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          title: values.title.trim(),
          message: values.message.trim(),
        }),
      });

      setValues(INITIAL_VALUES);
      setErrors({});
      setStatus({
        type: "success",
        message:
          data.message ||
          "Message sent successfully. We will get back to you soon.",
      });
    } catch (error) {
      if (error.data?.errors) setErrors(error.data.errors);
      setStatus({
        type: "error",
        message:
          error.message ||
          "Sorry, we could not send your message right now. Please try again in a moment, or email agrilearn22@gmail.com directly.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="contact" className="contact section">
      <div className="container contact-grid">
        <div className="contact-intro reveal">
          <h2 className="section-title">Get in touch</h2>
          <p>
            Have a question about AgriLearn? Send us a message and we will be
            glad to help.
          </p>

          <div className="contact-points">
            <div className="contact-point">
              <div className="contact-point-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 7 9-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <strong>Email</strong>
                <span>
                  <a href="mailto:agrilearn22@gmail.com">agrilearn22@gmail.com</a>
                </span>
              </div>
            </div>

            <div className="contact-point">
              <div className="contact-point-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </div>
              <div>
                <strong>Focus</strong>
                <span>Faculty of Agriculture students</span>
              </div>
            </div>

            <div className="contact-point">
              <div className="contact-point-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <strong>Response</strong>
                <span>We aim to reply as soon as we can</span>
              </div>
            </div>
          </div>
        </div>

        <form className="contact-form reveal" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="contact_name">Full name</label>
              <input
                id="contact_name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={values.name}
                onChange={handleChange}
                className={errors.name ? "input-error" : ""}
                aria-invalid={Boolean(errors.name)}
                disabled={sending}
              />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>
            <div className="form-group">
              <label htmlFor="contact_email">Email</label>
              <input
                id="contact_email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={values.email}
                onChange={handleChange}
                className={errors.email ? "input-error" : ""}
                aria-invalid={Boolean(errors.email)}
                disabled={sending}
              />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="contact_title">Subject</label>
            <input
              id="contact_title"
              name="title"
              type="text"
              placeholder="How can we help?"
              value={values.title}
              onChange={handleChange}
              className={errors.title ? "input-error" : ""}
              aria-invalid={Boolean(errors.title)}
              disabled={sending}
            />
            {errors.title && <p className="field-error">{errors.title}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="contact_message">Message</label>
            <textarea
              id="contact_message"
              name="message"
              placeholder="Write your message here..."
              value={values.message}
              onChange={handleChange}
              className={errors.message ? "input-error" : ""}
              aria-invalid={Boolean(errors.message)}
              disabled={sending}
            />
            {errors.message && <p className="field-error">{errors.message}</p>}
          </div>

          {status.type === "success" && (
            <p className="form-message" role="status">
              {status.message}
            </p>
          )}

          {status.type === "error" && (
            <p className="form-message form-message-error" role="alert">
              {status.message}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending}
          >
            {sending ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default Contact;
