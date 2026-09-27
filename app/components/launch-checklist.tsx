"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import type { Row } from "@/lib/client";
import { isTableCard, MENU_EXPORTED } from "@/lib/funnel";
import {
  launchChecklist,
  showLaunchChecklist,
  type LaunchStepId,
} from "@/lib/launch-checklist";
import {
  readPreference,
  rememberPreference,
  workspacePreferenceKey,
} from "@/lib/workspace-navigation";

/**
 * "Get your menu live": where a new owner lands, the three steps to the live
 * QR menu Free includes, each read from saved work and linking to where it's
 * done (lib/launch-checklist.ts).
 */
export default function LaunchChecklist({
  state,
  active,
  onOpen,
}: {
  state: Row;
  /** Photo Studio is on screen: check again for a table card. */
  active: boolean;
  onOpen: (step: LaunchStepId) => void;
}) {
  const key = `${workspacePreferenceKey(state.user.id, state.restaurant.id)}:launch-checklist`;
  // "dismissed" or "done", remembered for the account like other workspace
  // preferences, so a hidden checklist stays hidden.
  const [preference, setPreference] = useState(() => readPreference(key)),
    [openedAt] = useState(() => Date.now()),
    // Whether a table card or the menu's QR code was saved: asked of the
    // server when Photo Studio opens (null until it answers), and heard at
    // once from Share.
    [tableCard, setTableCard] = useState<boolean | null>(null);
  const titleId = useId(),
    root = useRef<HTMLElement>(null);
  const list = launchChecklist({
    dishes: state.dishes,
    published: state.restaurant.published,
    tableCard: !!tableCard,
  });
  const open = showLaunchChecklist({
    preference,
    complete: list.complete,
    createdAt: state.restaurant.created_at,
    now: openedAt,
  });
  const cardSaved = tableCard === true;
  useEffect(() => {
    if (!active || !open || cardSaved) return;
    let live = true;
    // A quiet background check: a lapsed session is left to the page's own
    // requests to report.
    void fetch("/api/launch-checklist", { cache: "no-store" })
      .then((response) =>
        response.ok ? (response.json() as Promise<Row>) : null,
      )
      .then((facts) => {
        if (live) setTableCard(!!facts?.tableCard);
      })
      .catch(() => {
        if (live) setTableCard(false);
      });
    return () => {
      live = false;
    };
  }, [active, open, cardSaved]);
  useEffect(() => {
    const exported = (event: Event) => {
      if (isTableCard((event as CustomEvent).detail?.format))
        setTableCard(true);
    };
    window.addEventListener(MENU_EXPORTED, exported);
    return () => window.removeEventListener(MENU_EXPORTED, exported);
  }, []);
  // Once everything is done it stays done, even if a menu later goes offline.
  useEffect(() => {
    if (list.complete) rememberPreference(key, "done");
  }, [list.complete, key]);
  const next = list.steps.find((step) => !step.done)?.id;
  // With only the table card left, wait for the server's answer, so a
  // finished list doesn't flash up.
  if (!open || (next === "tableCard" && tableCard === null)) return null;
  return (
    <section className="lc" aria-labelledby={titleId} ref={root}>
      <div className="lc-heading">
        <h2 id={titleId}>Get your menu live</h2>
        <p>
          {list.done} of {list.steps.length} done
        </p>
      </div>
      <ol className="lc-steps">
        {list.steps.map((step, index) => (
          <li
            key={step.id}
            data-state={
              step.done ? "done" : step.id === next ? "next" : undefined
            }
          >
            <button
              type="button"
              className="lc-step"
              onClick={() => onOpen(step.id)}
            >
              <span className="lc-mark" aria-hidden="true">
                {step.done ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              <span className="lc-label">
                {step.done && <span className="sr-only">Done: </span>}
                {step.label}
              </span>
              <ChevronRight className="lc-go" size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="lc-dismiss"
        aria-label="Hide this checklist"
        title="Hide"
        onClick={() => {
          // Keyboard focus moves to the page title rather than being lost.
          root.current
            ?.closest("header")
            ?.querySelector<HTMLElement>("h1")
            ?.focus();
          rememberPreference(key, "dismissed");
          setPreference("dismissed");
        }}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  );
}
