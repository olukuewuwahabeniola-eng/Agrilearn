import { Link } from "react-router-dom";
import { useDashboardBase } from "../hooks/useDashboardBase";

function quizLabel(count) {
  if (count === 1) return "1 quiz";
  return `${count} quizzes`;
}

function CourseCard({ course, style }) {
  const base = useDashboardBase();
  const topicsTotal = Number(course.topicsTotal) || 0;
  const topicsCompleted = Number(course.topicsCompleted) || 0;
  const quizzesCompleted = Number(course.quizzesCompleted) || 0;
  const percent =
    topicsTotal > 0
      ? Math.min(
          100,
          Math.round(
            course.progressPercent != null
              ? course.progressPercent
              : (topicsCompleted / topicsTotal) * 100
          )
        )
      : 0;
  const isComplete = topicsTotal > 0 && topicsCompleted >= topicsTotal;
  const hasStarted = topicsCompleted > 0 || quizzesCompleted > 0;

  let progressLabel = "Not started";
  if (isComplete) {
    progressLabel = `${topicsCompleted}/${topicsTotal} topics`;
    if (quizzesCompleted > 0) {
      progressLabel += ` · ${quizLabel(quizzesCompleted)}`;
    }
  } else if (topicsTotal > 0) {
    progressLabel = `${percent}% · ${topicsCompleted}/${topicsTotal} topics`;
    if (quizzesCompleted > 0) {
      progressLabel += ` · ${quizLabel(quizzesCompleted)}`;
    }
  } else if (quizzesCompleted > 0) {
    progressLabel = `${quizLabel(quizzesCompleted)} completed`;
  }

  return (
    <Link
      to={`${base}/courses/${course.code}`}
      className="course-card"
      style={style}
    >
      <div className="course-card-media">
        <img
          src={course.image}
          alt={course.imageAlt || `${course.code} course image`}
          loading="lazy"
        />
        <span className="course-level-badge">{course.levelLabel}</span>
      </div>
      <div className="course-card-body">
        <div className="code">{course.code}</div>
        <p className="title">{course.title}</p>
        <div className="course-progress-label">
          <span>{isComplete ? "Completed" : hasStarted ? "In progress" : "Progress"}</span>
          <span>{progressLabel}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="course-open-btn">Open Course</span>
      </div>
    </Link>
  );
}

export default CourseCard;
