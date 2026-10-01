"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, CircleAlert, LoaderCircle, X } from "lucide-react";
import { usePresence } from "./motion";

// Notices float above the page instead of pushing it down. One live region
// holds every toast, created once so screen readers are already listening
// when the first message arrives. Errors are alerts.

type Tone = "success" | "error" | "busy";

let region: HTMLElement | null = null;
function toastRegion() {
  if (region?.isConnected) return region;
  region = document.createElement("div");
  region.className = "mm-toasts";
  region.setAttribute("aria-live", "polite");
  document.body.appendChild(region);
  return region;
}
// True once hydrated in the browser; the server renders no toasts.
const noSubscription = () => () => {};
const useBrowser = () =>
  useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

const icons: Record<Tone, ReactNode> = {
  success: <Check size={14} strokeWidth={3} />,
  error: <CircleAlert size={18} />,
  busy: <LoaderCircle className="cx-spin" size={17} />,
};

export function Toast({
  open,
  tone = "success",
  children,
  actions,
  onDismiss,
  delay = 0,
  duration = 0,
  dismissible = tone === "error",
}: {
  open: boolean;
  tone?: Tone;
  children: ReactNode;
  /** Buttons that resolve the message, such as Retry. */
  actions?: ReactNode;
  /** Called by the close button, and when the toast times out. */
  onDismiss?: () => void;
  /** Shows a close button (errors have one by default). */
  dismissible?: boolean;
  /** Waits this long before showing, so quick work never flashes. */
  delay?: number;
  /** Hides the toast after this long (ms); 0 keeps it until `open` ends. */
  duration?: number;
}) {
  const browser = useBrowser();
  // The live region exists before the first message, so it's announced.
  useEffect(() => void toastRegion(), []);

  // `late` turns true once `delay` has passed since the toast was asked for.
  const [late, setLate] = useState(false);
  const [asked, setAsked] = useState(open);
  if (asked !== open) {
    setAsked(open);
    setLate(false);
  }
  useEffect(() => {
    if (!open || !delay) return;
    const timer = setTimeout(() => setLate(true), delay);
    return () => clearTimeout(timer);
  }, [open, delay]);
  const visible = open && (!delay || late);

  // A new message restarts the clock; re-renders of the same one don't.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  const message = typeof children === "string" ? children : "";
  useEffect(() => {
    if (!visible || !duration) return;
    const timer = setTimeout(() => dismiss.current?.(), duration);
    return () => clearTimeout(timer);
  }, [visible, duration, message]);

  // What the toast last said, kept on screen while it leaves.
  const [said, setSaid] = useState({ tone, children, actions });
  if (
    visible &&
    (said.tone !== tone ||
      said.children !== children ||
      said.actions !== actions)
  )
    setSaid({ tone, children, actions });
  const presence = usePresence(visible, 200);
  if (!browser || !presence.value) return null;
  const content = visible ? { tone, children, actions } : said;

  return createPortal(
    <div
      className="mm-toast"
      data-tone={content.tone}
      data-state={presence.open ? "open" : "closed"}
      role={content.tone === "error" ? "alert" : undefined}
    >
      <span className="mm-toast-icon" aria-hidden="true">
        {icons[content.tone]}
      </span>
      <div className="mm-toast-message">{content.children}</div>
      {content.actions && (
        <div className="mm-toast-actions">{content.actions}</div>
      )}
      {dismissible && onDismiss && (
        <button
          type="button"
          className="mm-toast-dismiss"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X size={16} />
        </button>
      )}
    </div>,
    toastRegion(),
  );
}
