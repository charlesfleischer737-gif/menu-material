"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
const query = "(max-width: 760px)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export default function WorkspaceControls({
  children,
  className,
  open,
  onOpenChange,
  title,
}: {
  children: ReactNode;
  className: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}) {
  const mobile = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  return mobile ? (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={`cx-app mm-controls-sheet ${className}`}
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  ) : (
    <aside className={className}>{children}</aside>
  );
}
