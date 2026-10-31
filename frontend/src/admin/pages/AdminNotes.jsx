import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../utils/adminApi";
import { validatePdfFile } from "../../utils/uploadLimits";
import { useAdminLevel } from "../AdminLevelContext";

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminNotes() {
  const { isSuperAdmin, assignedLevel, levels } = useAdminLevel();
  const [level, setLevel] = useState(assignedLevel || "100");
  const [courseCode, setCourseCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin && assignedLevel) setLevel(assignedLevel);
  }, [isSuperAdmin, assignedLevel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await adminFetch(`/api/admin/courses?level=${level}`);
        if (!cancelled) {
          setCourses(Array.isArray(data.courses) ? data.courses : []);
          setCourseCode("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load courses.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [level]);

  const loadNotes = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (level) params.set("level", level);
      if (courseCode) params.set("courseCode", courseCode);
      if (q.trim()) params.set("q", q.trim());
      const data = await adminFetch(`/api/admin/notes?${params.toString()}`);
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
    }, q ? 280 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, courseCode, q]);

  const courseOptions = useMemo(() => courses, [courses]);

  const handleUpload = async (event) => {
    event.preventDefault();
    setStatus("");
    setError("");
    if (!file) {
      setError("Choose a PDF to upload.");
      return;
    }
    const sizeError = validatePdfFile(file);
    if (sizeError) {
      setError(sizeError);
      return;
    }
    if (!courseCode) {
      setError("Select a course.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("pdf", file);
      form.append("level", level);
      form.append("courseCode", courseCode);
      if (title.trim()) form.append("title", title.trim());
      if (description.trim()) form.append("description", description.trim());

      const data = await adminFetch("/api/admin/notes", {
        method: "POST",
        body: form,
      });
      setStatus(data.message || "Uploaded.");
      setFile(null);
      setTitle("");
      setDescription("");
      await loadNotes();
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section>
      <header className="admin-page-header">
        <h1>Upload Notes & Resources</h1>
        <p>
          {isSuperAdmin
            ? "Publish lecture PDFs for any academic level. Students only see materials for their own level."
            : `Publish lecture PDFs for ${assignedLevel || level} Level only.`}
        </p>
      </header>

      <div className="admin-panel">
        <h2>Upload PDF</h2>
        <form onSubmit={handleUpload}>
          {error ? <p className="admin-form-error">{error}</p> : null}
          {status ? <p className="admin-form-success">{status}</p> : null}

          <div className="admin-toolbar">
            <div className="admin-field" style={{ maxWidth: 140 }}>
              <label htmlFor="note-level">Level</label>
              {isSuperAdmin ? (
                <select
                  id="note-level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  {levels.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="note-level"
                  value={`${level} Level`}
                  disabled
                  readOnly
                />
              )}
            </div>
            <div className="admin-field">
              <label htmlFor="note-course">Course</label>
              <select
                id="note-course"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
              >
                <option value="">Select course</option>
                {courseOptions.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-toolbar">
            <div className="admin-field">
              <label htmlFor="note-title">Title (optional)</label>
              <input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lecture title"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="note-file">PDF file (max 25 MB)</label>
              <input
                id="note-file"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div className="admin-field" style={{ marginBottom: "0.85rem" }}>
            <label htmlFor="note-desc">Description (optional)</label>
            <textarea
              id="note-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description for students"
            />
          </div>

          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Upload to library"}
          </button>
        </form>
      </div>

      <div className="admin-panel">
        <h2>Library</h2>
        <div className="admin-toolbar">
          <div className="admin-field">
            <label htmlFor="notes-q">Search</label>
            <input
              id="notes-q"
              type="search"
              placeholder="Search titles and files…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {loading ? <p className="admin-muted">Loading notes…</p> : null}

        {!loading && !notes.length ? (
          <div className="admin-empty">
            <strong>No notes for this filter</strong>
            Upload a PDF above or clear search.
          </div>
        ) : null}

        {notes.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>File</th>
                  <th>Course</th>
                  <th>Level</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n) => (
                  <tr key={n.id}>
                    <td>{n.title}</td>
                    <td>{n.originalName}</td>
                    <td>{n.courseCode}</td>
                    <td>
                      <span className="admin-badge">{n.level}</span>
                    </td>
                    <td>{formatBytes(n.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default AdminNotes;
