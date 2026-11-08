import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PasswordInput from "../../components/auth/PasswordInput";
import { adminFetch } from "../../utils/adminApi";
import { LOGIN_SELECTION_PATH, STUDENT_LOGIN_PATH } from "../../utils/authNavigation";
import { useAdminAuth } from "../AdminAuthContext";

function AdminLogin() {
  const { loginSuccess } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successNote, setSuccessNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const state = location.state || {};
    if (state.prefillEmail) setEmail(String(state.prefillEmail));
    if (state.inviteSuccess) setSuccessNote(String(state.inviteSuccess));
    if (state.prefillEmail || state.inviteSuccess) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessNote("");
    setSubmitting(true);
    try {
      const data = await adminFetch("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      loginSuccess(data.token, data.admin);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Could not log in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login-page">
      <button
        type="button"
        className="admin-login-back"
        onClick={() => navigate(LOGIN_SELECTION_PATH)}
      >
        <span aria-hidden="true">←</span> Back
      </button>
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <span className="admin-login-mark" aria-hidden="true">
            <img src="/logo.png" alt="" className="admin-brand-logo" />
          </span>
          <div>
            <strong>AgriLearn Admin</strong>
            <p>Secure access for platform administrators only</p>
          </div>
        </div>

        <h1>Administrator sign in</h1>
        <p className="admin-login-sub">
          Student accounts cannot access this area. There is no public admin
          registration.
        </p>

        <form onSubmit={handleSubmit} className="admin-login-form">
          {successNote ? (
            <p className="admin-form-success" role="status">
              {successNote}
            </p>
          ) : null}
          {error ? (
            <p className="admin-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <label htmlFor="admin-email">Admin email</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />

          <label htmlFor="admin-password">Password</label>
          <PasswordInput
            id="admin-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={submitting}
          />

          <p className="admin-forgot">
            <Link to="/admin/forgot-password">Forgot password?</Link>
          </p>

          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="admin-login-footer">
          <Link to="/">Back to AgriLearn</Link>
          {" · "}
          <Link to={STUDENT_LOGIN_PATH}>Student login</Link>
        </p>
      </div>
    </div>
  );
}

export default AdminLogin;
