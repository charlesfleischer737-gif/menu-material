"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

// Shared motion helpers. CSS animations already stop under reduced motion
// (the catch-all in workspace.css); these cover what JavaScript starts.

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Keeps the last value on screen for a moment after it empties, so a dialog
 * or toast can stay mounted with `open: false` and play its exit. A new value
 * replaces the old one at once.
 */
export function usePresence<T>(
  value: T | "" | null | undefined | false,
  exitMs = 220,
) {
  const [kept, setKept] = useState(value);
  if (value && value !== kept) setKept(value);
  useEffect(() => {
    if (value) return;
    const timer = setTimeout(
      () => setKept(value),
      prefersReducedMotion() ? 0 : exitMs,
    );
    return () => clearTimeout(timer);
  }, [value, exitMs]);
  return {
    value: (value || kept) as T | "" | null | undefined | false,
    open: !!value,
  };
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    finished: Promise<void>;
  };
};

/** Whether viewTransition() will animate here. */
export function canViewTransition() {
  return (
    typeof document !== "undefined" &&
    !!(document as ViewTransitionDocument).startViewTransition &&
    !prefersReducedMotion()
  );
}

/**
 * Runs a React state change inside a View Transition, so the browser morphs
 * elements that share a `view-transition-name` and crossfades the rest.
 * `kind` lands on <html data-transition> for the length of the transition,
 * for CSS that only applies to that transition. Browsers without View
 * Transitions, and reduced motion, get the change at once. Resolves when the
 * transition has finished (or at once without one).
 */
export function viewTransition(
  update: () => void,
  kind?: string,
): Promise<void> {
  const doc = document as ViewTransitionDocument;
  if (!canViewTransition()) {
    update();
    return Promise.resolve();
  }
  const root = document.documentElement;
  if (kind) root.dataset.transition = kind;
  const transition = doc.startViewTransition!(() => flushSync(update));
  return transition.finished
    .catch(() => {})
    .finally(() => {
      if (kind && root.dataset.transition === kind)
        delete root.dataset.transition;
    });
}
