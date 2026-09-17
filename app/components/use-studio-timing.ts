"use client";
import { useEffect } from "react";
import { StudioTimer, type StudioPhase } from "@/lib/studio-timing";
import { track } from "./creation-shared";

export function useStudioTiming(
  draftId: string,
  sourceId: string,
  phase: StudioPhase | null,
) {
  useEffect(() => {
    if (!draftId || !phase) return;
    const foreground = () =>
      document.visibilityState === "visible" && document.hasFocus();
    const timer = new StudioTimer(phase, performance.now(), foreground());
    const device = window.matchMedia("(pointer: coarse)").matches
      ? window.innerWidth < 768
        ? "phone"
        : "tablet"
      : "desktop";
    const send = () => {
      let remaining = timer.drain(performance.now());
      while (remaining > 0) {
        const milliseconds = Math.min(60000, remaining);
        track("studio_timing", undefined, {
          draftId,
          ...(sourceId ? { sourceId } : {}),
          phase,
          milliseconds,
          device,
          guest: false,
        });
        remaining -= milliseconds;
      }
    };
    const activity = () => timer.interact(performance.now());
    const visibility = () => {
      timer.observe(performance.now(), foreground());
      send();
    };
    const leaving = () => {
      timer.observe(performance.now(), false);
      send();
    };
    for (const name of ["pointerdown", "keydown", "scroll", "pointermove"])
      window.addEventListener(name, activity, { passive: true, capture: true });
    window.addEventListener("focus", visibility);
    window.addEventListener("blur", visibility);
    window.addEventListener("pagehide", leaving);
    document.addEventListener("visibilitychange", visibility);
    const interval = window.setInterval(send, 15000);
    return () => {
      send();
      window.clearInterval(interval);
      for (const name of ["pointerdown", "keydown", "scroll", "pointermove"])
        window.removeEventListener(name, activity, { capture: true });
      window.removeEventListener("focus", visibility);
      window.removeEventListener("blur", visibility);
      window.removeEventListener("pagehide", leaving);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [draftId, sourceId, phase]);
}
