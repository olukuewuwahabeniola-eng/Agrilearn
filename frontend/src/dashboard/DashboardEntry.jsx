import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { resolvePostLoginPath } from "./levelPaths";

/**
 * /dashboard entry — always bounce to the student's level dashboard.
 * Also remaps legacy paths like /dashboard/courses when matched as a parent.
 */
function DashboardEntry() {
  const { student } = useAuth();
  const location = useLocation();
  const target = resolvePostLoginPath(location.pathname + location.search, student?.level);
  return <Navigate to={target} replace />;
}

export default DashboardEntry;
