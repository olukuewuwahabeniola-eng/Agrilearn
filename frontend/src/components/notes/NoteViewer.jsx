function NoteViewer({
  note,
  urls = [],
  loading = false,
  error = "",
  onClose,
  onDownload,
}) {
  if (!note) return null;

  const format = note.format === "images" ? "images" : "pdf";
  const pageCount = Math.max(1, Number(note.pageCount) || urls.length || 1);

  return (
    <div className="pq-preview-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pq-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-viewer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pq-preview-head">
          <div>
            <h2 id="note-viewer-title">{note.title}</h2>
            <p className="muted">
              {note.courseCode}
              {note.courseTitle ? ` — ${note.courseTitle}` : ""}
              {` · ${format === "images" ? "Images" : "PDF"}`}
              {pageCount > 1 ? ` · ${pageCount} pages` : ""}
            </p>
          </div>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </header>

        {error ? <p className="notes-error">{error}</p> : null}
        {loading ? <p className="notes-status">Loading preview…</p> : null}

        {!loading && format === "pdf" && urls[0] ? (
          <iframe
            title={`${note.title} PDF`}
            className="pq-preview-pdf"
            src={urls[0]}
          />
        ) : null}

        {!loading && format === "images" ? (
          <div className="pq-preview-gallery">
            {urls.map((url, index) => (
              <figure key={`${note.id}-${index}`}>
                <img
                  src={url}
                  alt={`${note.title} page ${index + 1}`}
                  loading="lazy"
                />
                <figcaption>Page {index + 1}</figcaption>
              </figure>
            ))}
          </div>
        ) : null}

        <footer className="pq-preview-foot">
          <button type="button" className="btn btn-primary" onClick={onDownload}>
            {format === "images" ? "Download all pages" : "Download PDF"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default NoteViewer;
