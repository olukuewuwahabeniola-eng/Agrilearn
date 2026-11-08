import { useEffect } from "react";
import PdfDocumentViewer from "./PdfDocumentViewer";
import "./document-viewer.css";

function DocumentViewer({
  open = true,
  title,
  subtitle,
  format = "pdf",
  urls = [],
  loading = false,
  error = "",
  onClose,
  onDownload,
  downloadLabel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isPdf = format !== "images";
  const label =
    downloadLabel || (isPdf ? "Download PDF" : "Download all pages");

  return (
    <div className="doc-viewer-backdrop" role="presentation" onClick={onClose}>
      <div
        className="doc-viewer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-viewer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="doc-viewer-head">
          <div>
            <h2 id="doc-viewer-title">{title || "Document"}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </header>

        {error ? <p className="doc-viewer-error">{error}</p> : null}
        {loading ? <p className="doc-viewer-status">Loading preview…</p> : null}

        {!loading && isPdf && urls[0] ? (
          <div className="doc-viewer-body">
            <PdfDocumentViewer src={urls[0]} />
          </div>
        ) : null}

        {!loading && !isPdf ? (
          <div className="doc-viewer-body">
            <div className="doc-viewer-gallery">
              {urls.map((url, index) => (
                <figure key={`${url}-${index}`}>
                  <img
                    src={url}
                    alt={`${title || "Document"} page ${index + 1}`}
                    loading="lazy"
                  />
                  <figcaption>Page {index + 1}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && !error && isPdf && !urls[0] ? (
          <p className="doc-viewer-error">This PDF could not be opened.</p>
        ) : null}

        <footer className="doc-viewer-foot">
          <span />
          {onDownload ? (
            <button type="button" className="btn btn-primary" onClick={onDownload}>
              {label}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

export default DocumentViewer;
