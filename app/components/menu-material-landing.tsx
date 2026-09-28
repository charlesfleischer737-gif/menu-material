"use client";
import { useEffect, useRef, type MouseEvent, type RefObject } from "react";
import { ArrowRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import HomepageSections from "./homepage-sections";
import HomepageShowcase from "./homepage-showcase";
import PhotoComparison from "./photo-comparison";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { FREE_SIGNUP_IMAGES } from "@/lib/plans";
/* eslint-disable @next/next/no-html-link-for-pages --
   Plain links on purpose: next/link's client navigation throws in the vinext
   production build ("navigateClientSide is not a function"), so a <Link>
   click there does nothing. These are separate server-rendered pages anyway. */

// The burger and cheesecake photos are CC BY-SA, so they need credit. The full
// credits are on the usage guidelines page.
const credits = <a href="/guidelines#credits">Photo credits</a>;

// The calls to action are links (/#studio, /?login) that the page itself
// handles, so they work before JavaScript loads. Once it has, a plain click
// runs in place; a click meant for a new tab or window follows the link.
function inPlace(action: () => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    action();
  };
}

// At the top of the page the header is one stone surface with the hero; once
// the page scrolls beneath it, it gets its hairline (marketing.css).
function useScrolledHeader(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const header = root.current?.querySelector<HTMLElement>(".pw-header");
    if (!header) return;
    const update = () => header.toggleAttribute("data-scrolled", scrollY > 0);
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, [root]);
}

export default function Landing({
  onStart,
  onSignIn,
  signedIn = false,
}: {
  onStart: () => void;
  onSignIn: () => void;
  signedIn?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const navigationTarget = useRef<string | null>(null);
  const start = inPlace(onStart),
    signIn = inPlace(onSignIn);
  useScrolledHeader(root);
  return (
    <div className="pw-site pw-homepage" ref={root}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader>
        <nav className="pw-nav" aria-label="Main navigation">
          <a href="#use-cases">Use cases</a>
          <a href="/pricing">Pricing</a>
          {!signedIn && (
            <a className="pw-login" href="/?login" onClick={signIn}>
              Log in
            </a>
          )}
          <Button className="pw-header-cta" asChild>
            <a href="/#studio" onClick={start}>
              {signedIn ? "My studio" : "Try it free"}
            </a>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="pw-mobile-menu-trigger"
                aria-label="Open navigation"
              >
                <Menu size={20} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="pw-mobile-menu"
              align="end"
              sideOffset={10}
              onCloseAutoFocus={(event) => {
                const id = navigationTarget.current;
                if (!id) return;
                event.preventDefault();
                navigationTarget.current = null;
                document.getElementById(id)?.focus({ preventScroll: true });
              }}
            >
              <DropdownMenuItem
                asChild
                onSelect={() => {
                  navigationTarget.current = "use-cases";
                }}
              >
                <a href="#use-cases">Use cases</a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/pricing">Pricing</a>
              </DropdownMenuItem>
              {!signedIn && (
                <DropdownMenuItem onSelect={onSignIn}>Log in</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </SiteHeader>
      <main id="main">
        <section className="pw-hero" aria-labelledby="hero-title">
          <div className="pw-hero-intro">
            <h1 id="hero-title">Make your food look as good as it tastes.</h1>
            <p>
              Turn phone pics into studio-quality images for your restaurant.
            </p>
          </div>
          <div className="pw-hero-actions">
            <Button size="marketing" asChild>
              <a href="/#studio" onClick={start}>
                {signedIn ? "Open my studio" : "Try it free"}
                <ArrowRight size={17} />
              </a>
            </Button>
            <span className="pw-free-note">
              {FREE_SIGNUP_IMAGES} free images · No credit card
            </span>
          </div>
          <PhotoComparison />
        </section>
        <HomepageShowcase />
        <HomepageSections />
        <section className="pw-start" aria-labelledby="start-title">
          <h2 id="start-title">Start with one dish. See the difference.</h2>
          <p>
            Choose your look, add your photo, and give your food the
            presentation it deserves. Your first {FREE_SIGNUP_IMAGES} images are
            free.
          </p>
          <Button size="marketing" asChild>
            <a href="/#studio" onClick={start}>
              {signedIn ? "Open my studio" : "Try it free"}
              <ArrowRight size={17} />
            </a>
          </Button>
        </section>
      </main>
      <SiteFooter credits={credits} />
    </div>
  );
}
