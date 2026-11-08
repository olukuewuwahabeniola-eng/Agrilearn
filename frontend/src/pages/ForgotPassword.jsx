import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import { apiFetch } from "../utils/api";
import { validateForgotPasswordEmail } from "../utils/authValidation";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const nextErrors = validateForgotPasswordEmail(email);
    setErrors(nextErrors);
    setFormError("");
    setSuccess("");
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSuccess(
        data.message ||
          "If that email is registered with AgriLearn, we sent a password reset link."
      );
    } catch (error) {
      setFormError(error.message || "Could not send a reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <span className="auth-badge">Account recovery</span>
      <h1>Forgot your password?</h1>
      <p className="auth-lead">
        Enter the student email registered to your AgriLearn account. If it
        matches an account, we will send a reset link that expires in 30 minutes.
      </p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="recovery-email">Student email</label>
          <input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors({});
              setFormError("");
              setSuccess("");
            }}
            className={errors.email ? "input-error" : ""}
            aria-invalid={Boolean(errors.email)}
            disabled={loading}
          />
          {errors.email ? <p className="field-error">{errors.email}</p> : null}
        </div>

        {formError ? (
          <p className="form-error-banner" role="alert">
            {formError}
          </p>
        ) : null}
        {success ? (
          <p className="form-success-banner" role="status">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn btn-primary auth-submit"
          disabled={loading}
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="auth-switch">
        Remembered it? <Link to="/login">Back to student login</Link>
      </p>
    </AuthLayout>
  );
}

export default ForgotPassword;
