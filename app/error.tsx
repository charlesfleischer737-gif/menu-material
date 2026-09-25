"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { isChunkLoadError, reloadForNewVersion } from "@/lib/chunk-reload";
import { SiteFooter, SiteHeader } from "./components/site-chrome";
import { reportClientError } from "./components/error-reporter";
import Kitty from "./components/kitty";

// Replaces a crashed page (for example the workspace) instead of a blank screen.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A screen's file went missing after a deploy. Trying again would repeat
  // the failed load, so this reloads the page (once by itself).
  const stale = isChunkLoadError(error);
  useEffect(() => {
    reportClientError(error, "boundary");
    if (stale) reloadForNewVersion();
  }, [error, stale]);
  return (
    <div className="pw-site">
      <SiteHeader>{null}</SiteHeader>
      <main id="main" className="pw-information">
        <header className="pw-information-header">
          <Kitty pose="sit" className="pw-status-kitty" />
          <h1>
            {stale ? "A new version is available." : "Something went wrong."}
          </h1>
          <p className="pw-information-intro" role="alert">
            {stale
              ? "Menu Material was updated while this page was open. Reload to continue. Your saved work is safe."
              : "This page ran into a problem. Your saved work is safe. Try again, or go back to the home page."}
          </p>
        </header>
        <div className="pw-status-actions">
          <Button
            size="marketing"
            onClick={() => (stale ? location.reload() : reset())}
          >
            {stale ? "Reload" : "Try again"}
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
