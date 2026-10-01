"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { XIcon } from "lucide-react";

// Keep the sign-in surface mounted so Google's iframe can finish preparing
// before it opens. A closed native dialog has no focus trap or page overlay.
export default function AuthDialog({
  open,
  busy,
  onClose,
  titleId,
  descriptionId,
  children,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  titleId: string;
  descriptionId: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const outsidePress = useRef(false);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    const opener = document.activeElement;
    element.showModal();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    const gutter = root.style.scrollbarGutter;
    root.style.scrollbarGutter = "stable";
    root.style.overflow = "hidden";
    return () => {
      element.close();
      root.style.overflow = overflow;
      root.style.scrollbarGutter = gutter;
      const target =
        opener instanceof HTMLElement &&
        opener !== document.body &&
        opener.isConnected &&
        opener.getClientRects().length
          ? opener
          : [
              ...document.querySelectorAll<HTMLElement>(
                ".pw-homepage .pw-login, .pw-homepage .pw-mobile-menu-trigger",
              ),
            ].find((item) => item.getClientRects().length);
      target?.focus({ preventScroll: true });
    };
  }, [open]);
  function outside(event: React.PointerEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return false;
    const rect = event.currentTarget.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  }
  return (
    <dialog
      ref={dialog}
      className="auth-dialog auth-dialog-persistent"
      data-slot="dialog-content"
      data-state={open ? "open" : "closed"}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      inert={!open}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onPointerDown={(event) => {
        outsidePress.current = outside(event);
      }}
      onPointerUp={(event) => {
        if (outsidePress.current && outside(event) && !busy) onClose();
        outsidePress.current = false;
      }}
    >
      {children}
      <button
        type="button"
        className="auth-dialog-close"
        aria-label="Close"
        disabled={busy}
        onClick={onClose}
      >
        <XIcon aria-hidden="true" size={18} />
      </button>
    </dialog>
  );
}
