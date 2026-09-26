"use client";
import { useRef, useState, type Ref } from "react";
import {
  BookOpen,
  Download,
  Megaphone,
  Package,
  Sparkles,
} from "lucide-react";
import { photoReviewReminder } from "@/lib/photo-use";
import WorkspaceActionBar from "./workspace-action-bar";
import { ProBadge } from "./pro-badge";

export type PhotoAction = "download" | "pack" | "post" | "menu" | "promote";
/** The same names wherever a finished photo can be used. */
export const photoActionLabels: Record<PhotoAction, string> = {
  download: "Download",
  pack: "Photo pack",
  post: "Make a post",
  menu: "Add to menu",
  promote: "Promote this dish",
};

export function PhotoHubActions({
  disabled = false,
  note,
  onAction,
  downloadRef,
  proActions = [],
}: {
  disabled?: boolean;
  note: string;
  onAction: (action: PhotoAction) => Promise<void>;
  downloadRef?: Ref<HTMLButtonElement>;
  /** Actions marked Pro, so no one starts work their plan can't finish. */
  proActions?: PhotoAction[];
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function start(action: PhotoAction) {
    if (disabled || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await onAction(action);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <WorkspaceActionBar className="st-action st-hub">
      <p className="st-action-note">{photoReviewReminder}</p>
      <button
        ref={downloadRef}
        className="st-create"
        disabled={disabled || busy}
        onClick={() => void start("download")}
      >
        <Download size={18} aria-hidden="true" />
        {photoActionLabels.download}
      </button>
      <div
        className="st-hub-row"
        role="group"
        aria-label="More ways to use this photo"
      >
        {(
          [
            ["post", Megaphone],
            ["menu", BookOpen],
            ["promote", Sparkles],
            ["pack", Package],
          ] as const
        ).map(([action, Icon]) => (
          <button
            key={action}
            className="st-hub-button"
            disabled={disabled || busy}
            onClick={() => void start(action)}
          >
            <Icon size={17} aria-hidden="true" />
            {photoActionLabels[action]}
            {proActions.includes(action) && <ProBadge />}
          </button>
        ))}
      </div>
      {error && (
        <p className="st-hub-error" role="alert">
          {error}
        </p>
      )}
      <p className="st-action-note" role="status">
        {busy ? "Preparing…" : note}
      </p>
    </WorkspaceActionBar>
  );
}
