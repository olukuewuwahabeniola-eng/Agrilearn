import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  formatUploadDate,
  getDashboardOverview,
} from "../../utils/dashboardApi";
import CourseCard from "../components/CourseCard";
import { getFirstName } from "../data/courses";
import { useDashboardBase } from "../hooks/useDashboardBase";
import { useLevelCourses } from "../hooks/useLevelCourses";

const BANNER_IMAGE =
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1400&q=80";

function Overview() {
  const { student } = useAuth();
  const base = useDashboardBase();
  const { courses } = useLevelCourses();
  const [progressWidth, setProgressWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    notesAvailable: 0,
    quizzesCompleted: 0,
    learningProgress: null,
    learningProgressLabel: "No topics available yet",
    hasTopics: false,
  });
  const [recentUploads, setRecentUploads] = useState([]);

  const courseCount = courses.length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getDashboardOverview();
        if (cancelled) return;
        setStats({
          notesAvailable: data.stats?.notesAvailable ?? 0,
          quizzesCompleted: data.stats?.quizzesCompleted ?? 0,
          learningProgress: data.stats?.learningProgress,
          learningProgressLabel:
            data.stats?.learningProgressLabel || "No topics available yet",
          hasTopics: Boolean(data.stats?.hasTopics),
        });
        setRecentUploads(
          Array.isArray(data.recentUploads) ? data.recentUploads : []
        );
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load dashboard statistics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student?.id, student?._id]);

  useEffect(() => {
    const value = stats.hasTopics ? stats.learningProgress || 0 : 0;
    const timer = setTimeout(() => setProgressWidth(value), 120);
    return () => clearTimeout(timer);
  }, [stats.hasTopics, stats.learningProgress]);

  const notesNote = loading
    ? "Loading…"
    : stats.notesAvailable > 0
      ? "Official lecture notes"
      : "No notes published yet";

  const quizzesNote = loading
    ? "Loading…"
    : stats.quizzesCompleted > 0
      ? "Completed attempts"
      : "Start your first quiz";

  return (
    <>
      <section className="welcome-banner">
        <img src={BANNER_IMAGE} alt="" />
        <div className="welcome-banner-content">
          <h1>Welcome back, {getFirstName(student?.fullName)}!</h1>
          <p>Keep learning, keep growing — your agripreneur journey continues.</p>
          <div className="welcome-tags">
            {student?.level && <span>{student.level} Level</span>}
            {student?.department ? (
              <span>{student.department}</span>
            ) : (
              <span>Faculty of Agriculture</span>
            )}
          </div>
        </div>
      </section>

      {error ? <p className="notes-error">{error}</p> : null}

      <section className="stats-grid" aria-label="Learning statistics">
        <article className="stat-card">
          <div className="stat-icon green" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 5h7v14H4zM13 5h7v14h-7z" />
            </svg>
          </div>
          <h3>My Courses</h3>
          <div className="stat-value">{courseCount}</div>
          <p className="stat-note">Active courses</p>
        </article>

        <article className="stat-card">
          <div className="stat-icon blue" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M7 3h8l4 4v14H7V3z" />
            </svg>
          </div>
          <h3>Notes Available</h3>
          <div className="stat-value">
            {loading ? "…" : stats.notesAvailable}
          </div>
          <p className="stat-note">{notesNote}</p>
        </article>

        <article className="stat-card">
          <div className="stat-icon amber" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="8" />
              <path d="M9.5 10a2.5 2.5 0 114 2c-.7.6-1.5 1-1.5 2" strokeLinecap="round" />
            </svg>
          </div>
          <h3>Quizzes Completed</h3>
          <div className="stat-value">
            {loading ? "…" : stats.quizzesCompleted}
          </div>
          <p className="stat-note">{quizzesNote}</p>
        </article>

        <article className="stat-card">
          <div className="stat-icon teal" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 19V5M4 19h16" strokeLinecap="round" />
              <path d="M8 15v-4M12 15V8M16 15v-6" strokeLinecap="round" />
            </svg>
          </div>
          <h3>Learning Progress</h3>
          <div className="stat-value">
            {loading
              ? "…"
              : stats.hasTopics
                ? `${stats.learningProgress ?? 0}%`
                : "—"}
          </div>
          {stats.hasTopics ? (
            <div className="progress-track" aria-hidden="true">
              <div
                className="progress-fill"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          ) : (
            <p className="stat-note">
              {loading ? "Loading…" : "No topics available yet"}
            </p>
          )}
          {stats.hasTopics ? (
            <p className="stat-note">{stats.learningProgressLabel}</p>
          ) : null}
        </article>
      </section>

      <section>
        <div className="section-head">
          <h2>My Courses</h2>
          <Link to={`${base}/courses`}>View All</Link>
        </div>
        <div className="courses-grid">
          {courses.map((course, index) => (
            <CourseCard
              key={course.code}
              course={course}
              style={{ animationDelay: `${0.05 * index}s` }}
            />
          ))}
        </div>
      </section>

      <section className="lower-grid">
        <div className="uploads-card">
          <div className="section-head">
            <h2>Recent Uploads</h2>
            <Link to={`${base}/notes`}>View All</Link>
          </div>
          {loading ? (
            <div className="empty-state">
              <strong>Loading resources…</strong>
              Fetching the latest notes and past questions.
            </div>
          ) : recentUploads.length === 0 ? (
            <div className="empty-state">
              <strong>No uploads yet</strong>
              When notes or past questions are added, they will show here with
              file type, course code, and download actions.
            </div>
          ) : (
            <ul className="recent-uploads-list">
              {recentUploads.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.courseCode} · {item.fileType}
                      {item.createdAt
                        ? ` · ${formatUploadDate(item.createdAt)}`
                        : ""}
                    </span>
                  </div>
                  <Link
                    className="link-btn"
                    to={
                      item.kind === "past_question"
                        ? `${base}/past-questions`
                        : `${base}/notes`
                    }
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="actions-card">
          <div className="section-head">
            <h2>Quick Actions</h2>
          </div>
          <div className="quick-actions">
            <Link className="quick-action green" to={`${base}/notes`}>
              View Notes & Resources <span aria-hidden="true">›</span>
            </Link>
            <Link className="quick-action teal" to={`${base}/quizzes`}>
              Take a Quiz <span aria-hidden="true">›</span>
            </Link>
            <Link className="quick-action blue" to={`${base}/ai-assistant`}>
              Ask AI Assistant <span aria-hidden="true">›</span>
            </Link>
            <Link className="quick-action amber" to={`${base}/progress`}>
              Track My Progress <span aria-hidden="true">›</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export default Overview;
