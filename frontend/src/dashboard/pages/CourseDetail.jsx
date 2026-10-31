import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  downloadNoteFile,
  formatBytes,
  formatNoteDate,
  listNotes,
} from "../../utils/notesApi";
import {
  completeTopic,
  getDashboardProgress,
  recordCourseAccess,
} from "../../utils/dashboardApi";
import PageHeader from "../components/PageHeader";
import { useDashboardBase } from "../hooks/useDashboardBase";
import { useLevelCourses } from "../hooks/useLevelCourses";

function CourseDetail() {
  const { code } = useParams();
  const base = useDashboardBase();
  const { level, getCourseByCode } = useLevelCourses();
  const course = getCourseByCode(code);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState("");
  const [courseProgress, setCourseProgress] = useState(null);
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!course?.code) return undefined;
    recordCourseAccess(course.code).catch(() => {});
    return undefined;
  }, [course?.code]);

  const loadCourseData = async () => {
    if (!course?.code) return;
    setNotesLoading(true);
    setNotesError("");
    try {
      const [notesData, progressData] = await Promise.all([
        listNotes({
          library: "official",
          courseCode: course.code,
        }),
        getDashboardProgress(course.code),
      ]);
      setNotes(Array.isArray(notesData.notes) ? notesData.notes : []);
      setCourseProgress(progressData.progress || null);
    } catch (error) {
      setNotes([]);
      setNotesError(error.message || "Could not load notes.");
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!course?.code || cancelled) return;
      await loadCourseData();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.code]);

  const handleComplete = async (noteId) => {
    setSavingId(noteId);
    setStatus("");
    try {
      const data = await completeTopic(noteId);
      setCourseProgress(data.courseProgress || courseProgress);
      setStatus(data.message || "Topic marked as completed.");
      const refreshed = await getDashboardProgress(course.code);
      if (refreshed.progress) setCourseProgress(refreshed.progress);
    } catch (err) {
      setNotesError(err.message || "Could not mark topic complete.");
    } finally {
      setSavingId("");
    }
  };

  if (!course) {
    return (
      <section className="page-card page-hero">
        <PageHeader title="Course not found" fallback={`${base}/courses`} />
        <p>That course code is not in your {level} Level AgriLearn list.</p>
        <Link to={`${base}/courses`} className="link-btn">
          Back to My Courses
        </Link>
      </section>
    );
  }

  const completedMap = new Map(
    (courseProgress?.topics || []).map((t) => [t.id, t.completed])
  );
  const coursePercent = courseProgress?.hasTopics
    ? courseProgress.progressPercent ?? 0
    : null;

  return (
    <section className="page-card page-hero">
      <PageHeader
        title={course.code}
        subtitle={course.title}
        fallback={`${base}/courses`}
      />

      <div
        className="course-card-media"
        style={{ borderRadius: 16, marginBottom: "1rem" }}
      >
        <img
          src={course.image}
          alt={course.imageAlt || `${course.code} course image`}
        />
        <span className="course-level-badge">{course.levelLabel}</span>
      </div>

      <article className="stat-card" style={{ marginBottom: "1rem" }}>
        <h3>Course progress</h3>
        <div className="stat-value">
          {coursePercent === null ? "—" : `${coursePercent}%`}
        </div>
        {courseProgress?.hasTopics ? (
          <>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${coursePercent || 0}%` }}
              />
            </div>
            <p className="stat-note">
              {courseProgress.completedTopics} of {courseProgress.totalTopics}{" "}
              topics completed
            </p>
          </>
        ) : (
          <p className="stat-note">No topics available for this course yet</p>
        )}
      </article>

      {status ? <p className="notes-status">{status}</p> : null}

      <div className="lower-grid">
        <div className="uploads-card">
          <h2 style={{ marginBottom: "0.75rem" }}>Notes & Resources</h2>
          {notesLoading ? (
            <div className="empty-state">
              <strong>Loading notes…</strong>
              Fetching PDFs for {course.code}.
            </div>
          ) : notesError ? (
            <div className="empty-state">
              <strong>Could not load notes</strong>
              {notesError}
            </div>
          ) : notes.length === 0 ? (
            <div className="empty-state">
              <strong>No notes yet</strong>
              Official PDFs appear when administrators publish them for this
              course.
            </div>
          ) : (
            <ul className="course-notes-list">
              {notes.map((note) => {
                const done = Boolean(completedMap.get(note.id));
                return (
                  <li key={note.id}>
                    <div>
                      <strong>{note.title}</strong>
                      <span>
                        {note.originalName}
                        {note.size ? ` · ${formatBytes(note.size)}` : ""}
                        {note.createdAt
                          ? ` · ${formatNoteDate(note.createdAt)}`
                          : ""}
                        {done ? " · Completed" : ""}
                      </span>
                    </div>
                    <div className="course-note-actions">
                      {!done ? (
                        <button
                          type="button"
                          className="link-btn"
                          disabled={savingId === note.id}
                          onClick={() => handleComplete(note.id)}
                        >
                          {savingId === note.id ? "Saving…" : "Mark complete"}
                        </button>
                      ) : (
                        <span className="topic-done-badge">Done</span>
                      )}
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() =>
                          downloadNoteFile(
                            note.id,
                            note.originalName || "notes.pdf"
                          ).catch((err) => setNotesError(err.message))
                        }
                      >
                        Download
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to={`${base}/notes`} className="link-btn">
            Go to Notes & Resources
          </Link>
        </div>
        <div className="actions-card">
          <h2 style={{ marginBottom: "0.75rem" }}>Course actions</h2>
          <div className="quick-actions">
            <Link className="quick-action teal" to={`${base}/quizzes`}>
              Quizzes for this course <span aria-hidden="true">›</span>
            </Link>
            <Link
              className="quick-action blue"
              to={`${base}/ai-assistant?course=${course.code}`}
            >
              Ask AI about {course.code} <span aria-hidden="true">›</span>
            </Link>
            <Link className="quick-action amber" to={`${base}/past-questions`}>
              Past questions <span aria-hidden="true">›</span>
            </Link>
            <Link className="quick-action green" to={`${base}/progress`}>
              Track my progress <span aria-hidden="true">›</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CourseDetail;
