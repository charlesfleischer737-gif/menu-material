"use client";
import { useEffect } from "react";
import { reportClientError } from "./components/error-reporter";

// Last-resort boundary when the root layout itself fails. It replaces the
// layout, so it renders its own document and does not rely on site styles.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "boundary");
  }, [error]);
  const button = {
    minHeight: 48,
    padding: "0 22px",
    borderRadius: 999,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  } as const;
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#fbfbfd",
          color: "#1d1d1f",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <main style={{ maxWidth: 560, padding: "48px 22px" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>Menu Material</p>
          <h1 style={{ fontSize: 36, lineHeight: 1.1, margin: "24px 0 12px" }}>
            Something went wrong.
          </h1>
          <p
            role="alert"
            style={{ fontSize: 19, lineHeight: 1.4, color: "#6e6e73" }}
          >
            The site ran into a problem. Your saved work is safe. Try again, or
            go back to the home page.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 28,
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                ...button,
                border: 0,
                background: "#1d1d1f",
                color: "#fff",
              }}
            >
              Try again
            </button>
            {/* The root layout failed, so do not rely on client routing. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                ...button,
                border: "1px solid #d2d2d7",
                color: "#1d1d1f",
              }}
            >
              Go to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
