import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import PublicMenu from "./public-menu";
import { SiteFooter, SiteHeader } from "./site-chrome";
/* eslint-disable @next/next/no-html-link-for-pages --
   Plain links on purpose: next/link's client navigation throws in the vinext
   production build ("navigateClientSide is not a function"), so a <Link>
   click there does nothing. These are separate server-rendered pages anyway. */
export default function PublicInformation({
  title,
  intro,
  sections = [],
  art,
  breadcrumbs = [],
  note,
  children,
}: {
  title: string;
  intro: ReactNode;
  sections?: { id: string; label: string }[];
  /** Decorative illustration above the title. */
  art?: ReactNode;
  /** The pages above this one, from the homepage down. */
  breadcrumbs?: { href: string; label: string }[];
  /** A quiet line under the intro, such as when a guide was last checked. */
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pw-site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader>
        <nav className="pw-nav" aria-label="Main navigation">
          <a href="/guides">Guides</a>
          <a href="/pricing">Pricing</a>
          {/* The homepage opens sign-in for /?login. */}
          <a className="pw-login" href="/?login">
            Log in
          </a>
          <Button className="pw-header-cta" asChild>
            <a href="/#studio">Try it free</a>
          </Button>
          <PublicMenu
            links={[
              { href: "/guides", label: "Guides" },
              { href: "/pricing", label: "Pricing" },
              { href: "/?login", label: "Log in" },
            ]}
          />
        </nav>
      </SiteHeader>
      <main id="main" className="pw-information">
        <header className="pw-information-header">
          {breadcrumbs.length > 0 && (
            <nav className="pw-breadcrumbs" aria-label="Breadcrumb">
              <ol>
                {breadcrumbs.map((crumb) => (
                  <li key={crumb.href}>
                    <a href={crumb.href}>{crumb.label}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {art}
          <h1>{title}</h1>
          <p className="pw-information-intro">{intro}</p>
          {note && <p className="pw-information-note">{note}</p>}
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
