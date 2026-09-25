import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import Kitty from "./components/kitty";
import PublicInformation from "./components/public-information";
/* eslint-disable @next/next/no-html-link-for-pages --
   Plain links on purpose: next/link's client navigation throws in the vinext
   production build ("navigateClientSide is not a function"), so a <Link>
   click there does nothing. These are separate server-rendered pages anyway. */

// Rendered for unknown URLs and for notFound() from any page, with HTTP 404.
export const metadata: Metadata = {
  title: "Page not found · Menu Material",
  description: "This page could not be found.",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <PublicInformation
      title="We couldn’t find that page."
      intro="The link may be mistyped or out of date, or the page may have moved."
      art={<Kitty pose="box" className="pw-status-kitty" />}
    >
      <div className="pw-status-actions">
        <Button size="marketing" asChild>
          <a href="/">Go to home</a>
        </Button>
        <Button size="marketing" variant="outline" asChild>
          <a href="/pricing">See pricing</a>
        </Button>
      </div>
    </PublicInformation>
  );
}
