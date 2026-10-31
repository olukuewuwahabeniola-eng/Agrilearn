import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import { useLevelCourses } from "../hooks/useLevelCourses";
import {
  downloadPastQuestionFile,
  fetchPastQuestionFileBlob,
  formatPastQuestionDate,
  listPastQuestions,
} from "../../utils/pastQuestionsApi";

function PastQuestions() {
  const { level, courses } = useLevelCourses();
  const [courseCode, setCourseCode] = useState("");
  const [examYear, setExamYear] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [preview, setPreview] = useState(null);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listPastQuestions({
        courseCode: courseCode || undefined,
        examYear: examYear || undefined,
        q: search.trim() || undefined,
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
    }, search ? 280 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseCode, examYear, search, level]);

  const yearOptions = useMemo(() => {
    const years = new Set(items.map((item) => item.examYear));
    return [...years].sort((a, b) => b - a);
  }, [items]);

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

  const openPreview = async (item) => {
    setPreview(item);
    setPreviewLoading(true);
    setStatus("");
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    try {
      const urls = [];
      for (let i = 0; i < item.pageCount; i += 1) {
        const blob = await fetchPastQuestionFileBlob(item.id, i);
        urls.push(URL.createObjectURL(blob));
      }
      setPreviewUrls(urls);
    } catch (err) {
      setStatus(err.message || "Could not load preview.");
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadAll = async (item) => {
    setStatus("");
    try {
      for (let i = 0; i < item.files.length; i += 1) {
        const file = item.files[i];
        const suffix =
          item.format === "images"
            ? file.originalName || `page-${i + 1}.jpg`
            : file.originalName || `${item.courseCode}-${item.examYear}.pdf`;
        // eslint-disable-next-line no-await-in-loop
        await downloadPastQuestionFile(item.id, i, suffix);
      }
      setStatus("Download started.");
    } catch (err) {
      setStatus(err.message || "Download failed.");
    }
  };

  return (
    <section className="page-card page-hero">
      <PageHeader
        title="Past Questions"
        subtitle={`Examination papers for ${level} Level — PDFs and scanned pages uploaded by AgriLearn.`}
      />

      <div className="notes-toolbar">
        <div className="notes-filters">
          <label htmlFor="pq-course">Course</label>
          <select
            id="pq-course"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
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
          <label htmlFor="pq-search">Search course code</label>
          <input
            id="pq-search"
            type="search"
            placeholder="e.g. AEF501"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="notes-filters">
          <label htmlFor="pq-year">Exam year</label>
          <select
            id="pq-year"
            value={examYear}
            onChange={(e) => setExamYear(e.target.value)}
          >
            <option value="">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status ? <p className="notes-status">{status}</p> : null}
      {error ? <p className="notes-error">{error}</p> : null}

      {loading ? (
        <div className="empty-state" style={{ marginTop: "1.25rem" }}>
          <strong>Loading past questions…</strong>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "1.25rem" }}>
          <strong>No published past questions yet</strong>
          Check back after your administrators publish papers for {level} Level.
        </div>
      ) : (
        <ul className="notes-grid">
          {items.map((item) => (
            <li key={item.id} className="notes-card">
              <div className="notes-card-top">
                <span className="notes-badge official">Past paper</span>
                <span className="notes-size">
                  {item.fileType}
                  {item.pageCount > 1 ? ` · ${item.pageCount} pages` : ""}
                </span>
              </div>
              <h3>
                {item.courseCode} · {item.examYear}
              </h3>
              <p className="notes-desc muted">{item.courseTitle}</p>
              {item.description ? (
                <p className="notes-desc">{item.description}</p>
              ) : null}
              <div className="notes-card-actions">
                <span>{formatPastQuestionDate(item.createdAt)}</span>
                <div>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => openPreview(item)}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => handleDownloadAll(item)}
                  >
                    Download
                  </button>
                </div>
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
                <h2>
                  {preview.courseCode} · {preview.examYear}
                </h2>
                <p className="muted">
                  {preview.courseTitle} · {preview.fileType}
                  {preview.pageCount > 1
                    ? ` · ${preview.pageCount} pages`
                    : ""}
                </p>
              </div>
              <button type="button" className="btn btn-outline" onClick={closePreview}>
                Close
              </button>
            </header>

            {previewLoading ? (
              <p className="notes-status">Loading preview…</p>
            ) : null}

            {!previewLoading && preview.format === "pdf" && previewUrls[0] ? (
              <iframe
                title={`${preview.courseCode} past question PDF`}
                className="pq-preview-pdf"
                src={previewUrls[0]}
              />
            ) : null}

            {!previewLoading && preview.format === "images" ? (
              <div className="pq-preview-gallery">
                {previewUrls.map((url, index) => (
                  <figure key={url}>
                    <img
                      src={url}
                      alt={`${preview.courseCode} page ${index + 1}`}
                      loading="lazy"
                    />
                    <figcaption>Page {index + 1}</figcaption>
                  </figure>
                ))}
              </div>
            ) : null}

            <footer className="pq-preview-foot">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleDownloadAll(preview)}
              >
                Download {preview.format === "images" ? "all pages" : "PDF"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default PastQuestions;
