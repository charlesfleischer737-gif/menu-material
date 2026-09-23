"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DesignedMenu } from "@/lib/menu-document";
import type { MenuPdfResult } from "@/lib/menu-pdf-v2";
import { prepareMenuProof } from "@/lib/menu-proof-client";
function ProofPage({
  result,
  page,
  onSelect,
  selected,
  entryNames,
  thumbnail = false,
}: {
  result: MenuPdfResult;
  page: number;
  onSelect?: (id: string) => void;
  selected?: string;
  entryNames?: Record<string, string>;
  thumbnail?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      destroy: (() => void) | undefined;
    void (async () => {
      // The legacy build bundles polyfills (e.g. Map#getOrInsertComputed) that
      // current Safari and Chromium releases do not ship yet.
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (!active) return;
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.legacy.min.mjs";
      const data = await result.blob.arrayBuffer();
      if (!active) return;
      const task = pdfjs.getDocument({ data });
      destroy = () => {
        void task.destroy();
      };
      try {
        const document = await task.promise,
          sheet = await document.getPage(page),
          viewport = sheet.getViewport({ scale: thumbnail ? 0.85 : 1.5 });
        const temporary = window.document.createElement("canvas");
        temporary.width = viewport.width;
        temporary.height = viewport.height;
        await sheet.render({ canvas: temporary, viewport }).promise;
        if (active && canvas.current) {
          canvas.current.width = temporary.width;
          canvas.current.height = temporary.height;
          canvas.current.getContext("2d")!.drawImage(temporary, 0, 0);
          setError("");
        }
      } finally {
        destroy();
      }
    })().catch((e) => {
      console.error("Menu preview could not be drawn", e);
      if (active)
        setError(
          "This preview couldn’t be shown. Your menu is saved, and Export PDF still works.",
        );
    });
    return () => {
      active = false;
      destroy?.();
    };
  }, [result, page, thumbnail]);
  return (
    <div className="md-proof-page">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Print menu, page ${page} of ${result.pages}`}
      />
      {error && (
        <p className="md-proof-page-error" role="alert">
          {error}
        </p>
      )}
      {onSelect &&
        result.layout.pages[page - 1]?.hits.map((hit, i) => (
          <button
            key={`${hit.entryId}-${i}`}
            className={`md-proof-hit ${selected === hit.entryId ? "is-selected" : ""}`}
            aria-label={`Edit ${entryNames?.[hit.entryId] || "untitled dish"}`}
            aria-pressed={selected === hit.entryId}
            onClick={() => onSelect(hit.entryId)}
            style={{
              left: `${(hit.x / result.layout.width) * 100}%`,
              top: `${(hit.y / result.layout.height) * 100}%`,
              width: `${(hit.width / result.layout.width) * 100}%`,
              height: `${(hit.height / result.layout.height) * 100}%`,
            }}
          />
        ))}
    </div>
  );
}
export default function MenuProof({
  menu,
  onSelect,
  selected,
  onResult,
  compact = false,
  production = false,
}: {
  menu: DesignedMenu;
  onSelect?: (id: string) => void;
  selected?: string;
  onResult?: (result: MenuPdfResult | null) => void;
  compact?: boolean;
  production?: boolean;
}) {
  const [result, setResult] = useState<MenuPdfResult | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(100),
    [fit, setFit] = useState<"width" | "page" | "custom">("width"),
    [space, setSpace] = useState({ width: 0, height: 0 });
  const scroller = useRef<HTMLDivElement>(null);
  const key = JSON.stringify({
      ...menu,
      printProfile: production ? menu.printProfile : "home",
    }),
    resultCallback = useRef(onResult);
  useEffect(() => {
    resultCallback.current = onResult;
  }, [onResult]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setBusy(true);
        setError("");
        resultCallback.current?.(null);
        prepareMenuProof(JSON.parse(key), {
          signal: controller.signal,
          priority: compact ? 0 : 1,
        })
          .then((value) => {
            if (!active) return;
            setResult(value);
            setPage((p) => Math.min(p, value.pages));
            resultCallback.current?.(value);
          })
          .catch((e) => {
            if (active) {
              setError(e.message);
              setResult(null);
            }
          })
          .finally(() => {
            if (active) setBusy(false);
          });
      },
      compact ? 140 : 180,
    );
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, compact]);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || compact) return;
    const measure = () => {
      const layout = element.closest<HTMLElement>("[data-action-layout]");
      const footer = layout
        ? parseFloat(
            getComputedStyle(layout).getPropertyValue(
              "--workspace-action-height",
            ),
          ) || 0
        : 0;
      const style = getComputedStyle(element);
      const width =
        element.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const height = Math.max(
        300,
        window.innerHeight - element.getBoundingClientRect().top - footer - 24,
      );
      setSpace((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [compact, result?.layout.width, result?.layout.height]);
  const pageWidth =
    result && space.width
      ? Math.min(
          space.width,
          ((space.height - 24) * result.layout.width) / result.layout.height,
        )
      : space.width;
  const effectiveZoom =
    fit === "page" && space.width
      ? (pageWidth / space.width) * 100
      : fit === "width"
        ? 100
        : zoom;
  function changeZoom(amount: number) {
    setZoom(
      Math.max(25, Math.min(200, Math.round(effectiveZoom / 10) * 10 + amount)),
    );
    setFit("custom");
  }
  if (compact)
    return (
      <div className="md-proof-mini" aria-busy={busy}>
        {result ? (
          <>
            <ProofPage result={result} page={1} thumbnail />
            <span className="md-proof-page-count">
              {result.pages} {result.pages === 1 ? "page" : "pages"}
            </span>
          </>
        ) : (
          <div className="md-proof-placeholder">
            {error || "Composing your menu…"}
          </div>
        )}
      </div>
    );
  return (
    <div className="md-proof" aria-busy={busy}>
      <div className="md-proof-toolbar">
        <div>
          <button
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>{result ? `${page} / ${result.pages}` : "…"}</span>
          <button
            aria-label="Next page"
            disabled={!result || page >= result.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="md-proof-updating sr-only" role="status">
          {busy
            ? "Updating…"
            : menu.paper === "a4"
              ? "A4 · 210 × 297 mm"
              : "Letter · 8.5 × 11 in"}
        </span>
        <div>
          <button
            aria-label="Zoom out"
            disabled={effectiveZoom <= 25}
            onClick={() => changeZoom(-20)}
          >
            <Minus size={14} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="md-fit-control" aria-label="Preview size">
                {fit === "page"
                  ? "Fit page"
                  : fit === "width"
                    ? "Fit width"
                    : `${zoom}%`}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="workspace-action-menu" align="end">
              <DropdownMenuRadioGroup
                value={fit}
                onValueChange={(value) => setFit(value as "width" | "page")}
              >
                <DropdownMenuRadioItem value="page">
                  Fit page
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="width">
                  Fit width
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            aria-label="Zoom in"
            disabled={effectiveZoom >= 200}
            onClick={() => changeZoom(20)}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="md-notice">
          {error}
        </div>
      )}
      {result && (
        <div className="md-proof-body">
          {result.pages > 1 && (
            <div className="md-page-thumbnails" aria-label="Menu pages">
              {result.layout.pages.map((_, index) => (
                <button
                  key={index}
                  aria-label={`Show page ${index + 1}`}
                  aria-pressed={page === index + 1}
                  onClick={() => setPage(index + 1)}
                >
                  <ProofPage result={result} page={index + 1} thumbnail />
                  <span>{index + 1}</span>
                </button>
              ))}
            </div>
          )}
          <div
            ref={scroller}
            className="md-proof-scroll"
            style={{ maxHeight: space.height || undefined }}
          >
            <div
              className="md-proof-sheet"
              style={{
                width:
                  fit === "page" && pageWidth
                    ? `${pageWidth}px`
                    : `${effectiveZoom}%`,
                minWidth: effectiveZoom > 100 ? `${effectiveZoom}%` : undefined,
              }}
            >
              <ProofPage
                entryNames={Object.fromEntries(
                  menu.sections.flatMap((section) =>
                    section.items.map((item) => [item.id, item.name]),
                  ),
                )}
                result={result}
                page={page}
                onSelect={
                  busy || result.signature !== key ? undefined : onSelect
                }
                selected={selected}
              />
            </div>
          </div>
        </div>
      )}
      {!result && !error && (
        <div className="md-proof-placeholder">Composing your menu…</div>
      )}
    </div>
  );
}
