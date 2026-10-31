import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthContext";

function AdminProtectedRoute({ children }) {
  const {
    isAuthenticated,
    loading,
    restoreError,
    hasSessionHint,
    retrySession,
  } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="admin-loading-screen" role="status">
        Restoring your admin session...
      </div>
    );
  }

  // Transient backend/network failure while a session may still be valid —
  // do not bounce to login (that looked like an unexpected logout on refresh).
  if (!isAuthenticated && restoreError && hasSessionHint) {
    return (
      <div className="admin-loading-screen" role="alert">
        <div style={{ textAlign: "center", maxWidth: 360, padding: "1rem" }}>
          <strong style={{ display: "block", marginBottom: "0.5rem" }}>
            Session check failed
          </strong>
          <p style={{ margin: "0 0 1rem", color: "#5f7366", fontSize: "0.92rem" }}>
            {restoreError}
          </p>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => retrySession()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
    );
  }

  return children;
}

export default AdminProtectedRoute;
