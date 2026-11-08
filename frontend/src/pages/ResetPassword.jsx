import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordInput from "../components/auth/PasswordInput";
import { apiFetch } from "../utils/api";
import { validateResetPassword } from "../utils/authValidation";

function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => String(params.get("token") || "").trim(), [params]);
  const [checking, setChecking] = useState(Boolean(token));
  const [statusError, setStatusError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setStatusError("This reset link is missing a token. Request a new one.");
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setChecking(true);
      setStatusError("");
      try {
        await apiFetch(`/api/auth/reset-status?token=${encodeURIComponent(token)}`);
      } catch (error) {
        if (!cancelled) {
          setStatusError(
            error.message || "This reset link is invalid or has expired."
          );
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const nextErrors = validateResetPassword({ password, confirmPassword });
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      setSuccess(data.message || "Password updated. You can now log in.");
      setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: { notice: data.message || "Password updated. Log in with your new password." },
        });
      }, 700);
    } catch (error) {
      setFormError(error.message || "Could not reset that password.");
    } finally {
      setLoading(false);
    }
  };

  const formReady = Boolean(token && !checking && !statusError);

  return (
    <AuthLayout>
      <span className="auth-badge">Account recovery</span>
      <h1>Set a new password</h1>
      <p className="auth-lead">
        Choose a new password for your student account. The reset link works
        only once and expires after 30 minutes.
      </p>

      {checking ? <p className="auth-lead">Checking your reset link…</p> : null}
      {statusError ? (
        <p className="form-error-banner" role="alert">
          {statusError}
        </p>
      ) : null}

      {formReady ? (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="new-password">New password</label>
            <PasswordInput
              id="new-password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: "" }));
                setFormError("");
              }}
              className={errors.password ? "input-error" : ""}
              aria-invalid={Boolean(errors.password)}
              disabled={loading}
            />
            {errors.password ? <p className="field-error">{errors.password}</p> : null}
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirm new password</label>
            <PasswordInput
              id="confirm-password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setErrors((current) => ({ ...current, confirmPassword: "" }));
                setFormError("");
              }}
              className={errors.confirmPassword ? "input-error" : ""}
              aria-invalid={Boolean(errors.confirmPassword)}
              disabled={loading}
            />
            {errors.confirmPassword ? (
              <p className="field-error">{errors.confirmPassword}</p>
            ) : null}
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
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      ) : null}

      <p className="auth-switch">
        <Link to="/forgot-password">Request a new link</Link>
        {" · "}
        <Link to="/login">Back to student login</Link>
      </p>
    </AuthLayout>
  );
}

export default ResetPassword;
