"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "./components/site-chrome";
import { reportClientError } from "./components/error-reporter";

// Replaces a crashed page (for example the workspace) instead of a blank screen.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "boundary");
  }, [error]);
  return (
    <div className="pw-site">
      <SiteHeader>{null}</SiteHeader>
      <main id="main" className="pw-information">
        <header className="pw-information-header">
          <h1>Something went wrong.</h1>
          <p className="pw-information-intro" role="alert">
            This page ran into a problem. Your saved work is safe. Try again, or
            go back to the home page.
          </p>
        </header>
        <div className="pw-status-actions">
          <Button size="marketing" onClick={() => reset()}>
            Try again
          </Button>
          <Button size="marketing" variant="outline" asChild>
            {/* A full load clears broken in-page state; client navigation to
                the same path would keep this boundary in its error state. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Go to home</a>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
