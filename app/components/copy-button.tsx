"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Check, Copy } from "lucide-react";

/**
 * Copies text, then shows a check that draws itself and "Copied" for two
 * seconds. Both faces share one grid cell, so the button keeps its width,
 * and a live region that is always mounted announces the copy.
 */
export function CopyButton({
  text,
  label = "Copy link",
  copiedLabel = "Copied",
  className = "md-button",
  disabled,
  iconSize = 16,
  onCopied,
  onError,
  copy = (value) => navigator.clipboard.writeText(value),
  ...button
}: Omit<ComponentProps<"button">, "children" | "onClick" | "onError"> & {
  text: string;
  label?: ReactNode;
  copiedLabel?: ReactNode;
  className?: string;
  disabled?: boolean;
  iconSize?: number;
  onCopied?: () => void;
  /** Clipboard refused (permissions, an old browser). */
  onError?: () => void;
  /** Does the copying; throws if it didn't happen. */
  copy?: (text: string) => Promise<void>;
}) {
  // The text that was copied: a different link or caption isn't copied yet.
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copied = copiedText === text;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <>
      <button
        {...button}
        type="button"
        className={`${className} ui-copy`}
        data-copied={copied || undefined}
        disabled={disabled}
        onClick={async () => {
          try {
            await copy(text);
          } catch {
            onError?.();
            return;
          }
          setCopiedText(text);
          onCopied?.();
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopiedText(null), 2000);
        }}
      >
        <span className="ui-copy-face">
          <span>
            <Copy size={iconSize} aria-hidden="true" />
            {label}
          </span>
          <span aria-hidden="true">
            <Check size={iconSize} strokeWidth={2.5} />
            {copiedLabel}
          </span>
        </span>
      </button>
      <span className="sr-only" role="status">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}
