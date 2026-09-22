"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** A desktop action group that becomes a measured, safe-area-aware phone bar. */
export default function WorkspaceActionBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = element.current;
    const layout = bar?.closest<HTMLElement>("[data-action-layout]");
    if (!bar || !layout) return;
    const viewport = window.visualViewport;
    const measure = () => {
      const phone = window.matchMedia("(max-width: 760px)").matches;
      const height = bar.getBoundingClientRect().height;
      // Enlarged text and the software keyboard must leave room for the task.
      const inFlow = phone && height > (viewport?.height || innerHeight) * 0.28;
      bar.dataset.inFlow = String(inFlow);
      const fixed =
        phone && !inFlow && getComputedStyle(bar).display !== "none";
      layout.style.setProperty(
        "--workspace-action-height",
        `${fixed ? height : 0}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    window.addEventListener("resize", measure);
    viewport?.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      viewport?.removeEventListener("resize", measure);
      layout.style.removeProperty("--workspace-action-height");
    };
  }, []);
  return (
    <div ref={element} className={`workspace-action-bar ${className}`}>
      {children}
    </div>
  );
}
