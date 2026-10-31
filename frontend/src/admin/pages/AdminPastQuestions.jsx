import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../utils/adminApi";
import {
  createAdminPastQuestion,
  deleteAdminPastQuestion,
  listAdminPastQuestions,
  replaceAdminPastQuestionFiles,
  updateAdminPastQuestion,
} from "../../utils/adminPastQuestionsApi";
import { formatNoteDate } from "../../utils/notesApi";
import { validateImageFiles, validatePdfFile } from "../../utils/uploadLimits";
import { useAdminLevel } from "../AdminLevelContext";

function AdminPastQuestions() {
  const { isSuperAdmin, assignedLevel, levels } = useAdminLevel();
  const [level, setLevel] = useState(assignedLevel || "100");
  const [courseCode, setCourseCode] = useState("");
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(true);
  const [uploadMode, setUploadMode] = useState("pdf");
  const [pdfFile, setPdfFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);

  const [courses, setCourses] = useState([]);
  const [items, setItems] = useState([]);
  const [filterLevel, setFilterLevel] = useState(assignedLevel || "");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterPublished, setFilterPublished] = useState("");
  const [filterQ, setFilterQ] = useState("");

  useEffect(() => {
    if (!isSuperAdmin && assignedLevel) {
      setLevel(assignedLevel);
      setFilterLevel(assignedLevel);
    }
  }, [isSuperAdmin, assignedLevel]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editCourses, setEditCourses] = useState([]);
  const [replaceMode, setReplaceMode] = useState("pdf");
  const [replacePdf, setReplacePdf] = useState(null);
  const [replaceImages, setReplaceImages] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

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

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminPastQuestions({
        level: filterLevel,
        courseCode: filterCourse,
        examYear: filterYear,
        published: filterPublished,
        q: filterQ.trim(),
      });
      setItems(Array.isArray(data.pastQuestions) ? data.pastQuestions : []);
    } catch (err) {
      setItems([]);
      setError(err.message || "Could not load past questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadItems();
    }, filterQ ? 280 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLevel, filterCourse, filterYear, filterPublished, filterQ]);

  const yearOptions = useMemo(() => {
    const years = new Set(items.map((item) => item.examYear));
    const current = new Date().getFullYear();
    for (let y = current; y >= current - 15; y -= 1) years.add(y);
    return [...years].sort((a, b) => b - a);
  }, [items]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setStatus("");
    setError("");

    if (!courseCode) {
      setError("Select or enter a course code.");
      return;
    }
    if (!examYear.trim()) {
      setError("Enter the examination year.");
      return;
    }

    if (uploadMode === "pdf") {
      const pdfError = validatePdfFile(pdfFile);
      if (pdfError) {
        setError(
          pdfError === "Choose a PDF to upload."
            ? "Choose a PDF file to upload."
            : pdfError
        );
        return;
      }
    } else {
      const imagesError = validateImageFiles(imageFiles);
      if (imagesError) {
        setError(imagesError);
        return;
      }
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("level", level);
      form.append("courseCode", courseCode);
      form.append("examYear", examYear.trim());
      form.append("description", description.trim());
      form.append("published", published ? "true" : "false");
      if (uploadMode === "pdf" && pdfFile) {
        form.append("pdf", pdfFile);
      } else {
        imageFiles.forEach((file) => form.append("images", file));
      }

      const data = await createAdminPastQuestion(form);
      setStatus(data.message || "Past question uploaded.");
      setPdfFile(null);
      setImageFiles([]);
      setDescription("");
      await loadItems();
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const openEdit = async (item) => {
    setEditItem(item);
    setEditForm({
      level: item.level,
      courseCode: item.courseCode,
      examYear: String(item.examYear),
      description: item.description || "",
      published: item.published,
    });
    setReplaceMode(item.format === "images" ? "images" : "pdf");
    setReplacePdf(null);
    setReplaceImages([]);
    try {
      const data = await adminFetch(`/api/admin/courses?level=${item.level}`);
      setEditCourses(Array.isArray(data.courses) ? data.courses : []);
    } catch {
      setEditCourses([]);
    }
  };

  const closeEdit = () => {
    setEditItem(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editItem || !editForm) return;
    setSavingEdit(true);
    setError("");
    setStatus("");
    try {
      await updateAdminPastQuestion(editItem.id, {
        level: editForm.level,
        courseCode: editForm.courseCode,
        examYear: editForm.examYear,
        description: editForm.description,
        published: editForm.published,
      });

      const shouldReplace =
        (replaceMode === "pdf" && replacePdf) ||
        (replaceMode === "images" && replaceImages.length);

      if (shouldReplace) {
        if (replaceMode === "pdf" && replacePdf) {
          const pdfError = validatePdfFile(replacePdf);
          if (pdfError) {
            setError(pdfError);
            setSavingEdit(false);
            return;
          }
        } else if (replaceImages.length) {
          const imagesError = validateImageFiles(replaceImages);
          if (imagesError) {
            setError(imagesError);
            setSavingEdit(false);
            return;
          }
        }

        const form = new FormData();
        if (replaceMode === "pdf" && replacePdf) {
          form.append("pdf", replacePdf);
        } else if (replaceImages.length) {
          replaceImages.forEach((file) => form.append("images", file));
        }
        await replaceAdminPastQuestionFiles(editItem.id, form);
      }

      setStatus("Past question updated.");
      closeEdit();
      await loadItems();
    } catch (err) {
      setError(err.message || "Could not save changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = window.confirm(
      `Delete past question for ${item.courseCode} (${item.examYear})? Files will be removed permanently.`
    );
    if (!ok) return;
    setError("");
    try {
      await deleteAdminPastQuestion(item.id);
      setStatus("Past question deleted.");
      await loadItems();
    } catch (err) {
      setError(err.message || "Delete failed.");
    }
  };

  const togglePublish = async (item) => {
    try {
      await updateAdminPastQuestion(item.id, { published: !item.published });
      setStatus(item.published ? "Unpublished." : "Published.");
      await loadItems();
    } catch (err) {
      setError(err.message || "Could not update publication status.");
    }
  };

  return (
    <section>
      <header className="admin-page-header">
        <h1>Manage Past Questions</h1>
        <p>
          Upload examination papers as PDFs or photographed pages. Group multiple
          images as one paper — not a quiz or manual question entry tool.
        </p>
      </header>

      <div className="admin-panel">
        <h2>Upload past question</h2>
        <form onSubmit={handleCreate}>
          <div className="admin-toolbar">
            <div className="admin-field" style={{ maxWidth: 140 }}>
              <label htmlFor="pq-level">Level</label>
              {isSuperAdmin ? (
                <select
                  id="pq-level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  {levels.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl} Level
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="pq-level"
                  value={`${level} Level`}
                  disabled
                  readOnly
                />
              )}
            </div>
            <div className="admin-field">
              <label htmlFor="pq-course">Course code</label>
              <select
                id="pq-course"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
              >
                <option value="">Select course…</option>
                {courses.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field" style={{ maxWidth: 140 }}>
              <label htmlFor="pq-year">Exam year</label>
              <input
                id="pq-year"
                type="number"
                min="1970"
                max="2100"
                value={examYear}
                onChange={(e) => setExamYear(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor="pq-desc">Description (optional)</label>
            <textarea
              id="pq-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. First semester examination"
              maxLength={500}
            />
          </div>

          <div className="admin-act-filter-pills" style={{ marginTop: "0.5rem" }}>
            <button
              type="button"
              className={uploadMode === "pdf" ? "active" : ""}
              onClick={() => setUploadMode("pdf")}
            >
              PDF file
            </button>
            <button
              type="button"
              className={uploadMode === "images" ? "active" : ""}
              onClick={() => setUploadMode("images")}
            >
              Pictures (multi-page)
            </button>
          </div>

          {uploadMode === "pdf" ? (
            <div className="admin-field">
              <label htmlFor="pq-pdf">PDF file (max 25 MB)</label>
              <input
                id="pq-pdf"
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              />
            </div>
          ) : (
            <div className="admin-field">
              <label htmlFor="pq-images">
                Images (JPG/PNG — max 10 MB each, 50 MB combined)
              </label>
              <input
                id="pq-images"
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                multiple
                onChange={(e) =>
                  setImageFiles(Array.from(e.target.files || []))
                }
              />
              {imageFiles.length ? (
                <span className="admin-muted">{imageFiles.length} file(s) selected</span>
              ) : null}
            </div>
          )}

          <label className="admin-pq-check">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            Publish immediately (visible to students)
          </label>

          <div style={{ marginTop: "0.85rem" }}>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload past question"}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-panel">
        <h2>Uploaded past questions</h2>
        <div className="admin-toolbar">
          <div className="admin-field">
            <label htmlFor="f-q">Search course</label>
            <input
              id="f-q"
              type="search"
              placeholder="Course code or description…"
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
            />
          </div>
          <div className="admin-field" style={{ maxWidth: 130 }}>
            <label htmlFor="f-level">Level</label>
            {isSuperAdmin ? (
              <select
                id="f-level"
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
              >
                <option value="">All</option>
                {levels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="f-level"
                value={filterLevel || assignedLevel || ""}
                disabled
                readOnly
              />
            )}
          </div>
          <div className="admin-field" style={{ maxWidth: 130 }}>
            <label htmlFor="f-year">Year</label>
            <select
              id="f-year"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option value="">All</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field" style={{ maxWidth: 150 }}>
            <label htmlFor="f-pub">Status</label>
            <select
              id="f-pub"
              value={filterPublished}
              onChange={(e) => setFilterPublished(e.target.value)}
            >
              <option value="">All</option>
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </select>
          </div>
          <div className="admin-field" style={{ maxWidth: 160 }}>
            <label htmlFor="f-course">Course code</label>
            <input
              id="f-course"
              type="text"
              placeholder="e.g. AEF501"
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        {status ? <p className="admin-form-success">{status}</p> : null}
        {error ? <p className="admin-form-error">{error}</p> : null}
        {loading ? <p className="admin-muted">Loading past questions…</p> : null}

        {!loading && !items.length ? (
          <div className="admin-empty">
            <strong>No past questions yet</strong>
            Upload a PDF or images using the form above.
          </div>
        ) : null}

        {items.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Level</th>
                  <th>Year</th>
                  <th>Type</th>
                  <th>Pages</th>
                  <th>Uploaded</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.courseCode}</strong>
                      <div className="admin-muted">{item.courseTitle}</div>
                    </td>
                    <td>{item.level}</td>
                    <td>{item.examYear}</td>
                    <td>{item.fileType}</td>
                    <td>{item.pageCount}</td>
                    <td>{formatNoteDate(item.createdAt)}</td>
                    <td>
                      <span
                        className={`admin-badge${item.published ? "" : " admin-badge-draft"}`}
                      >
                        {item.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td>
                      <div className="admin-pq-actions">
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => togglePublish(item)}
                        >
                          {item.published ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => openEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-link-btn"
                          style={{ color: "#b91c1c" }}
                          onClick={() => handleDelete(item)}
                        >
                          Delete
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

      {editItem && editForm ? (
        <div
          className="admin-act-modal-backdrop"
          role="presentation"
          onClick={closeEdit}
        >
          <div
            className="admin-act-modal admin-pq-edit-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="admin-act-modal-head">
              <h2>Edit past question</h2>
              <button type="button" className="admin-act-icon-btn" onClick={closeEdit}>
                Close
              </button>
            </header>

            <div className="admin-toolbar">
              <div className="admin-field" style={{ maxWidth: 130 }}>
                <label htmlFor="e-level">Level</label>
                {isSuperAdmin ? (
                  <select
                    id="e-level"
                    value={editForm.level}
                    onChange={async (e) => {
                      const lvl = e.target.value;
                      setEditForm((f) => ({ ...f, level: lvl, courseCode: "" }));
                      try {
                        const data = await adminFetch(
                          `/api/admin/courses?level=${lvl}`
                        );
                        setEditCourses(
                          Array.isArray(data.courses) ? data.courses : []
                        );
                      } catch {
                        setEditCourses([]);
                      }
                    }}
                  >
                    {levels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="e-level"
                    value={editForm.level}
                    disabled
                    readOnly
                  />
                )}
              </div>
              <div className="admin-field">
                <label htmlFor="e-course">Course</label>
                <select
                  id="e-course"
                  value={editForm.courseCode}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, courseCode: e.target.value }))
                  }
                >
                  <option value="">Select…</option>
                  {editCourses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-field" style={{ maxWidth: 120 }}>
                <label htmlFor="e-year">Year</label>
                <input
                  id="e-year"
                  type="number"
                  value={editForm.examYear}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, examYear: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="admin-field">
              <label htmlFor="e-desc">Description</label>
              <textarea
                id="e-desc"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            <label className="admin-pq-check">
              <input
                type="checkbox"
                checked={editForm.published}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, published: e.target.checked }))
                }
              />
              Published (visible to students)
            </label>

            <h3 className="admin-pq-replace-title">Replace files (optional)</h3>
            <p className="admin-muted">
              Current: {editItem.fileType} · {editItem.pageCount} file(s). Uploading
              new files removes the old ones.
            </p>
            <div className="admin-act-filter-pills">
              <button
                type="button"
                className={replaceMode === "pdf" ? "active" : ""}
                onClick={() => setReplaceMode("pdf")}
              >
                New PDF
              </button>
              <button
                type="button"
                className={replaceMode === "images" ? "active" : ""}
                onClick={() => setReplaceMode("images")}
              >
                New images
              </button>
            </div>
            {replaceMode === "pdf" ? (
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setReplacePdf(e.target.files?.[0] || null)}
              />
            ) : (
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                multiple
                onChange={(e) =>
                  setReplaceImages(Array.from(e.target.files || []))
                }
              />
            )}

            <div className="admin-pq-edit-actions">
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={savingEdit}
                onClick={saveEdit}
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AdminPastQuestions;
