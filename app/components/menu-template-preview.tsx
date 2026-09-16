"use client";
import { useEffect, useRef, useState } from "react";
import { menuPdf } from "@/lib/creation-export";
import { menuDesignPreset } from "@/lib/menu-design";
import type { Row } from "@/lib/client";

const cache = new Map<string, string>();
let queue = Promise.resolve();

/** The picker shows the same first page the customer will download. */
export default function MenuTemplatePreview({
  menu,
  design,
}: {
  menu: Row;
  design: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Preparing preview…");
  const key = JSON.stringify({
    ...menu,
    ...menuDesignPreset(menu, design),
    printProfile: "home",
    qrUrl: undefined,
  });
  useEffect(() => {
    let active = true;
    const show = async (src: string) => {
      const im = new Image();
      im.src = src;
      await im.decode();
      if (!active || !canvas.current) return;
      canvas.current.width = im.width;
      canvas.current.height = im.height;
      canvas.current.getContext("2d")!.drawImage(im, 0, 0);
      setStatus("");
    };
    const timer = setTimeout(() => {
      setStatus("Preparing preview…");
      queue = queue
        .catch(() => {})
        .then(async () => {
          if (!active) return;
          if (cache.has(key)) {
            await show(cache.get(key)!);
            return;
          }
          const content = JSON.parse(key);
          if (!content.sections.some((s: Row) => s.items.length)) {
            setStatus("Add dishes to preview");
            return;
          }
          const { blob } = await menuPdf(content);
          if (!active) return;
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          const task = pdfjs.getDocument({ data: await blob.arrayBuffer() });
          try {
            const pdf = await task.promise,
              page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.5 });
            const target = document.createElement("canvas");
            target.width = viewport.width;
            target.height = viewport.height;
            await page.render({ canvas: target, viewport }).promise;
            const src = target.toDataURL("image/png");
            cache.set(key, src);
            while (cache.size > 16) cache.delete(cache.keys().next().value!);
            await show(src);
          } finally {
            await task.destroy();
          }
        })
        .catch(() => {
          if (active) setStatus("Check dish names and prices to preview");
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);
  return (
    <span className="mm-menu-template-preview" aria-hidden="true">
      <canvas ref={canvas} hidden={!!status} />
      {status && <span>{status}</span>}
    </span>
  );
}
