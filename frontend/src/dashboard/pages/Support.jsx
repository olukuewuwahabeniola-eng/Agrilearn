import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../utils/api";
import PageHeader from "../components/PageHeader";

const CATEGORIES = [
  "Account/Login",
  "Notes & Resources",
  "AI Assistant/Quizzes",
  "Course Enrolment",
  "Bug Report",
  "Other",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Support() {
  const { student } = useAuth();

  const [values, setValues] = useState({
    name: "",
    email: "",
    category: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setValues((current) => ({
      ...current,
      name: current.name || student?.fullName || "",
      email: current.email || student?.email || "",
    }));
  }, [student]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setSuccess("");
    setFormError("");
  };

  const validate = () => {
    const next = {};
    if (!values.name.trim()) next.name = "Please enter your name.";
    if (!values.email.trim()) next.email = "Please enter your email.";
    else if (!EMAIL_PATTERN.test(values.email.trim())) {
      next.email = "Please enter a valid email address.";
    }
    if (!values.category) next.category = "Please select an issue category.";
    if (!values.message.trim()) next.message = "Please write your message.";
    else if (values.message.trim().length < 10) {
      next.message = "Please add a bit more detail (at least 10 characters).";
    }
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    setSuccess("");
    setFormError("");
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const data = await apiFetch("/api/support", {
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          category: values.category,
          message: values.message.trim(),
        }),
      });

      setSuccess(
        data.message ||
          "Your support request has been submitted successfully. Our team will review it and get back to you."
      );
      setValues((current) => ({ ...current, category: "", message: "" }));
    } catch (error) {
      if (error.data?.errors) setErrors(error.data.errors);
      setFormError(
        error.message ||
          "Could not submit your message right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-card page-hero">
      <PageHeader
        title="Contact & Support"
        subtitle="Tell us how we can help with your AgriLearn account or courses."
      />

      <form className="support-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="support-name">Student name</label>
            <input
              id="support-name"
              name="name"
              type="text"
              value={values.name}
              onChange={handleChange}
              className={errors.name ? "input-error" : ""}
              disabled={loading}
              autoComplete="name"
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="support-email">Student email</label>
            <input
              id="support-email"
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              className={errors.email ? "input-error" : ""}
              disabled={loading}
              autoComplete="email"
            />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="support-category">Issue category</label>
          <select
            id="support-category"
            name="category"
            value={values.category}
            onChange={handleChange}
            className={errors.category ? "input-error" : ""}
            disabled={loading}
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {errors.category && <p className="field-error">{errors.category}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="support-message">Message</label>
          <textarea
            id="support-message"
            name="message"
            rows={6}
            placeholder="Describe your issue..."
            value={values.message}
            onChange={handleChange}
            className={errors.message ? "input-error" : ""}
            disabled={loading}
          />
          {errors.message && <p className="field-error">{errors.message}</p>}
        </div>

        <p className="support-config-note">
          Please provide clear details about your issue so our support team can
          assist you effectively.
        </p>

        {formError && (
          <p className="form-error-banner" role="alert">
            {formError}
          </p>
        )}
        {success && (
          <p className="form-success-banner" role="status">
            {success}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Sending..." : "Submit support request"}
        </button>
      </form>
    </section>
  );
}

export default Support;
