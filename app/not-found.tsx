import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import PublicInformation from "./components/public-information";

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
    >
      <div className="pw-status-actions">
        <Button size="marketing" asChild>
          <Link href="/">Go to home</Link>
        </Button>
        <Button size="marketing" variant="outline" asChild>
          <Link href="/pricing">See pricing</Link>
        </Button>
      </div>
    </PublicInformation>
  );
}
