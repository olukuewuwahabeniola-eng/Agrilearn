import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import NoteViewer from "../../components/notes/NoteViewer";
import {
  downloadNote,
  fetchNotePreviewUrls,
  formatBytes,
  formatNoteDate,
  listNotes,
  noteFormatLabel,
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
  const [previewUrls, setPreviewUrls] = useState([]);
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
      setNotesError(error.message || "Could not load course materials.");
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
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const closePreview = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    setPreview(null);
  };

  const openPreview = async (note) => {
    setPreview(note);
    setPreviewLoading(true);
    setNotesError("");
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    try {
      const urls = await fetchNotePreviewUrls(note);
      setPreviewUrls(urls);
    } catch (err) {
      setNotesError(err.message || "Could not open that note.");
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
        <h2>Course materials</h2>
      </div>

      {notesError ? <p className="notes-error">{notesError}</p> : null}

      {notesLoading ? (
        <div className="empty-state">
          <strong>Loading materials…</strong>
          Fetching notes for this course.
        </div>
      ) : notes.length === 0 ? (
        <div className="empty-state">
          <strong>No course materials yet</strong>
          There are no official notes available for this course right now.
        </div>
      ) : (
        <ul className="course-notes-list">
          {notes.map((note) => (
            <li key={note.id}>
              <div>
                <strong>{note.title}</strong>
                <span>
                  {noteFormatLabel(note)}
                  {note.pageCount > 1 ? ` · ${note.pageCount} pages` : ""}
                  {note.originalName ? ` · ${note.originalName}` : ""}
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
                    downloadNote(note).catch((err) =>
                      setNotesError(err.message)
                    )
                  }
                >
                  Download
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <NoteViewer
        note={preview}
        urls={previewUrls}
        loading={previewLoading}
        error={notesError}
        onClose={closePreview}
        onDownload={() =>
          preview &&
          downloadNote(preview).catch((err) => setNotesError(err.message))
        }
      />
    </section>
  );
}

export default CourseDetail;
