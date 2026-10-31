import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordInput from "../components/auth/PasswordInput";
import { validateSignUp } from "../utils/authValidation";
import { apiFetch } from "../utils/api";

const INITIAL = {
  fullName: "",
  email: "",
  matricNumber: "",
  level: "",
  password: "",
  confirmPassword: "",
};

function SignUp() {
  const navigate = useNavigate();
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState("");
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

    const nextErrors = validateSignUp(values);
    setErrors(nextErrors);
    setFormError("");
    setSuccess("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(values),
      });

      setSuccess(data.message || "Account created successfully. Redirecting to login...");
      setValues(INITIAL);

      setTimeout(() => {
        navigate("/login", {
          state: {
            notice: "Account created successfully. Please log in.",
          },
        });
      }, 900);
    } catch (error) {
      if (error.data?.errors) {
        setErrors(error.data.errors);
      }
      setFormError(
        error.message || "Could not create your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout wide>
      <span className="auth-badge">Student account</span>
      <h1>Create your AgriLearn account</h1>
      <p className="auth-lead">
        Sign up to access notes, quizzes, and progress tracking for your level.
      </p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Your full name"
            value={values.fullName}
            onChange={handleChange}
            className={errors.fullName ? "input-error" : ""}
            aria-invalid={Boolean(errors.fullName)}
            disabled={loading}
          />
          {errors.fullName && <p className="field-error">{errors.fullName}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="email">Student email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={handleChange}
            className={errors.email ? "input-error" : ""}
            aria-invalid={Boolean(errors.email)}
            disabled={loading}
          />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="matricNumber">Matriculation number</label>
            <input
              id="matricNumber"
              name="matricNumber"
              type="text"
              autoComplete="off"
              placeholder="e.g. AGR/2024/001"
              value={values.matricNumber}
              onChange={handleChange}
              className={errors.matricNumber ? "input-error" : ""}
              aria-invalid={Boolean(errors.matricNumber)}
              disabled={loading}
            />
            {errors.matricNumber && (
              <p className="field-error">{errors.matricNumber}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="level">Academic level</label>
            <select
              id="level"
              name="level"
              value={values.level}
              onChange={handleChange}
              className={errors.level ? "input-error" : ""}
              aria-invalid={Boolean(errors.level)}
              disabled={loading}
            >
              <option value="">Select level</option>
              <option value="100">100 Level</option>
              <option value="200">200 Level</option>
              <option value="300">300 Level</option>
              <option value="500">500 Level</option>
            </select>
            {errors.level && <p className="field-error">{errors.level}</p>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={values.password}
              onChange={handleChange}
              className={errors.password ? "input-error" : ""}
              aria-invalid={Boolean(errors.password)}
              disabled={loading}
            />
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={values.confirmPassword}
              onChange={handleChange}
              className={errors.confirmPassword ? "input-error" : ""}
              aria-invalid={Boolean(errors.confirmPassword)}
              disabled={loading}
            />
            {errors.confirmPassword && (
              <p className="field-error">{errors.confirmPassword}</p>
            )}
          </div>
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
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Log In</Link>
      </p>
    </AuthLayout>
  );
}

export default SignUp;
