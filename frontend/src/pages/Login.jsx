import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordInput from "../components/auth/PasswordInput";
import { useAuth } from "../context/AuthContext";
import { resolvePostLoginPath } from "../dashboard/levelPaths";
import { validateLogin } from "../utils/authValidation";
import { apiFetch } from "../utils/api";
import { LOGIN_SELECTION_PATH } from "../utils/authNavigation";

const INITIAL = {
  identifier: "",
  password: "",
};

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginSuccess } = useAuth();
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(location.state?.notice || "");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setSuccess("");
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const nextErrors = validateLogin(values);
    setErrors(nextErrors);
    setFormError("");
    setSuccess("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });

      loginSuccess(data.token, data.student);
      setSuccess(data.message || "Logged in successfully.");

      const redirectTo = resolvePostLoginPath(
        location.state?.from,
        data.student?.level
      );
      setTimeout(() => {
        navigate(redirectTo, { replace: true });
      }, 500);
    } catch (error) {
      if (error.data?.errors) {
        setErrors(error.data.errors);
      }
      setFormError(
        error.message || "Could not log you in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout backTo={LOGIN_SELECTION_PATH} backLabel="Back">
      <span className="auth-badge">Welcome back</span>
      <h1>Log in to AgriLearn</h1>
      <p className="auth-lead">
        Enter your student email or matriculation number to continue.
      </p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="identifier">Student email or matriculation number</label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            placeholder="Email or matric number"
            value={values.identifier}
            onChange={handleChange}
            className={errors.identifier ? "input-error" : ""}
            aria-invalid={Boolean(errors.identifier)}
            disabled={loading}
          />
          {errors.identifier && (
            <p className="field-error">{errors.identifier}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={values.password}
            onChange={handleChange}
            className={errors.password ? "input-error" : ""}
            aria-invalid={Boolean(errors.password)}
            disabled={loading}
          />
          {errors.password && <p className="field-error">{errors.password}</p>}
          <p className="auth-forgot">
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
        </div>

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

        <button
          type="submit"
          className="btn btn-primary auth-submit"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>

      <p className="auth-switch">
        New to AgriLearn? <Link to="/signup">Sign Up</Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
