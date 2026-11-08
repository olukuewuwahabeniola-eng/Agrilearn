import { Link } from "react-router-dom";
import "./AuthLayout.css";

function Logo() {
  return (
    <Link to="/" className="logo" aria-label="AgriLearn home">
      <svg className="logo-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#166534" />
        <path d="M14 22c0-6 6-11 10-12 0 8-3 14-10 17z" fill="#86EFAC" />
        <path d="M34 22c0-6-6-11-10-12 0 8 3 14 10 17z" fill="#4ADE80" />
        <path
          d="M24 16v20"
          stroke="#BBF7D0"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path d="M15 14h18l-1.5 4.5h-15L15 14z" fill="#F0FDF4" />
        <path
          d="M14 14c0-3 4.5-5.5 10-5.5S34 11 34 14"
          stroke="#F0FDF4"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="logo-text">
        <span className="logo-name">AgriLearn</span>
        <span className="logo-tagline">Learn • Practice • Excel</span>
      </span>
    </Link>
  );
}

function AuthBack({ backTo, backLabel, onBack }) {
  const label = (
    <>
      <span aria-hidden="true">←</span> {backLabel}
    </>
  );

  if (onBack) {
    return (
      <button type="button" className="auth-back" onClick={onBack}>
        {label}
      </button>
    );
  }

  return (
    <Link to={backTo} className="auth-back">
      {label}
    </Link>
  );
}

function AuthLayout({
  children,
  wide = false,
  framed = true,
  backTo = "/",
  backLabel = "Back to Home",
  onBack,
}) {
  const year = new Date().getFullYear();

  return (
    <div className="auth-page">
      <header className="auth-header">
        <div className="container auth-header-inner">
          <Logo />
          <AuthBack backTo={backTo} backLabel={backLabel} onBack={onBack} />
        </div>
      </header>

      <main className="auth-main">
        <div className="container">
          {framed ? (
            <div className={`auth-card${wide ? " auth-card-wide" : ""}`}>
              {children}
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      <footer className="auth-footer">
        © {year} AgriLearn. Learn • Practice • Excel
      </footer>
    </div>
  );
}

export default AuthLayout;
