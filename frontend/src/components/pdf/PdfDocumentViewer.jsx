import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

function PdfPage({ pdf, pageNumber, scale }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return undefined;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const outputScale = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext("2d", { alpha: false });
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const transform =
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
      await page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform,
      }).promise;
    })().catch(() => {
      /* page render errors surface on the parent load */
    });

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber, scale]);

  return (
    <figure className="pdf-page" data-page={pageNumber}>
      <canvas ref={canvasRef} className="pdf-page-canvas" />
      <figcaption>Page {pageNumber}</figcaption>
    </figure>
  );
}

function PdfDocumentViewer({ src }) {
  const [pdf, setPdf] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const scrollerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask;
    let loadedDoc;

    async function load() {
      setLoading(true);
      setError("");
      setPdf(null);
      try {
        loadingTask = getDocument({ url: src, withCredentials: false });
        loadedDoc = await loadingTask.promise;
        if (cancelled) {
          loadedDoc.destroy();
          return;
        }
        setPdf(loadedDoc);
        setPageCount(loadedDoc.numPages);
        setCurrentPage(1);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not display this PDF.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (src) load();

    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
      loadedDoc?.destroy?.();
    };
  }, [src]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !pageCount) return undefined;
    const figures = [...root.querySelectorAll(".pdf-page")];
    if (!figures.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const next = Number(visible?.target?.getAttribute("data-page"));
        if (next) setCurrentPage(next);
      },
      {
        root: root.closest(".doc-viewer-body") || root,
        threshold: 0.45,
      }
    );
    figures.forEach((figure) => observer.observe(figure));
    return () => observer.disconnect();
  }, [pageCount, pdf, scale]);

  const goToPage = (page) => {
    const next = Math.min(pageCount, Math.max(1, page));
    setCurrentPage(next);
    const target = scrollerRef.current?.querySelector(`[data-page="${next}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) return <p className="doc-viewer-status">Loading PDF…</p>;
  if (error) return <p className="doc-viewer-error">{error}</p>;
  if (!pdf) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <div className="pdf-viewer" ref={scrollerRef}>
      <div className="pdf-toolbar">
        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span>
          Page {currentPage} of {pageCount}
        </span>
        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= pageCount}
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => setScale((value) => Math.max(0.6, Number((value - 0.15).toFixed(2))))}
        >
          Zoom out
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => setScale((value) => Math.min(2.4, Number((value + 0.15).toFixed(2))))}
        >
          Zoom in
        </button>
      </div>
      <div className="pdf-pages">
        {pages.map((pageNumber) => (
          <PdfPage
            key={`${pageNumber}-${scale}`}
            pdf={pdf}
            pageNumber={pageNumber}
            scale={scale}
          />
        ))}
      </div>
    </div>
  );
}

export default PdfDocumentViewer;
