import type { ReactNode } from "react";
import Link from "next/link";
import Brand from "./brand";
export default function PublicInformation({
  title,
  intro,
  sections = [],
  children,
}: {
  title: string;
  intro: string;
  sections?: { id: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className="pw-site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="pw-header">
        <Link href="/" aria-label="Menu Material home">
          <Brand />
        </Link>
        <Link className="pw-info-back" href="/">
          Back to Menu Material
        </Link>
      </header>
      <main id="main" className="pw-information">
        <p className="pw-eyebrow">Menu Material</p>
        <h1>{title}</h1>
        <p className="pw-information-intro">{intro}</p>
        {sections.length > 0 && (
          <nav className="pw-information-nav" aria-label="On this page">
            <p>On this page</p>
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
      <footer className="pw-footer">
        <Link href="/" aria-label="Menu Material home">
          <Brand />
        </Link>
        <nav className="pw-footer-links" aria-label="Help and information">
          <a href="/pricing">Plans & pricing</a>
          <a href="/privacy">Photo privacy</a>
          <a href="/guidelines">Usage guidelines</a>
        </nav>
      </footer>
    </div>
  );
}
