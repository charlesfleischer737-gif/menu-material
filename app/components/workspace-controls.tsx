"use client";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
const query = "(max-width: 760px)";
export default function WorkspaceControls({
  children,
  className,
  active = true,
  returnFocusRef,
  open,
  onOpenChange,
  title,
}: {
  children: ReactNode;
  className: string;
  active?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}) {
  const host = useRef<HTMLElement | null>(null);
  const focusDesktop = useRef(false);
  const resizeOpener = useRef<HTMLElement | null>(null);
  const subscribe = useCallback(
    (callback: () => void) => {
      const media = window.matchMedia(query);
      const change = () => {
        if (active && host.current?.contains(document.activeElement)) {
          if (media.matches) {
            // Keep an actively used editor open when it becomes a sheet.
            resizeOpener.current =
              [
                ...(host.current
                  .closest(".mm-workspace")
                  ?.querySelectorAll<HTMLElement>(".mm-mobile-edit") || []),
              ].find((element) => !host.current?.contains(element)) || null;
            onOpenChange(true);
          } else {
            focusDesktop.current = true;
          }
        }
        // Desktop has a permanent inspector. Discard the sheet's open state
        // so a later resize cannot reopen it over a different workspace.
        if (!media.matches) onOpenChange(false);
        callback();
      };
      media.addEventListener("change", change);
      return () => media.removeEventListener("change", change);
    },
    [active, onOpenChange],
  );
  const mobile = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  useLayoutEffect(() => {
    if (mobile || !focusDesktop.current) return;
    focusDesktop.current = false;
    const frame = requestAnimationFrame(() => {
      const target =
        host.current?.querySelector<HTMLElement>(
          '[role="tab"][aria-selected="true"]',
        ) || host.current;
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [mobile]);
  return mobile ? (
    <Sheet open={active && open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={(element) => {
          host.current = element;
        }}
        side="bottom"
        className={`cx-app mm-controls-sheet ${className}`}
        aria-describedby={undefined}
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current || resizeOpener.current;
          if (!active || !window.matchMedia(query).matches) {
            event.preventDefault();
          } else if (target?.getClientRects().length) {
            event.preventDefault();
            target.focus({ preventScroll: true });
            resizeOpener.current = null;
          }
        }}
      >
        <header className="workspace-controls-header">
          <SheetTitle>{title}</SheetTitle>
          <SheetClose aria-label={`Close ${title.toLowerCase()}`}>
            <X size={20} aria-hidden="true" />
          </SheetClose>
        </header>
        <div className="workspace-controls-body">{children}</div>
      </SheetContent>
    </Sheet>
  ) : (
    <aside
      ref={(element) => {
        host.current = element;
      }}
      className={className}
      aria-label={title}
      tabIndex={-1}
    >
      {children}
    </aside>
  );
}
