"use client";
import { useEffect } from "react";

// Browser errors go to /api/client-errors: at most five distinct reports per
// page load, and never page contents, form values or storage.
const MAX_REPORTS = 5;
const MAX_BYTES = 7 * 1024;
const seen = new Set<string>();
let sent = 0;

function describe(error: unknown) {
  if (error instanceof Error)
    return { name: error.name, message: error.message, stack: error.stack };
  if (error && typeof error === "object" && "message" in error)
    return { name: "", message: String(error.message), stack: undefined };
  return { name: "", message: String(error ?? "Unknown error") };
}
function ignored(name: string, message: string) {
  return (
    name === "AbortError" ||
    /^Script error\.?$/.test(message) ||
    /ResizeObserver loop/.test(message)
  );
}

export function reportClientError(
  error: unknown,
  kind: "error" | "unhandledrejection" | "boundary" = "boundary",
  where: { source?: string; line?: number; column?: number } = {},
) {
  try {
    if (typeof window === "undefined" || sent >= MAX_REPORTS) return;
    const { name, message, stack } = describe(error);
    const text = (message || "Unknown error").trim().slice(0, 1000);
    if (ignored(name, text)) return;
    const key = `${text}|${stack?.split("\n")[1] || where.source || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent++;
    const report: Record<string, unknown> = {
      message: text,
      stack: stack?.slice(0, 4000),
      source: where.source?.slice(0, 500),
      line: where.line || undefined,
      column: where.column || undefined,
      url: location.pathname,
      kind,
      digest:
        error && typeof error === "object" && "digest" in error
          ? String(error.digest).slice(0, 100)
          : undefined,
    };
    let body = JSON.stringify(report);
    while (new Blob([body]).size > MAX_BYTES && report.stack) {
      report.stack = String(report.stack).slice(
        0,
        Math.floor(String(report.stack).length / 2),
      );
      body = JSON.stringify(report);
    }
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    // Reporting must never cause another error.
  }
}

export default function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) =>
      reportClientError(event.error ?? event.message, "error", {
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    const onRejection = (event: PromiseRejectionEvent) =>
      reportClientError(event.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
