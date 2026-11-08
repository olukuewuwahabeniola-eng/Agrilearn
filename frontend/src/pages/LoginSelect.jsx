import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import {
  ADMIN_LOGIN_PATH,
  STUDENT_LOGIN_PATH,
  goBackFromLoginSelection,
} from "../utils/authNavigation";

function StudentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4.5 3.5 9 12 13.5 20.5 9 12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M7 11.2v4.1c0 .4.2.8.6 1 1.3.7 2.8 1.1 4.4 1.1s3.1-.4 4.4-1.1c.4-.2.6-.6.6-1v-4.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20.5 9v6.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 5 6.2v5.1c0 4.1 2.8 7.8 7 8.7 4.2-.9 7-4.6 7-8.7V6.2L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.1 11.1 14l3.7-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoginSelect() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AuthLayout
      framed={false}
      backLabel="Back"
      onBack={() => goBackFromLoginSelection(navigate, location)}
    >
      <section className="login-select" aria-labelledby="login-select-title">
        <span className="auth-badge">Welcome to AgriLearn</span>
        <h1 id="login-select-title">Choose how you want to sign in</h1>
        <p className="auth-lead">
          Select the login option that matches your account.
        </p>

        <div className="login-select-grid">
          <article className="login-select-card">
            <span className="login-select-icon" aria-hidden="true">
              <StudentIcon />
            </span>
            <h2>Student Login</h2>
            <p>
              Access your courses, learning materials, AI Assistant and student
              community.
            </p>
            <Link to={STUDENT_LOGIN_PATH} className="btn btn-primary">
              Student Login
            </Link>
          </article>

          <article className="login-select-card">
            <span className="login-select-icon" aria-hidden="true">
              <AdminIcon />
            </span>
            <h2>Admin Login</h2>
            <p>
              Access the AgriLearn administration dashboard and management
              tools.
            </p>
            <Link to={ADMIN_LOGIN_PATH} className="btn btn-primary">
              Admin Login
            </Link>
          </article>
        </div>
      </section>
    </AuthLayout>
  );
}

export default LoginSelect;
