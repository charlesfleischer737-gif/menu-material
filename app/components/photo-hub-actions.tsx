"use client";
import { useRef, useState, type Ref } from "react";
import {
  BookOpen,
  Download,
  ImageDown,
  Megaphone,
  Package,
  Sparkles,
} from "lucide-react";
import { photoReviewReminder } from "@/lib/photo-use";
import { ProBadge } from "./pro-badge";
import { useIPhone } from "./image-save";

export type PhotoAction = "download" | "pack" | "post" | "menu" | "promote";
/** The same names wherever a finished photo can be used. */
export const photoActionLabels: Record<PhotoAction, string> = {
  download: "Download",
  pack: "Photo pack",
  post: "Make a post",
  menu: "Add to menu",
  promote: "Promote this dish",
};
/** Short names for the photo hub's tiles, so all four fit on one row. */
const tileLabels: Record<Exclude<PhotoAction, "download">, string> = {
  post: "Post",
  menu: "Menu",
  promote: "Promote",
  pack: "Photo pack",
};

export function PhotoHubActions({
  disabled = false,
  note,
  onAction,
  downloadRef,
  proActions = [],
}: {
  disabled?: boolean;
  /** A status line under the actions, when there is something to say. */
  note?: string;
  onAction: (action: PhotoAction) => Promise<void>;
  downloadRef?: Ref<HTMLButtonElement>;
  /** Actions marked Pro, so no one starts work their plan can't finish. */
  proActions?: PhotoAction[];
}) {
  const iphone = useIPhone();
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
  const status = busy ? "Preparing…" : note;
  return (
    // Part of the panel, not pinned: on phones the tab bar stays the only bar.
    <div className="st-action st-hub">
      <button
        ref={downloadRef}
        className="st-create"
        disabled={disabled || busy}
        onClick={() => void start("download")}
      >
        {iphone ? (
          <ImageDown size={18} aria-hidden="true" />
        ) : (
          <Download size={18} aria-hidden="true" />
        )}
        {iphone ? "Save image" : photoActionLabels.download}
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
        ).map(([action, Icon]) => {
          const pro = proActions.includes(action);
          return (
            <button
              key={action}
              className="st-hub-button"
              aria-label={`${photoActionLabels[action]}${pro ? ", Pro" : ""}`}
              disabled={disabled || busy}
              onClick={() => void start(action)}
            >
              <Icon size={20} aria-hidden="true" />
              {tileLabels[action]}
              {pro && <ProBadge />}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="st-hub-error" role="alert">
          {error}
        </p>
      )}
      <p className="st-action-note">{photoReviewReminder}</p>
      <p className={status ? "st-action-note" : "sr-only"} role="status">
        {status}
      </p>
    </div>
  );
}
