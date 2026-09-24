"use client";
import { useEffect, useId, useRef, useState, type Ref } from "react";
import { BookOpen, Download, Megaphone, Package } from "lucide-react";
import WorkspaceActionBar from "./workspace-action-bar";

export type PhotoAction = "download" | "pack" | "post" | "menu";
/** The same names wherever a finished photo can be used. */
export const photoActionLabels: Record<PhotoAction, string> = {
  download: "Download",
  pack: "Photo pack",
  post: "Make a post",
  menu: "Add to menu",
};
const confirmLabels: Record<PhotoAction, string> = {
  download: "Approve and download",
  pack: "Approve and make a pack",
  post: "Approve and make a post",
  menu: "Approve and add to menu",
};
export const photoAttestation =
  "The food, portion and branding match what I serve, and the whole dish is visible.";

/**
 * The finished photo's hub: Download first, then posts, menus and a photo
 * pack. An unapproved photo asks for the one-time check inline, on whichever
 * action comes first, then carries on.
 */
export function PhotoHubActions({
  approved,
  disabled = false,
  note,
  onApprove,
  onAction,
  downloadRef,
}: {
  approved: boolean;
  disabled?: boolean;
  note: string;
  onApprove: () => Promise<void>;
  onAction: (action: PhotoAction) => void;
  downloadRef?: Ref<HTMLButtonElement>;
}) {
  const [pending, setPending] = useState<PhotoAction | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const check = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const asking = !!pending && !approved;
  useEffect(() => {
    if (asking) check.current?.focus();
  }, [asking]);
  function start(action: PhotoAction) {
    if (approved) return onAction(action);
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPending(action);
    setConfirmed(false);
    setError("");
  }
  function cancel() {
    setPending(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  async function confirm() {
    if (!pending || !confirmed || busy) return;
    setBusy(true);
    setError("");
    try {
      await onApprove();
      const action = pending;
      setPending(null);
      onAction(action);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <WorkspaceActionBar className="st-action st-hub">
      {asking ? (
        <div className="st-attest" role="group" aria-labelledby={titleId}>
          <p className="st-attest-title" id={titleId}>
            Approve this photo once
          </p>
          <label className="st-attest-check">
            <input
              ref={check}
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>{photoAttestation}</span>
          </label>
          {error && (
            <p className="st-attest-error" role="alert">
              {error}
            </p>
          )}
          <div className="st-attest-actions">
            <button
              className="st-pill st-pill-quiet"
              disabled={busy}
              onClick={cancel}
            >
              Not yet
            </button>
            <button
              className="st-pill st-pill-primary"
              disabled={!confirmed || busy}
              onClick={() => void confirm()}
            >
              {busy ? "Approving…" : confirmLabels[pending]}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            ref={downloadRef}
            className="st-create"
            disabled={disabled}
            onClick={() => start("download")}
          >
            <Download size={18} aria-hidden="true" />
            {photoActionLabels.download}
          </button>
          <div
            className="st-hub-row"
            role="group"
            aria-label="More ways to use this photo"
          >
            <button
              className="st-hub-button"
              disabled={disabled}
              onClick={() => start("post")}
            >
              <Megaphone size={17} aria-hidden="true" />
              {photoActionLabels.post}
            </button>
            <button
              className="st-hub-button"
              disabled={disabled}
              onClick={() => start("menu")}
            >
              <BookOpen size={17} aria-hidden="true" />
              {photoActionLabels.menu}
            </button>
            <button
              className="st-hub-button"
              disabled={disabled}
              onClick={() => start("pack")}
            >
              <Package size={17} aria-hidden="true" />
              {photoActionLabels.pack}
            </button>
          </div>
          <p className="st-action-note">{note}</p>
        </>
      )}
    </WorkspaceActionBar>
  );
}
