import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getDashboardBasePath,
  isValidLevel,
  normalizeLevel,
} from "./levelPaths";

/**
 * Ensures the URL level matches the authenticated student's saved level.
 * Wrong or unknown levels are redirected to the correct dashboard home.
 */
function LevelGate({ children }) {
  const { level: levelParam } = useParams();
  const { student, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading-screen" role="status">
        Loading your AgriLearn account...
      </div>
    );
  }

  const studentLevel = normalizeLevel(student?.level);

  if (!studentLevel) {
    return <Navigate to="/login" replace />;
  }

  if (!isValidLevel(levelParam) || levelParam !== studentLevel) {
    return <Navigate to={getDashboardBasePath(studentLevel)} replace />;
  }

  return children;
}

export default LevelGate;
