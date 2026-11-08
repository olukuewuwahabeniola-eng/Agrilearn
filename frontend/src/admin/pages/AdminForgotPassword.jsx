import { useState } from "react";
import { Link } from "react-router-dom";
import { adminFetch } from "../../utils/adminApi";
import { validateForgotPasswordEmail } from "../../utils/authValidation";

function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForgotPasswordEmail(email);
    if (nextErrors.email) {
      setFieldError(nextErrors.email);
      setError("");
      setSuccess("");
      return;
    }
    setFieldError("");
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const data = await adminFetch("/api/admin/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSuccess(
        data.message ||
          "If that email is registered as an AgriLearn administrator, we sent a reset link."
      );
    } catch (err) {
      setError(err.message || "Could not send a reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <span className="admin-login-mark" aria-hidden="true">
            <img src="/logo.png" alt="" className="admin-brand-logo" />
          </span>
          <div>
            <strong>AgriLearn Admin</strong>
            <p>Password recovery</p>
          </div>
        </div>

        <h1>Forgot your password?</h1>
        <p className="admin-login-sub">
          Enter the email registered to your Super Admin or Level Admin account.
          If it matches, we will send a reset link that expires in 30 minutes.
        </p>

        <form onSubmit={handleSubmit} className="admin-login-form" noValidate>
          {success ? (
            <p className="admin-form-success" role="status">
              {success}
            </p>
          ) : null}
          {error ? (
            <p className="admin-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <label htmlFor="admin-recovery-email">Admin email</label>
          <input
            id="admin-recovery-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldError("");
              setError("");
              setSuccess("");
            }}
            disabled={submitting}
          />
          {fieldError ? (
            <p className="admin-form-error" role="alert">
              {fieldError}
            </p>
          ) : null}

          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={submitting}
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="admin-login-footer">
          <Link to="/admin/login">Back to admin sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default AdminForgotPassword;
