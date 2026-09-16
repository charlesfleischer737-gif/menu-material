"use client";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Brand from "./brand";
import HomepageSections from "./homepage-sections";

const beforePhoto = "/burger-phone-original.jpg";
const afterPhoto = "/burger-studio-transformation.png";
const heroFoodBubbles = [
  ["sushi", "pizza", "cheesecake"],
  ["burrata", "gelato", "gyoza"],
];

export default function Landing({
  onStart,
  onSignIn,
  signedIn = false,
}: {
  onStart: () => void;
  onSignIn: () => void;
  signedIn?: boolean;
}) {
  return (
    <div className="pw-site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="pw-header">
        <a href="/" aria-label="Plateworthy home">
          <Brand />
        </a>
        <nav aria-label="Main navigation">
          <a href="#use-cases">Use cases</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          {!signedIn && (
            <button className="pw-login" onClick={onSignIn}>
              Log in
            </button>
          )}
          <Button className="pw-header-cta" onClick={onStart}>
            {signedIn ? "My studio" : "Request early access"}
          </Button>
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
              Turn a quick phone photo into studio-quality images, a polished
              menu, and content ready for DoorDash and Instagram. No photoshoot.
              No editing skills.
            </p>
            <Button onClick={onStart}>
              {signedIn ? "Open my studio" : "Request early access"}
              <ArrowRight size={17} />
            </Button>
            <span className="pw-pilot-note">
              Free pilot · No credit card · Limited places
            </span>
          </div>
          <div className="pw-comparison" id="the-difference">
            <figure className="pw-before">
              <div className="pw-photo-label">
                <span>Before</span>
                <span>A quick photo from your phone</span>
              </div>
              <div className="pw-photo-frame">
                <img
                  src={beforePhoto}
                  srcSet="/homepage/optimized/burger-before-640.webp 640w, /burger-phone-original.jpg 2592w"
                  sizes="(max-width: 700px) 90vw, (max-width: 1200px) 46vw, 560px"
                  decoding="async"
                  alt="Original, unstyled burger photograph"
                  width="2592"
                  height="1944"
                  fetchPriority="high"
                />
              </div>
            </figure>
            <figure className="pw-after">
              <div className="pw-photo-label">
                <span>After</span>
                <span>Ready to make mouths water</span>
              </div>
              <div className="pw-photo-frame">
                <img
                  src={afterPhoto}
                  srcSet="/homepage/optimized/burger-after-640.webp 640w, /homepage/optimized/burger-after-960.webp 960w, /homepage/optimized/burger-after-1536.webp 1536w"
                  sizes="(max-width: 700px) 90vw, (max-width: 1200px) 46vw, 560px"
                  decoding="async"
                  alt="The same burger restyled with professional lighting and a clean background"
                  width="1536"
                  height="1024"
                  fetchPriority="high"
                />
              </div>
            </figure>
            <span className="pw-transform-arrow" aria-hidden="true">
              <ArrowRight size={20} />
            </span>
          </div>
        </section>
        <HomepageSections onStart={onStart} signedIn={signedIn} />
        <section
          className="pw-workflow"
          id="how-it-works"
          aria-labelledby="workflow-title"
        >
          <div className="pw-section-heading">
            <h2 id="workflow-title">Easy enough to do between orders.</h2>
            <p>
              Skip the hours of editing. Start with your phone and let AI handle
              the lighting, background, and presentation.
            </p>
          </div>
          <ol className="pw-steps">
            <li>
              <span className="pw-step-number">1</span>
              <div>
                <h3>Start with your dish</h3>
                <p>
                  Choose a photo from your phone and tell us what’s on the
                  plate. Your everyday photo is all you need to begin.
                </p>
              </div>
            </li>
            <li>
              <span className="pw-step-number">2</span>
              <div>
                <h3>Pick your look</h3>
                <p>
                  Choose a look, check the framing, and create one beautiful
                  photo. Review it or ask for a change.
                </p>
              </div>
            </li>
            <li>
              <span className="pw-step-number">3</span>
              <div>
                <h3>Put your food out there</h3>
                <p>
                  Check your dish looks right, then add it to your menu or
                  download the image and caption for your next post.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="pw-pilot-facts" aria-labelledby="pilot-facts-title">
          <div>
            <p className="pw-eyebrow">A small, hands-on pilot</p>
            <h2 id="pilot-facts-title">Know what you’re joining.</h2>
            <p>
              One restaurant workspace for your photos, menus and posts. Free
              while you’re in the pilot, with a limited image allowance and no
              credit card.
            </p>
          </div>
          <div>
            <p>
              <strong>Keep your originals.</strong> AI versions are separate.
              Review every result before approving it.
            </p>
            <p>
              <strong>Publish when you’re ready.</strong> Your drafts are
              private; you choose what appears on your public menu.
            </p>
            <a href="/pilot">
              See what’s included and how the pilot works{" "}
              <ArrowRight size={16} />
            </a>
          </div>
        </section>
        <section className="pw-start">
          <div>
            <h2>Start with one dish. See the difference.</h2>
            <p>
              Join the free Plateworthy pilot and give your food the
              presentation it deserves.
            </p>
          </div>
          <Button onClick={onStart}>
            {signedIn ? "Open my studio" : "Request early access"}
            <ArrowRight size={17} />
          </Button>
        </section>
      </main>
      <footer className="pw-footer">
        <a href="/" aria-label="Plateworthy home">
          <Brand />
        </a>
        <nav className="pw-footer-links" aria-label="Help and information">
          <a href="/pilot">The free pilot</a>
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
