import type { ReactNode } from "react";
import Link from "next/link";
import Brand from "./brand";
export default function PublicInformation({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="pw-site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="pw-header">
        <Link href="/" aria-label="Plateworthy home">
          <Brand />
        </Link>
        <Link className="pw-info-back" href="/">
          Back to Plateworthy
        </Link>
      </header>
      <main id="main" className="pw-information">
        <p className="pw-eyebrow">Plateworthy · Early access</p>
        <h1>{title}</h1>
        <p className="pw-information-intro">{intro}</p>
        {children}
      </main>
      <footer className="pw-footer">
        <Link href="/">Plateworthy</Link>
        <nav className="pw-footer-links" aria-label="Help and information">
          <a href="/pilot">The free pilot</a>
          <a href="/privacy">Photo privacy</a>
          <a href="/guidelines">Usage guidelines</a>
        </nav>
      </footer>
    </div>
  );
}
