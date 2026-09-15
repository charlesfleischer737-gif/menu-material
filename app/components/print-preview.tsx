"use client";
import { useEffect, useRef, useState } from "react";
export default function PrintPreview({
  blob,
  pages,
}: {
  blob: Blob;
  pages: number;
}) {
  const [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    setPage(1);
  }, [blob]);
  useEffect(() => {
    let active = true,
      destroy: (() => void) | undefined;
    setLoading(true);
    setError("");
    void (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const task = pdfjs.getDocument({
        data: await blob.arrayBuffer(),
      });
      destroy = () => {
        void task.destroy();
      };
      const doc = await task.promise;
      if (!active) {
        destroy();
        return;
      }
      const sheet = await doc.getPage(Math.min(page, doc.numPages));
      const viewport = sheet.getViewport({ scale: 1.5 });
      const temporary = document.createElement("canvas");
      temporary.width = viewport.width;
      temporary.height = viewport.height;
      await sheet.render({ canvas: temporary, viewport }).promise;
      if (active && canvas.current) {
        canvas.current.width = temporary.width;
        canvas.current.height = temporary.height;
        canvas.current.getContext("2d")!.drawImage(temporary, 0, 0);
        setLoading(false);
      }
    })().catch((e) => {
      if (active) {
        setError(e.message);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      destroy?.();
    };
  }, [blob, page]);
  return (
    <div className="cx-print-pages">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Actual print PDF, page ${page} of ${pages}`}
      />
      {loading && <p role="status">Preparing your print preview…</p>}
      {error && (
        <p role="alert">
          The preview could not open. You can still download the PDF. {error}
        </p>
      )}
      {pages > 1 && (
        <div className="cx-segment">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous page
          </button>
          <span>
            {page} / {pages}
          </span>
          <button
            disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next page
          </button>
        </div>
      )}
    </div>
  );
}
