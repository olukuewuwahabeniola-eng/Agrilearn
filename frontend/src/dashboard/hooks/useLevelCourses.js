import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  getDashboardCourseByCode,
  getDashboardCourses,
} from "../data/dashboardCourses";
import { normalizeLevel } from "../levelPaths";

/** Active academic level + that level's course catalog. */
export function useLevelCourses() {
  const { level: levelParam } = useParams();
  const { student } = useAuth();
  const level =
    normalizeLevel(levelParam) || normalizeLevel(student?.level) || "500";
  const courses = getDashboardCourses(level);

  return {
    level,
    courses,
    getCourseByCode(code) {
      return getDashboardCourseByCode(level, code);
    },
  };
}
