import DocumentViewer from "../pdf/DocumentViewer";

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
  const subtitle = [
    note.courseCode,
    note.courseTitle,
    format === "images" ? "Images" : "PDF",
    pageCount > 1 ? `${pageCount} pages` : "",
  ]
    .filter(Boolean)
    .join(" · ")
    .replace(" — ", " · ");

  return (
    <DocumentViewer
      title={note.title}
      subtitle={
        note.courseCode
          ? `${note.courseCode}${note.courseTitle ? ` — ${note.courseTitle}` : ""} · ${
              format === "images" ? "Images" : "PDF"
            }${pageCount > 1 ? ` · ${pageCount} pages` : ""}`
          : subtitle
      }
      format={format}
      urls={urls}
      loading={loading}
      error={error}
      onClose={onClose}
      onDownload={onDownload}
    />
  );
}

export default NoteViewer;
