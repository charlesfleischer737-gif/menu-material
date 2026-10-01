"use client";
import type { ReactNode } from "react";
import { usePresence } from "./motion";

/**
 * Renders its child while `when` is set and for a moment after it clears,
 * with `open` false and the last value, so a dialog that is only mounted
 * while it is needed can still play its exit. A component rather than a hook
 * so a page can keep conditionally mounted sheets in its JSX. `when` must be
 * a primitive or otherwise stable value (see usePresence).
 */
export function Presence<T>({
  when,
  exitMs,
  children,
}: {
  when: T | "" | null | undefined | false;
  exitMs?: number;
  children: (value: T, open: boolean) => ReactNode;
}) {
  const { value, open } = usePresence(when, exitMs);
  return value ? children(value as T, open) : null;
}
