/** Index /api/dashboard/progress courses by course code. */
export function indexProgressCourses(courses = []) {
  const map = {};
  for (const row of courses) {
    const code = String(row?.courseCode || "").toUpperCase();
    if (code) map[code] = row;
  }
  return map;
}

/** Merge the Progress-page snapshot onto a catalog course for cards. */
export function applyCourseProgress(course, row) {
  return {
    ...course,
    topicsCompleted: row?.completedTopics ?? 0,
    topicsTotal: row?.totalTopics ?? 0,
    quizzesCompleted: row?.quizzesCompleted ?? 0,
    progressPercent: row?.progressPercent ?? null,
  };
}
