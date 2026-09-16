"use client";
import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Brand from "./brand";
import HomepageSections from "./homepage-sections";
import HomepageStyleGallery from "./homepage-style-gallery";

const beforePhoto = "/burger-phone-original.jpg";
const afterPhoto = "/burger-studio-transformation.png";
const heroFoodBubbles = [
  ["sushi", "pizza", "cheesecake"],
  ["burrata", "gelato", "gyoza"],
];

function ComparisonPhoto({ after = false }: { after?: boolean }) {
  return (
    <figure className={after ? "pw-after" : "pw-before"}>
      <figcaption className="pw-photo-label">
        <span>{after ? "After" : "Before"}</span>
        <span>
          {after ? "Styled with AI" : "A quick photo from your phone"}
        </span>
      </figcaption>
      <div className="pw-photo-frame">
        <img
          src={after ? afterPhoto : beforePhoto}
          srcSet={
            after
              ? "/homepage/optimized/burger-after-640.webp 640w, /homepage/optimized/burger-after-960.webp 960w, /homepage/optimized/burger-after-1536.webp 1536w"
              : "/homepage/optimized/burger-before-640.webp 640w, /burger-phone-original.jpg 2592w"
          }
          sizes="(max-width: 600px) 90vw, (max-width: 1200px) 46vw, 560px"
          decoding="async"
          alt={
            after
              ? "Illustrative AI edit of the burger with studio lighting and a clean background"
              : "Original, unstyled burger photograph"
          }
          width={after ? 1536 : 2592}
          height={after ? 1024 : 1944}
          fetchPriority="high"
        />
      </div>
    </figure>
  );
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
  const navigationTarget = useRef<string | null>(null);
  return (
    <div className="pw-site pw-homepage">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="pw-header">
        <Link href="/" aria-label="Plateworthy home">
          <Brand />
        </Link>
        <nav aria-label="Main navigation">
          <a href="#use-cases">Use cases</a>
          <a href="#features">Features</a>
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
                <Menu size={22} aria-hidden="true" />
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
                  navigationTarget.current = "how-it-works";
                }}
              >
                <a href="#how-it-works">How it works</a>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                onSelect={() => {
                  navigationTarget.current = "use-cases";
                }}
              >
                <a href="#use-cases">Use cases</a>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                onSelect={() => {
                  navigationTarget.current = "features";
                }}
              >
                <a href="#features">Features</a>
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
      </header>
      <main id="main">
        <section className="pw-hero" aria-labelledby="hero-title">
          <div className="pw-hero-intro">
            <div className="pw-hero-bubbles" aria-hidden="true">
              {heroFoodBubbles.map((foods, side) => (
                <div
                  className={`pw-bubble-cluster ${side === 0 ? "is-left" : "is-right"}`}
                  key={side}
                >
                  {foods.map((food) => (
                    <span className="pw-food-bubble" key={food}>
                      <img
                        src={`/homepage/hero-${food}.webp`}
                        alt=""
                        width="512"
                        height="512"
                        decoding="async"
                        fetchPriority="low"
                      />
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <h1 id="hero-title">
              Make your food look
              <br />
              as good as it tastes.
            </h1>
            <p>
              Turn a quick phone photo into studio-quality images and matching
              posts. Ready to upload to Toast, delivery apps, your website, and
              Instagram. Keep using the tools you know.
            </p>
            <Button onClick={onStart}>
              {signedIn ? "Open my studio" : "Try it free"}
              <ArrowRight size={17} />
            </Button>
            <span className="pw-free-note">5 free images · No credit card</span>
          </div>
          <div
            className="pw-comparison pw-desktop-comparison"
            id="the-difference"
          >
            <ComparisonPhoto />
            <ComparisonPhoto after />
            <span className="pw-transform-arrow" aria-hidden="true">
              <ArrowRight size={20} />
            </span>
          </div>
          <Tabs defaultValue="after" className="pw-mobile-comparison">
            <TabsList aria-label="Compare the original and AI edit">
              <TabsTrigger value="before">Before</TabsTrigger>
              <TabsTrigger value="after">After</TabsTrigger>
            </TabsList>
            <TabsContent value="before">
              <ComparisonPhoto />
            </TabsContent>
            <TabsContent value="after">
              <ComparisonPhoto after />
            </TabsContent>
          </Tabs>
          <div className="pw-comparison-notes">
            <p>Illustrative AI edit. Review every result before sharing.</p>
            <p>
              Keep your originals <span aria-hidden="true">·</span> Download for
              the channels you use
            </p>
          </div>
        </section>
        <section
          className="pw-workflow"
          id="how-it-works"
          aria-labelledby="workflow-title"
          tabIndex={-1}
        >
          <div className="pw-section-heading">
            <h2 id="workflow-title">Easy enough to do between orders.</h2>
          </div>
          <ol className="pw-steps">
            <li>
              <span className="pw-step-number">1</span>
              <div>
                <h3>Start with your dish</h3>
                <p>Add a real photo and choose your look.</p>
              </div>
            </li>
            <li>
              <span className="pw-step-number">2</span>
              <div>
                <h3>Create and review</h3>
                <p>Check that every detail still looks like your food.</p>
              </div>
            </li>
            <li>
              <span className="pw-step-number">3</span>
              <div>
                <h3>Use it where you sell</h3>
                <p>
                  Download for your menu, delivery apps, or social channels.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <HomepageStyleGallery />
        <HomepageSections onStart={onStart} signedIn={signedIn} />
        <section className="pw-start">
          <div>
            <h2>Start with one dish. See the difference.</h2>
            <p>
              Choose your look, add your photo, and give your food the
              presentation it deserves. Your first 5 images are free.
            </p>
          </div>
          <Button onClick={onStart}>
            {signedIn ? "Open my studio" : "Try it free"}
            <ArrowRight size={17} />
          </Button>
        </section>
      </main>
      <footer className="pw-footer">
        <Link href="/" aria-label="Plateworthy home">
          <Brand />
        </Link>
        <nav className="pw-footer-links" aria-label="Help and information">
          <a href="/pricing">Plans & pricing</a>
          <a href="/privacy">Photo privacy</a>
          <a href="/guidelines">Usage guidelines</a>
        </nav>
        <p>© {new Date().getFullYear()} Plateworthy</p>
        <p className="pw-image-credit">
          <a
            href="https://commons.wikimedia.org/wiki/File:Hamburger_(5).jpg"
            target="_blank"
            rel="noreferrer"
          >
            Photo by cyclonebill
          </a>
          . Original burger and its AI-edited images licensed under{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/2.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY-SA 2.0
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
