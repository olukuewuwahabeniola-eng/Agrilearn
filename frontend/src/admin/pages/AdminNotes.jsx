import { useEffect, useMemo, useState } from "react";
import NoteUploadComposer from "../../components/notes/NoteUploadComposer";
import { adminFetch, uploadAdminNote } from "../../utils/adminApi";
import { formatBytes } from "../../utils/notesApi";
import { useAdminLevel } from "../AdminLevelContext";

function AdminNotes() {
  const { isSuperAdmin, assignedLevel, levels } = useAdminLevel();
  const [level, setLevel] = useState(assignedLevel || "100");
  const [courseCode, setCourseCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courses, setCourses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
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

  const handleUpload = async ({ format, pdfFile, imageFiles, title: noteTitle, description: noteDescription }) => {
    setStatus("");
    setError("");
    if (!courseCode) {
      setError("Select a course.");
      throw new Error("Select a course.");
    }

    setUploading(true);
    setProgress(0);
    try {
      const form = new FormData();
      form.append("level", level);
      form.append("courseCode", courseCode);
      if (noteTitle?.trim()) form.append("title", noteTitle.trim());
      if (noteDescription?.trim()) form.append("description", noteDescription.trim());
      if (format === "images") {
        imageFiles.forEach((file) => form.append("images", file));
      } else if (pdfFile) {
        form.append("pdf", pdfFile);
      }

      const data = await uploadAdminNote(form, { onProgress: setProgress });
      setStatus(data.message || "Uploaded.");
      setTitle("");
      setDescription("");
      await loadNotes();
    } catch (err) {
      setError(err.message || "Upload failed.");
      throw err;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <section>
      <header className="admin-page-header">
        <h1>Upload Notes & Resources</h1>
        <p>
          {isSuperAdmin
            ? "Publish a PDF or several images as one note for any academic level. Students only see materials for their own level."
            : `Publish a PDF or several images as one note for ${assignedLevel || level} Level only.`}
        </p>
      </header>

      <div className="admin-panel">
        <h2>Upload official note</h2>
        {error ? <p className="admin-form-error">{error}</p> : null}
        {status ? <p className="admin-form-success">{status}</p> : null}

        <NoteUploadComposer
          idPrefix="admin-note"
          uploading={uploading}
          progress={progress}
          title={title}
          onTitleChange={setTitle}
          description={description}
          onDescriptionChange={setDescription}
          submitLabel="Upload to library"
          onSubmit={handleUpload}
          extraFields={
            <div className="admin-toolbar">
              <div className="admin-field" style={{ maxWidth: 140 }}>
                <label htmlFor="note-level">Level</label>
                {isSuperAdmin ? (
                  <select
                    id="note-level"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    disabled={uploading}
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
                  disabled={uploading}
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
          }
        />
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
            Upload a PDF or images above, or clear search.
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
                    <td>
                      {n.fileType || "PDF"}
                      {n.pageCount > 1 ? ` · ${n.pageCount} pages` : ""}
                      {n.originalName ? ` · ${n.originalName}` : ""}
                    </td>
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
