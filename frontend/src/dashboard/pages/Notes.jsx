import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteNote,
  downloadNoteFile,
  formatBytes,
  formatNoteDate,
  listNotes,
  uploadNote,
} from "../../utils/notesApi";
import { validatePdfFile } from "../../utils/uploadLimits";
import PageHeader from "../components/PageHeader";
import { useDashboardBase } from "../hooks/useDashboardBase";
import { useLevelCourses } from "../hooks/useLevelCourses";

function Notes() {
  const base = useDashboardBase();
  const { level, courses } = useLevelCourses();
  const [library, setLibrary] = useState("official");
  const [course, setCourse] = useState("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");

  const isPersonal = library === "personal";

  const loadNotes = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listNotes({
        library,
        courseCode: course || undefined,
        q: search.trim() || undefined,
      });
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } catch (err) {
      setNotes([]);
      setError(err.message || "Could not load notes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadNotes();
    }, search ? 250 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, course, search]);

  const courseLabel = useMemo(() => {
    if (!course) return `${level} Level — all courses`;
    const match = courses.find((item) => item.code === course);
    return match ? `${match.code} — ${match.title}` : course;
  }, [course, courses, level]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!course) {
      setStatus("Select a course before uploading a PDF.");
      return;
    }
    const sizeError = validatePdfFile(file);
    if (sizeError) {
      setStatus(sizeError);
      return;
    }

    setUploading(true);
    setStatus("");
    try {
      const data = await uploadNote({
        file,
        courseCode: course,
        title: file.name.replace(/\.pdf$/i, ""),
        description: "Personal upload",
      });
      setStatus(
        data.duplicated
          ? "That PDF is already in My Personal Uploads."
          : "PDF saved to My Personal Uploads."
      );
      setLibrary("personal");
      await loadNotes();
    } catch (err) {
      setStatus(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (note) => {
    try {
      await downloadNoteFile(note.id, note.originalName || "notes.pdf");
    } catch (err) {
      setStatus(err.message || "Download failed.");
    }
  };

  const handleDelete = async (note) => {
    const ok = window.confirm(
      `Delete “${note.title}” from My Personal Uploads? This cannot be undone.`
    );
    if (!ok) return;
    try {
      await deleteNote(note.id);
      setStatus("Personal upload deleted.");
      await loadNotes();
    } catch (err) {
      setStatus(err.message || "Delete failed.");
    }
  };

  return (
    <section className="page-card page-hero">
      <PageHeader
        title="Notes & Resources"
        subtitle={`Official materials from AgriLearn and your private uploads for ${level} Level.`}
      />

      <div className="material-library-tabs" role="tablist" aria-label="Material libraries">
        <button
          type="button"
          role="tab"
          aria-selected={library === "official"}
          className={`material-library-tab${library === "official" ? " active" : ""}`}
          onClick={() => setLibrary("official")}
        >
          <span className="material-tab-icon" aria-hidden="true">
            📚
          </span>
          General Materials
          <span className="material-tab-hint">Official · AgriLearn</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={library === "personal"}
          className={`material-library-tab${library === "personal" ? " active" : ""}`}
          onClick={() => setLibrary("personal")}
        >
          <span className="material-tab-icon" aria-hidden="true">
            📁
          </span>
          My Personal Uploads
          <span className="material-tab-hint">Private to you</span>
        </button>
      </div>

      <div className="notes-toolbar">
        <div className="notes-filters">
          <label htmlFor="notes-course">Course</label>
          <select
            id="notes-course"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          >
            <option value="">All {level} Level courses</option>
            {courses.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} — {item.title}
              </option>
            ))}
          </select>
        </div>

        <div className="notes-filters">
          <label htmlFor="notes-search">Search</label>
          <input
            id="notes-search"
            type="search"
            placeholder="Search titles, files, descriptions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isPersonal ? (
          <div className="notes-upload">
            <label htmlFor="notes-upload" className="btn btn-outline">
              {uploading ? "Uploading…" : "Upload PDF"}
            </label>
            <input
              id="notes-upload"
              type="file"
              accept="application/pdf"
              hidden
              disabled={uploading}
              onChange={handleUpload}
            />
          </div>
        ) : null}
      </div>

      <p className="notes-context">
        {isPersonal ? "My Personal Uploads" : "General Materials (Official)"} ·{" "}
        <strong>{courseLabel}</strong>
        {course ? (
          <>
            {" "}
            ·{" "}
            <Link to={`${base}/ai-assistant?course=${course}`}>
              Open in AI Assistant
            </Link>
          </>
        ) : null}
      </p>

      {status ? <p className="notes-status">{status}</p> : null}
      {error ? <p className="notes-error">{error}</p> : null}

      {loading ? (
        <div className="empty-state" style={{ marginTop: "1.25rem" }}>
          <strong>Loading resources…</strong>
          Fetching {isPersonal ? "your personal" : "official"} materials.
        </div>
      ) : notes.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "1.25rem" }}>
          <strong>No {isPersonal ? "personal uploads" : "official materials"} yet</strong>
          {isPersonal
            ? "Upload a PDF for a course — only you can see it here."
            : "Official PDFs appear when administrators publish them for your level."}
        </div>
      ) : (
        <ul className="notes-grid">
          {notes.map((note) => (
            <li key={note.id} className="notes-card">
              <div className="notes-card-top">
                <span
                  className={`notes-badge${note.source === "official" ? " official" : " personal"}`}
                >
                  {note.source === "official" ? "Official" : "Personal"}
                </span>
                <span className="notes-size">{formatBytes(note.size)}</span>
              </div>
              <h3>{note.title}</h3>
              <p className="notes-filename">
                {note.originalName} · {note.mimeType?.includes("pdf") ? "PDF" : "Document"}
              </p>
              <p className="notes-desc muted">
                {note.courseCode} — {note.courseTitle}
              </p>
              {note.description ? (
                <p className="notes-desc">{note.description}</p>
              ) : null}
              <div className="notes-card-actions">
                <span>{formatNoteDate(note.createdAt)}</span>
                <div>
                  <Link
                    to={`${base}/ai-assistant?course=${note.courseCode}`}
                    className="link-btn"
                  >
                    Use with AI
                  </Link>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => handleDownload(note)}
                  >
                    Download
                  </button>
                  {isPersonal ? (
                    <button
                      type="button"
                      className="link-btn danger"
                      onClick={() => handleDelete(note)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default Notes;
