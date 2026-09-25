import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import PublicMenu from "./public-menu";
import { SiteFooter, SiteHeader } from "./site-chrome";
export default function PublicInformation({
  title,
  intro,
  sections = [],
  art,
  children,
}: {
  title: string;
  intro: string;
  sections?: { id: string; label: string }[];
  /** Decorative illustration above the title. */
  art?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pw-site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader>
        <nav className="pw-nav" aria-label="Main navigation">
          <a href="/pricing">Pricing</a>
          {/* The homepage opens sign-in for /?login. */}
          <Link className="pw-login" href="/?login">
            Log in
          </Link>
          <Button className="pw-header-cta" asChild>
            <Link href="/#studio">Try it free</Link>
          </Button>
          <PublicMenu
            links={[
              { href: "/pricing", label: "Pricing" },
              { href: "/?login", label: "Log in" },
            ]}
          />
        </nav>
      </SiteHeader>
      <main id="main" className="pw-information">
        <header className="pw-information-header">
          {art}
          <h1>{title}</h1>
          <p className="pw-information-intro">{intro}</p>
        </header>
        {sections.length > 0 && (
          <nav className="pw-information-nav" aria-label="On this page">
            <ul>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
