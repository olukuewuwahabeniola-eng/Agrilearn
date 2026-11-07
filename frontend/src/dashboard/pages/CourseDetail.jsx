import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  downloadNoteFile,
  fetchNoteFileBlob,
  formatBytes,
  formatNoteDate,
  listNotes,
} from "../../utils/notesApi";
import { recordCourseAccess } from "../../utils/dashboardApi";
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
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

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
      const notesData = await listNotes({
        library: "official",
        courseCode: course.code,
      });
      const list = Array.isArray(notesData.notes) ? notesData.notes : [];
      const courseCode = String(course.code).toUpperCase();
      setNotes(
        list.filter(
          (note) => String(note.courseCode || "").toUpperCase() === courseCode
        )
      );
    } catch (error) {
      setNotes([]);
      setNotesError(error.message || "Could not load PDF materials.");
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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreview(null);
  };

  const openPreview = async (note) => {
    setPreview(note);
    setPreviewLoading(true);
    setNotesError("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    try {
      const blob = await fetchNoteFileBlob(note.id);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setNotesError(err.message || "Could not open PDF.");
      setPreview(null);
    } finally {
      setPreviewLoading(false);
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

  return (
    <section className="page-card page-hero">
      <PageHeader
        title={`${course.code} — ${course.title}`}
        fallback={`${base}/courses`}
      />

      <div className="section-head">
        <h2>PDF materials</h2>
      </div>

      {notesError ? <p className="notes-error">{notesError}</p> : null}

      {notesLoading ? (
        <div className="empty-state">
          <strong>Loading PDFs…</strong>
          Fetching materials for this course.
        </div>
      ) : notes.length === 0 ? (
        <div className="empty-state">
          <strong>No PDF materials yet</strong>
          There are no PDFs available for this course right now.
        </div>
      ) : (
        <ul className="course-notes-list">
          {notes.map((note) => (
            <li key={note.id}>
              <div>
                <strong>{note.title}</strong>
                <span>
                  {note.originalName}
                  {note.size ? ` · ${formatBytes(note.size)}` : ""}
                  {note.createdAt ? ` · ${formatNoteDate(note.createdAt)}` : ""}
                </span>
              </div>
              <div className="course-note-actions">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => openPreview(note)}
                >
                  View
                </button>
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
          ))}
        </ul>
      )}

      {preview ? (
        <div
          className="pq-preview-backdrop"
          role="presentation"
          onClick={closePreview}
        >
          <div
            className="pq-preview-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="pq-preview-head">
              <div>
                <h2>{preview.title}</h2>
                <p className="muted">
                  {course.code} — {course.title}
                  {preview.originalName ? ` · ${preview.originalName}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                onClick={closePreview}
              >
                Close
              </button>
            </header>

            {previewLoading ? (
              <p className="notes-status">Loading preview…</p>
            ) : null}

            {!previewLoading && previewUrl ? (
              <iframe
                title={`${preview.title} PDF`}
                className="pq-preview-pdf"
                src={previewUrl}
              />
            ) : null}

            <footer className="pq-preview-foot">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  downloadNoteFile(
                    preview.id,
                    preview.originalName || "notes.pdf"
                  ).catch((err) => setNotesError(err.message))
                }
              >
                Download
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default CourseDetail;
