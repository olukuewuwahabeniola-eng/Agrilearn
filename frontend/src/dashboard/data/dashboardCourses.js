import {
  getCoursesForLevel,
  getLevelCourseByCode,
} from "./levelCourses";

/**
 * Dashboard course catalog by academic level.
 * 500 Level objects stay exactly as defined in courses.js.
 * 100 / 200 / 300 keep their assigned codes/titles and use the same card shape.
 */
export function getDashboardCourses(level) {
  return getCoursesForLevel(level);
}

export function getDashboardCourseByCode(level, code) {
  return getLevelCourseByCode(level, code);
}
