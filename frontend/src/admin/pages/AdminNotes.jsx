import { useEffect, useMemo, useState } from "react";
import NoteUploadComposer from "../../components/notes/NoteUploadComposer";
import NoteViewer from "../../components/notes/NoteViewer";
import { useDocumentPreview } from "../../hooks/useDocumentPreview";
import {
  adminFetch,
  downloadAdminNote,
  fetchAdminNotePreviewUrls,
  uploadAdminNote,
} from "../../utils/adminApi";
import { formatBytes } from "../../utils/notesApi";
import AdminPageHeader from "../components/AdminPageHeader";
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
  const preview = useDocumentPreview();

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
    <section className="admin-mgmt">
      <AdminPageHeader title="Upload Notes & Resources">
        {isSuperAdmin
          ? "Publish a PDF or several images as one official note. Students only see materials for their own academic level."
          : `Publish a PDF or several images as one official note for ${assignedLevel || level} Level. Students in other levels cannot see these files.`}
      </AdminPageHeader>

      {error ? <p className="admin-form-error">{error}</p> : null}
      {status ? <p className="admin-form-success">{status}</p> : null}

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Upload official note</h2>
            <p className="admin-panel-lede">
              Choose the level and course first, then add a title and the PDF or
              image pages. Files are stored securely and remain available after refresh.
            </p>
          </div>
        </div>

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
            <div className="admin-composer-block">
              <p className="admin-composer-label">Placement</p>
              <div className="admin-form-grid">
                <div className="admin-field">
                  <label htmlFor="note-level">Academic level</label>
                  {isSuperAdmin ? (
                    <select
                      id="note-level"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      disabled={uploading}
                    >
                      {levels.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl} Level
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
            </div>
          }
        />
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Uploaded resources</h2>
            <p className="admin-panel-lede">
              Notes already published for the selected level and course.
            </p>
          </div>
          <span className="admin-count">
            {loading ? "Loading…" : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="admin-toolbar">
          <div className="admin-field">
            <label htmlFor="notes-q">Search</label>
            <input
              id="notes-q"
              type="search"
              className="agri-search"
              placeholder="Search titles and files…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {loading ? <p className="admin-loading">Loading notes…</p> : null}

        {!loading && !notes.length ? (
          <div className="admin-empty">
            <div className="admin-empty-icon" aria-hidden="true" />
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
                  <th className="admin-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <div className="admin-cell-primary">{n.title}</div>
                    </td>
                    <td>
                      <div className="admin-cell-primary">
                        {n.fileType || "PDF"}
                        {n.pageCount > 1 ? ` · ${n.pageCount} pages` : ""}
                      </div>
                      {n.originalName ? (
                        <div className="admin-cell-sub">{n.originalName}</div>
                      ) : null}
                    </td>
                    <td>{n.courseCode}</td>
                    <td>
                      <span className="admin-badge">{n.level}</span>
                    </td>
                    <td>{formatBytes(n.size)}</td>
                    <td className="admin-col-actions">
                      <div className="admin-file-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost admin-btn-compact"
                          onClick={() => preview.open(n, fetchAdminNotePreviewUrls)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-outline admin-btn-compact"
                          onClick={() =>
                            downloadAdminNote(n).catch((err) =>
                              setError(err.message || "Download failed.")
                            )
                          }
                        >
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <NoteViewer
        note={preview.doc}
        urls={preview.urls}
        loading={preview.loading}
        error={preview.error}
        onClose={preview.close}
        onDownload={() =>
          preview.doc &&
          downloadAdminNote(preview.doc).catch((err) =>
            setError(err.message || "Download failed.")
          )
        }
      />
    </section>
  );
}

export default AdminNotes;
