import { useEffect, useState } from "react";
import {
  completeTopic,
  getDashboardProgress,
} from "../../utils/dashboardApi";
import PageHeader from "../components/PageHeader";
import { useLevelCourses } from "../hooks/useLevelCourses";

function Progress() {
  const { courses } = useLevelCourses();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [notesAvailable, setNotesAvailable] = useState(0);
  const [quizzesCompleted, setQuizzesCompleted] = useState(0);
  const [progress, setProgress] = useState({
    hasTopics: false,
    progressPercent: null,
    completedTopics: 0,
    totalTopics: 0,
    courses: [],
    topics: [],
  });
  const [savingId, setSavingId] = useState("");

  const loadProgress = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getDashboardProgress();
      setNotesAvailable(data.notesAvailable ?? 0);
      setQuizzesCompleted(data.quizzesCompleted ?? 0);
      setProgress(
        data.progress || {
          hasTopics: false,
          progressPercent: null,
          completedTopics: 0,
          totalTopics: 0,
          courses: [],
          topics: [],
        }
      );
    } catch (err) {
      setError(err.message || "Could not load progress.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, []);

  const handleComplete = async (topic) => {
    if (!topic?.id || topic.completed) return;
    setSavingId(topic.id);
    setStatus("");
    setError("");
    try {
      const data = await completeTopic(topic.id);
      setProgress(data.progress || data.courseProgress || progress);
      setStatus(data.message || "Topic marked as completed.");
      const refreshed = await getDashboardProgress();
      setNotesAvailable(refreshed.notesAvailable ?? notesAvailable);
      setQuizzesCompleted(refreshed.quizzesCompleted ?? quizzesCompleted);
      if (refreshed.progress) setProgress(refreshed.progress);
    } catch (err) {
      setError(err.message || "Could not mark topic complete.");
    } finally {
      setSavingId("");
    }
  };

  const overallPercent = progress.hasTopics
    ? progress.progressPercent ?? 0
    : null;

  return (
    <section className="page-card page-hero">
      <PageHeader
        title="My Progress"
        subtitle="Track completion across your AgriLearn courses. Mark a topic complete after you study it."
      />

      {error ? <p className="notes-error">{error}</p> : null}
      {status ? <p className="notes-status">{status}</p> : null}

      <div className="stats-grid" style={{ marginTop: "1rem" }}>
        <article className="stat-card">
          <h3>Overall progress</h3>
          <div className="stat-value">
            {loading ? "…" : overallPercent === null ? "—" : `${overallPercent}%`}
          </div>
          {progress.hasTopics ? (
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${overallPercent || 0}%` }}
              />
            </div>
          ) : null}
          <p className="stat-note">
            {loading
              ? "Loading…"
              : progress.hasTopics
                ? `${progress.completedTopics} of ${progress.totalTopics} topics completed`
                : "No topics available yet"}
          </p>
        </article>
        <article className="stat-card">
          <h3>Courses</h3>
          <div className="stat-value">{courses.length}</div>
          <p className="stat-note">Listed in AgriLearn</p>
        </article>
        <article className="stat-card">
          <h3>Notes available</h3>
          <div className="stat-value">{loading ? "…" : notesAvailable}</div>
          <p className="stat-note">Official lecture notes</p>
        </article>
        <article className="stat-card">
          <h3>Quizzes</h3>
          <div className="stat-value">
            {loading ? "…" : quizzesCompleted}
          </div>
          <p className="stat-note">Completed attempts</p>
        </article>
      </div>

      {loading ? (
        <div className="empty-state" style={{ marginTop: "1.25rem" }}>
          <strong>Loading progress…</strong>
        </div>
      ) : !progress.hasTopics ? (
        <div className="empty-state" style={{ marginTop: "1.25rem" }}>
          <strong>No topics available yet</strong>
          When administrators publish lecture notes for your level, they appear
          here as topics you can mark complete after studying.
        </div>
      ) : (
        <div className="progress-course-list">
          {(progress.courses || []).map((course) => (
            <div key={course.courseCode} className="progress-course-block">
              <div className="section-head">
                <h2>
                  {course.courseCode}{" "}
                  <span className="progress-course-title">
                    {course.courseTitle}
                  </span>
                </h2>
                <span className="admin-muted">
                  {course.progressPercent ?? 0}% · {course.completedTopics}/
                  {course.totalTopics}
                </span>
              </div>
              <div className="progress-track" style={{ marginBottom: "0.75rem" }}>
                <div
                  className="progress-fill"
                  style={{ width: `${course.progressPercent || 0}%` }}
                />
              </div>
              <ul className="progress-topic-list">
                {(course.topics || []).map((topic) => (
                  <li key={topic.id}>
                    <div>
                      <strong>{topic.title}</strong>
                      <span>
                        {topic.completed ? "Completed" : "Not completed yet"}
                      </span>
                    </div>
                    {topic.completed ? (
                      <span className="topic-done-badge">Done</span>
                    ) : (
                      <button
                        type="button"
                        className="link-btn"
                        disabled={savingId === topic.id}
                        onClick={() => handleComplete(topic)}
                      >
                        {savingId === topic.id
                          ? "Saving…"
                          : "Mark as completed"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default Progress;
