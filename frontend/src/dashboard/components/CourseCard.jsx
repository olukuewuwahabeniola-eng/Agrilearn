import { Link } from "react-router-dom";
import { useDashboardBase } from "../hooks/useDashboardBase";

function CourseCard({ course, style }) {
  const base = useDashboardBase();
  const progressLabel =
    course.topicsTotal > 0
      ? `${course.topicsCompleted}/${course.topicsTotal} topics`
      : "Not started";

  const progressWidth =
    course.topicsTotal > 0
      ? `${(course.topicsCompleted / course.topicsTotal) * 100}%`
      : "0%";

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
          <span>Progress</span>
          <span>{progressLabel}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: progressWidth }} />
        </div>
        <span className="course-open-btn">Open Course</span>
      </div>
    </Link>
  );
}

export default CourseCard;
