import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import PasswordInput from "../../components/auth/PasswordInput";
import { adminFetch } from "../../utils/adminApi";
import { useAdminAuth } from "../AdminAuthContext";

function AdminAcceptInvite() {
  const { isAuthenticated, loading } = useAdminAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => String(params.get("token") || "").trim(), [params]);

  const [inviteInfo, setInviteInfo] = useState(null);
  const [checking, setChecking] = useState(Boolean(token));
  const [statusError, setStatusError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setStatusError("Invalid invite link. Ask the Super Admin for a new invitation.");
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setChecking(true);
      setStatusError("");
      try {
        const data = await adminFetch(
          `/api/admin/auth/invite-status?token=${encodeURIComponent(token)}`
        );
        if (!cancelled) {
          setInviteInfo(data.invite || null);
        }
      } catch (err) {
        if (!cancelled) {
          setInviteInfo(null);
          setStatusError(err.message || "This invite link is invalid or has expired.");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="admin-loading-screen" role="status">
        Checking admin session...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("This invite link is missing a token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must include at least one letter and one number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await adminFetch("/api/admin/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      navigate("/admin/login", {
        replace: true,
        state: {
          inviteSuccess:
            data.message ||
            "Password created successfully. Sign in with your email and new password.",
          prefillEmail: data.admin?.email || inviteInfo?.email || "",
        },
      });
    } catch (err) {
      setError(err.message || "Could not complete invite setup.");
    } finally {
      setSubmitting(false);
    }
  };

  const formReady = Boolean(token && inviteInfo && !statusError);

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <span className="admin-login-mark" aria-hidden="true">
            <img src="/logo.png" alt="" className="admin-brand-logo" />
          </span>
          <div>
            <strong>AgriLearn Admin</strong>
            <p>Level Admin invitation</p>
          </div>
        </div>

        <h1>Create your password</h1>
        <p className="admin-login-sub">
          {inviteInfo
            ? `Welcome, ${inviteInfo.fullName}. You are invited as ${inviteInfo.assignedLevel} Level Admin (${inviteInfo.email}).`
            : "Finish setting up your AgriLearn Level Admin account."}
        </p>

        {checking ? (
          <p className="admin-muted">Validating invitation…</p>
        ) : null}

        {statusError ? (
          <p className="admin-form-error" role="alert">
            {statusError}
          </p>
        ) : null}

        {formReady ? (
          <form onSubmit={handleSubmit} className="admin-login-form">
            {error ? (
              <p className="admin-form-error" role="alert">
                {error}
              </p>
            ) : null}

            <label htmlFor="invite-password">New password</label>
            <PasswordInput
              id="invite-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={submitting}
              autoComplete="new-password"
              placeholder="At least 8 characters, letter + number"
            />

            <label htmlFor="invite-confirm">Confirm password</label>
            <PasswordInput
              id="invite-confirm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              {submitting ? "Saving…" : "Create password"}
            </button>
          </form>
        ) : null}

        <p className="admin-login-footer">
          Already set up? <Link to="/admin/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default AdminAcceptInvite;
