import type { ReactNode } from "react";
import Link from "next/link";
import Brand from "./brand";
import Kitty from "./kitty";

// Shared public-site chrome: a translucent sticky bar and a quiet footer.
export function SiteHeader({ children }: { children: ReactNode }) {
  return (
    <header className="pw-header">
      <div className="pw-header-inner">
        <Link className="pw-brand" href="/" aria-label="Menu Material home">
          <Brand />
        </Link>
        {children}
      </div>
    </header>
  );
}

export function SiteFooter({ credits }: { credits?: ReactNode }) {
  return (
    <footer className="pw-footer">
      <div className="pw-footer-inner">
        <div className="pw-footer-top">
          <Link className="pw-brand" href="/" aria-label="Menu Material home">
            <Brand />
          </Link>
          <nav className="pw-footer-links" aria-label="Help and information">
            <a href="/pricing">Plans & pricing</a>
            <a href="/privacy">Photo privacy</a>
            <a href="/guidelines">Usage guidelines</a>
          </nav>
        </div>
        <div className="pw-footer-bottom">
          {credits && <p className="pw-image-credit">{credits}</p>}
          <p className="pw-footer-signoff">
            © {new Date().getFullYear()} Menu Material
            <Kitty pose="sleep" className="pw-footer-kitty" />
          </p>
        </div>
      </div>
    </footer>
  );
}
