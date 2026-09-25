import type { ReactNode } from "react";
import Brand from "./brand";
import Kitty from "./kitty";
/* eslint-disable @next/next/no-html-link-for-pages --
   Plain links on purpose: next/link's client navigation throws in the vinext
   production build ("navigateClientSide is not a function"), so a <Link>
   click there does nothing. These are separate server-rendered pages anyway. */

// Shared public-site chrome: a translucent sticky bar and a quiet footer.
export function SiteHeader({ children }: { children: ReactNode }) {
  return (
    <header className="pw-header">
      <div className="pw-header-inner">
        <a className="pw-brand" href="/" aria-label="Menu Material home">
          <Brand />
        </a>
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
          <a className="pw-brand" href="/" aria-label="Menu Material home">
            <Brand />
          </a>
          <nav className="pw-footer-links" aria-label="Help and information">
            <a href="/pricing">Plans & pricing</a>
            <a href="/privacy">Photo privacy</a>
            <a href="/guidelines">Usage guidelines</a>
          </nav>
        </div>
        <div className="pw-footer-bottom">
          {credits && <p className="pw-image-credit">{credits}</p>}
          <p className="pw-footer-signoff">
            {/* Client components hydrate this footer; around New Year the
                server (UTC) and the visitor's clock can disagree on the year. */}
            <span suppressHydrationWarning>
              © {new Date().getFullYear()} Menu Material
            </span>
            <Kitty pose="sleep" className="pw-footer-kitty" />
          </p>
        </div>
      </div>
    </footer>
  );
}
