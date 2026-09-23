"use client";
import { useRef } from "react";
import { ArrowRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import HomepageSections from "./homepage-sections";
import PhotoComparison from "./photo-comparison";
import { SiteFooter, SiteHeader } from "./site-chrome";

const credits = (
  <>
    Original photos and their AI edits:{" "}
    <a
      href="https://commons.wikimedia.org/wiki/File:Hamburger_(5).jpg"
      target="_blank"
      rel="noreferrer"
    >
      Burger by cyclonebill
    </a>{" "}
    (
    <a
      href="https://creativecommons.org/licenses/by-sa/2.0/"
      target="_blank"
      rel="noreferrer"
    >
      CC BY-SA 2.0
    </a>
    );{" "}
    <a
      href="https://commons.wikimedia.org/wiki/File:Carnegie_Deli_Strawberry_Cheesecake.jpg"
      target="_blank"
      rel="noreferrer"
    >
      cheesecake by Pilauricey
    </a>{" "}
    (
    <a
      href="https://creativecommons.org/licenses/by-sa/3.0/"
      target="_blank"
      rel="noreferrer"
    >
      CC BY-SA 3.0
    </a>
    ).
  </>
);

export default function Landing({
  onStart,
  onSignIn,
  signedIn = false,
}: {
  onStart: () => void;
  onSignIn: () => void;
  signedIn?: boolean;
}) {
  const navigationTarget = useRef<string | null>(null);
  return (
    <div className="pw-site pw-homepage">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader>
        <nav className="pw-nav" aria-label="Main navigation">
          <a href="#use-cases">Use cases</a>
          <a href="/pricing">Pricing</a>
          {!signedIn && (
            <button className="pw-login" onClick={onSignIn}>
              Log in
            </button>
          )}
          <Button className="pw-header-cta" onClick={onStart}>
            {signedIn ? "My studio" : "Try it free"}
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
              Turn a phone photo into studio-quality images for your menu,
              delivery listings, and social posts.
            </p>
          </div>
          <div className="pw-hero-actions">
            <Button size="marketing" onClick={onStart}>
              {signedIn ? "Open my studio" : "Try it free"}
              <ArrowRight size={17} />
            </Button>
            <span className="pw-free-note">5 free images · No credit card</span>
          </div>
          <PhotoComparison />
        </section>
        <HomepageSections />
        <section className="pw-start" aria-labelledby="start-title">
          <h2 id="start-title">Start with one dish. See the difference.</h2>
          <p>
            Choose your look, add your photo, and give your food the
            presentation it deserves. Your first 5 images are free.
          </p>
          <Button size="marketing" onClick={onStart}>
            {signedIn ? "Open my studio" : "Try it free"}
            <ArrowRight size={17} />
          </Button>
        </section>
      </main>
      <SiteFooter credits={credits} />
    </div>
  );
}
