import { useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_IMAGES_PER_NOTE,
  validateNoteImageFiles,
  validatePdfFile,
} from "../../utils/uploadLimits";
import "./note-upload.css";

let previewId = 0;

function nextPreviewId() {
  previewId += 1;
  return `page-${previewId}`;
}

function NoteUploadComposer({
  idPrefix = "note",
  disabled = false,
  uploading = false,
  progress = 0,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  extraFields = null,
  submitLabel = "Upload",
  onSubmit,
}) {
  const [mode, setMode] = useState("pdf");
  const [pdfFile, setPdfFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropActive, setDropActive] = useState(false);
  const [localError, setLocalError] = useState("");
  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  useEffect(() => {
    return () => {
      pagesRef.current.forEach((page) => URL.revokeObjectURL(page.url));
    };
  }, []);

  const pageCount = mode === "images" ? pages.length : pdfFile ? 1 : 0;

  const replacePages = (files) => {
    setPages((current) => {
      current.forEach((page) => URL.revokeObjectURL(page.url));
      return files.map((file) => ({
        id: nextPreviewId(),
        file,
        url: URL.createObjectURL(file),
      }));
    });
  };

  const addImageFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const nextFiles = [...pages.map((page) => page.file), ...incoming];
    const error = validateNoteImageFiles(nextFiles);
    if (error) {
      setLocalError(error);
      return;
    }
    setLocalError("");
    setPages((current) => [
      ...current,
      ...incoming.map((file) => ({
        id: nextPreviewId(),
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  };

  const removePage = (id) => {
    setPages((current) => {
      const target = current.find((page) => page.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((page) => page.id !== id);
    });
  };

  const movePage = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= pages.length) return;
    setPages((current) => {
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };

  const reorderPages = (from, to) => {
    if (from === to || from == null || to == null) return;
    setPages((current) => {
      const copy = [...current];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  };

  const clearSelection = () => {
    replacePages([]);
    setPdfFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    clearSelection();
    setLocalError("");
    setMode(nextMode);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDropActive(false);
    if (disabled || uploading) return;
    const dropped = Array.from(event.dataTransfer?.files || []);
    if (!dropped.length) return;
    if (mode === "pdf") {
      const file = dropped[0];
      const error = validatePdfFile(file);
      if (error) {
        setLocalError(error);
        return;
      }
      setLocalError("");
      setPdfFile(file);
      return;
    }
    addImageFiles(dropped);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError("");
    if (mode === "pdf") {
      const error = validatePdfFile(pdfFile);
      if (error) {
        setLocalError(error);
        return;
      }
    } else {
      const error = validateNoteImageFiles(pages.map((page) => page.file));
      if (error) {
        setLocalError(error);
        return;
      }
    }

    await onSubmit({
      format: mode,
      pdfFile,
      imageFiles: pages.map((page) => page.file),
      title,
      description,
    });
    clearSelection();
  };

  const submitSafely = async (event) => {
    try {
      await handleSubmit(event);
    } catch {
      /* Parent surfaces the error; keep the selected files. */
    }
  };

  const progressLabel = useMemo(() => {
    if (!uploading) return "";
    if (progress >= 100) return "Saving note…";
    return `Uploading ${progress}%`;
  }, [uploading, progress]);

  return (
    <form className="note-composer" onSubmit={submitSafely}>
      {extraFields}

      {onTitleChange ? (
        <div className="admin-field notes-filters">
          <label htmlFor={`${idPrefix}-title`}>Title (optional)</label>
          <input
            id={`${idPrefix}-title`}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Lecture title"
            disabled={disabled || uploading}
          />
        </div>
      ) : null}

      {onDescriptionChange ? (
        <div className="admin-field notes-filters">
          <label htmlFor={`${idPrefix}-desc`}>Description (optional)</label>
          <textarea
            id={`${idPrefix}-desc`}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Short description"
            disabled={disabled || uploading}
          />
        </div>
      ) : null}

      <div className="note-composer-pills" role="tablist" aria-label="Upload type">
        <button
          type="button"
          className={mode === "pdf" ? "active" : ""}
          onClick={() => switchMode("pdf")}
          disabled={disabled || uploading}
        >
          PDF document
        </button>
        <button
          type="button"
          className={mode === "images" ? "active" : ""}
          onClick={() => switchMode("images")}
          disabled={disabled || uploading}
        >
          Images (multi-page)
        </button>
      </div>

      <div
        className={`note-composer-dropzone${dropActive ? " dragover" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!dropActive) setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleDrop}
      >
        {mode === "pdf" ? (
          <>
            <label htmlFor={`${idPrefix}-pdf`}>PDF file (max 25 MB)</label>
            <input
              id={`${idPrefix}-pdf`}
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              disabled={disabled || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (!file) {
                  setPdfFile(null);
                  return;
                }
                const error = validatePdfFile(file);
                if (error) {
                  setLocalError(error);
                  event.target.value = "";
                  return;
                }
                setLocalError("");
                setPdfFile(file);
              }}
            />
            {pdfFile ? (
              <div className="note-composer-pdf">
                <span>
                  {pdfFile.name} · 1 page
                </span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setPdfFile(null);
                    if (pdfInputRef.current) pdfInputRef.current.value = "";
                  }}
                  disabled={disabled || uploading}
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="note-composer-hint">
                Choose one PDF, or drop it here.
              </p>
            )}
          </>
        ) : (
          <>
            <label htmlFor={`${idPrefix}-images`}>
              Images (JPG, JPEG, PNG, WEBP — max 10 MB each, 50 MB combined)
            </label>
            <input
              id={`${idPrefix}-images`}
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              disabled={disabled || uploading}
              onChange={(event) => {
                addImageFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <p className="note-composer-hint">
              Select several pictures at once. They are saved as one note, in
              the order shown. Drag cards or use Move to rearrange. Maximum{" "}
              {MAX_IMAGES_PER_NOTE} pages.
            </p>
          </>
        )}
      </div>

      {mode === "images" ? (
        <p className="note-composer-count">
          Selected pages: <strong>{pageCount}</strong>
        </p>
      ) : null}

      {mode === "images" && pages.length ? (
        <ul className="note-composer-pages">
          {pages.map((page, index) => (
            <li key={page.id}>
              <figure
                className={`note-composer-page${dragIndex === index ? " dragging" : ""}`}
                draggable={!disabled && !uploading}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  reorderPages(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <img src={page.url} alt={`Page ${index + 1} preview`} />
                <figcaption>
                  <span>
                    Page {index + 1} · {page.file.name}
                  </span>
                  <div className="note-composer-page-actions">
                    <button
                      type="button"
                      onClick={() => movePage(index, -1)}
                      disabled={index === 0 || disabled || uploading}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => movePage(index, 1)}
                      disabled={index === pages.length - 1 || disabled || uploading}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => removePage(page.id)}
                      disabled={disabled || uploading}
                    >
                      Remove
                    </button>
                  </div>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      ) : null}

      {localError ? <p className="notes-error admin-form-error">{localError}</p> : null}

      {uploading ? (
        <div
          className="note-composer-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="note-composer-progress-track">
            <div
              className="note-composer-progress-bar"
              style={{ width: `${Math.max(8, progress)}%` }}
            />
          </div>
          <span className="note-composer-progress-label">{progressLabel}</span>
        </div>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary admin-btn admin-btn-primary"
        disabled={disabled || uploading}
      >
        {uploading ? "Uploading…" : submitLabel}
      </button>
    </form>
  );
}

export default NoteUploadComposer;
