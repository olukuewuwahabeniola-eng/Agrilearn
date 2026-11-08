import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PasswordInput from "../../components/auth/PasswordInput";
import { adminFetch } from "../../utils/adminApi";
import { validateResetPassword } from "../../utils/authValidation";

function AdminResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => String(params.get("token") || "").trim(), [params]);
  const [checking, setChecking] = useState(Boolean(token));
  const [statusError, setStatusError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        await adminFetch(
          `/api/admin/auth/reset-status?token=${encodeURIComponent(token)}`
        );
      } catch (err) {
        if (!cancelled) {
          setStatusError(err.message || "This reset link is invalid or has expired.");
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
    const nextErrors = validateResetPassword(
      { password, confirmPassword },
      { requireLetterAndNumber: true }
    );
    const firstError = nextErrors.password || nextErrors.confirmPassword;
    if (firstError) {
      setError(firstError);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const data = await adminFetch("/api/admin/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      setSuccess(data.message || "Password updated.");
      setTimeout(() => {
        navigate("/admin/login", {
          replace: true,
          state: {
            inviteSuccess:
              data.message ||
              "Password updated. Sign in with your email and new password.",
          },
        });
      }, 700);
    } catch (err) {
      setError(err.message || "Could not reset that password.");
    } finally {
      setSubmitting(false);
    }
  };

  const formReady = Boolean(token && !checking && !statusError);

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

        <h1>Set a new password</h1>
        <p className="admin-login-sub">
          Choose a new password for your administrator account. This link works
          only once and expires after 30 minutes. Your role and assigned level
          will not change.
        </p>

        {checking ? <p className="admin-muted">Checking your reset link…</p> : null}
        {statusError ? (
          <p className="admin-form-error" role="alert">
            {statusError}
          </p>
        ) : null}

        {formReady ? (
          <form onSubmit={handleSubmit} className="admin-login-form" noValidate>
            {error ? (
              <p className="admin-form-error" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="admin-form-success" role="status">
                {success}
              </p>
            ) : null}

            <label htmlFor="admin-new-password">New password</label>
            <PasswordInput
              id="admin-new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              disabled={submitting}
              autoComplete="new-password"
              placeholder="At least 8 characters, letter + number"
            />

            <label htmlFor="admin-confirm-password">Confirm password</label>
            <PasswordInput
              id="admin-confirm-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              disabled={submitting}
              autoComplete="new-password"
            />

            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Update password"}
            </button>
          </form>
        ) : null}

        <p className="admin-login-footer">
          <Link to="/admin/forgot-password">Request a new link</Link>
          {" · "}
          <Link to="/admin/login">Back to admin sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default AdminResetPassword;
