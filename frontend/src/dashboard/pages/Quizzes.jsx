import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  completeQuiz,
  formatUploadDate,
  listCompletedQuizzes,
} from "../../utils/dashboardApi";
import PageHeader from "../components/PageHeader";
import { useDashboardBase } from "../hooks/useDashboardBase";
import { useLevelCourses } from "../hooks/useLevelCourses";

function Quizzes() {
  const base = useDashboardBase();
  const { courses } = useLevelCourses();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAttempts = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listCompletedQuizzes();
      setAttempts(Array.isArray(data.attempts) ? data.attempts : []);
    } catch (err) {
      setAttempts([]);
      setError(err.message || "Could not load quiz history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttempts();
  }, []);

  useEffect(() => {
    if (!selectedCourse && courses[0]?.code) {
      setSelectedCourse(courses[0].code);
    }
  }, [courses, selectedCourse]);

  const handleMarkComplete = async () => {
    if (!selectedCourse) {
      setError("Select a course first.");
      return;
    }
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const data = await completeQuiz({
        courseCode: selectedCourse,
        quizTitle: `Practice quiz — ${selectedCourse}`,
      });
      setStatus(data.message || "Quiz marked as completed.");
      await loadAttempts();
    } catch (err) {
      setError(err.message || "Could not record quiz completion.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-card page-hero">
      <PageHeader
        title="Quizzes"
        subtitle="Generate practice quizzes with AI, then mark them completed when you finish."
      />

      {error ? <p className="notes-error">{error}</p> : null}
      {status ? <p className="notes-status">{status}</p> : null}

      <div className="dash-panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Mark a quiz completed</h2>
        <div className="notes-toolbar" style={{ marginBottom: "0.75rem" }}>
          <div className="notes-filters">
            <label htmlFor="quiz-course">Course</label>
            <select
              id="quiz-course"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
            >
              {courses.map((course) => (
                <option key={course.code} value={course.code}>
                  {course.code} — {course.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !selectedCourse}
            onClick={handleMarkComplete}
          >
            {saving ? "Saving…" : "Mark quiz completed"}
          </button>
        </div>
        <p className="stat-note">
          Generate a quiz in the AI Assistant, study it, then mark it completed
          here so your dashboard count updates.
        </p>
      </div>

      <div className="section-head" style={{ marginTop: "1.25rem" }}>
        <h2>Completed quizzes</h2>
        <span className="admin-muted">{attempts.length} total</span>
      </div>

      {loading ? (
        <div className="empty-state">
          <strong>Loading quiz history…</strong>
        </div>
      ) : attempts.length === 0 ? (
        <div className="empty-state">
          <strong>No quizzes completed yet</strong>
          Complete a practice quiz for a course to see it listed here.
        </div>
      ) : (
        <ul className="recent-uploads-list">
          {attempts.map((attempt) => (
            <li key={attempt.id}>
              <div>
                <strong>{attempt.quizTitle}</strong>
                <span>
                  {attempt.courseCode}
                  {attempt.score != null && attempt.maxScore != null
                    ? ` · Score ${attempt.score}/${attempt.maxScore}`
                    : ""}
                  {attempt.createdAt
                    ? ` · ${formatUploadDate(attempt.createdAt)}`
                    : ""}
                </span>
              </div>
              <span className="topic-done-badge">Completed</span>
            </li>
          ))}
        </ul>
      )}

      <div className="section-head" style={{ marginTop: "1.25rem" }}>
        <h2>Start from a course</h2>
      </div>
      <div className="courses-grid">
        {courses.map((course, index) => (
          <Link
            key={course.code}
            to={`${base}/ai-assistant?course=${course.code}`}
            className="course-card"
            style={{ animationDelay: `${0.05 * index}s` }}
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
              <span className="course-open-btn">Generate quiz with AI</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default Quizzes;
