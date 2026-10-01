"use client";

import { useEffect } from "react";

// One highlight that slides to the chosen option, for every segmented
// control (Format, Sign in / Create account, settings, Menus views) and
// underline tab list. This sets where the chosen option sits as CSS
// variables on its track; motion.css draws the highlight from them and hides
// the option's own. Until then, and without JavaScript, the option draws its
// own highlight as before.

const TRACKS = [
  ".cx-segment",
  ".md-segment",
  ".mm-segments",
  ".workspace-segments",
  ".st-segmented",
  ".cx-look-preview-tabs",
  ".rs-tab-list",
  ".md-mobile-nav",
  ".workspace-tab-list",
  ".mm-tool-tabs",
].join(",");
const CHOSEN = [
  '[aria-pressed="true"]',
  '[aria-checked="true"]',
  '[aria-selected="true"]',
  '[aria-current="page"]',
  '[data-state="active"]',
  ".is-selected",
].join(",");

function place(track: HTMLElement) {
  const chosen = [...track.children].find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.matches(CHOSEN),
  );
  // Hidden tracks measure zero; they're placed when they appear.
  if (!chosen || !track.offsetWidth || !chosen.offsetWidth) {
    delete track.dataset.glide;
    return;
  }
  // Offsets come from layout, so a dialog's opening zoom doesn't skew them.
  const style = track.style;
  style.setProperty("--glide-x", `${chosen.offsetLeft}px`);
  style.setProperty("--glide-y", `${chosen.offsetTop}px`);
  style.setProperty("--glide-w", `${chosen.offsetWidth}px`);
  style.setProperty("--glide-h", `${chosen.offsetHeight}px`);
  style.setProperty("--glide-r", getComputedStyle(chosen).borderTopLeftRadius);
  if (track.dataset.glide) return;
  // Appear in place first; slide only on later changes.
  track.dataset.glide = "placed";
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (track.dataset.glide === "placed") track.dataset.glide = "ready";
    }),
  );
}

export default function SegmentGlide() {
  useEffect(() => {
    const pending = new Set<HTMLElement>();
    let frame = 0;
    const resize = new ResizeObserver((entries) => {
      for (const entry of entries) queue(entry.target as HTMLElement);
    });
    const watched = new WeakSet<HTMLElement>();

    function queue(track: HTMLElement) {
      if (!watched.has(track)) {
        watched.add(track);
        resize.observe(track);
      }
      pending.add(track);
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        for (const track of pending) if (track.isConnected) place(track);
        pending.clear();
      });
    }
    function scan(root: HTMLElement) {
      if (root.matches(TRACKS)) queue(root);
      root.querySelectorAll<HTMLElement>(TRACKS).forEach(queue);
    }

    const changes = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target as HTMLElement;
        if (record.type === "attributes") {
          const track = target.parentElement;
          if (track?.matches(TRACKS)) queue(track);
          else if (target.matches?.(TRACKS)) queue(target);
          continue;
        }
        if (target.matches?.(TRACKS)) queue(target);
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) scan(node);
        });
      }
    });
    changes.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "aria-pressed",
        "aria-checked",
        "aria-selected",
        "aria-current",
        "data-state",
        "class",
        "hidden",
      ],
    });
    scan(document.body);
    // Web fonts change label widths once they arrive.
    void document.fonts?.ready.then(() => scan(document.body));
    return () => {
      changes.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
