import { useParams } from "react-router-dom";
import { getDashboardBasePath, normalizeLevel } from "../levelPaths";
import { useAuth } from "../../context/AuthContext";

/**
 * Active dashboard base path from the URL level param,
 * falling back to the authenticated student's saved level.
 */
export function useDashboardBase() {
  const { level: levelParam } = useParams();
  const { student } = useAuth();
  const level = normalizeLevel(levelParam) || normalizeLevel(student?.level);
  return getDashboardBasePath(level);
}
