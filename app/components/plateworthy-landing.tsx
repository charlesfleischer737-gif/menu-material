"use client";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Brand from "./brand";

const beforePhoto = "/burger-phone-original.jpg";
const afterPhoto = "/burger-studio-transformation.png";

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
          <a href="#how-it-works">How it works</a>
          <button onClick={onSignIn}>
            {signedIn ? "My studio" : "Log in"}
          </button>
        </nav>
      </header>
      <main id="main">
        <section className="pw-hero" aria-labelledby="hero-title">
          <div className="pw-hero-intro">
            <h1 id="hero-title">
              From phone photos
              <br />
              to menus, listings, and posts.
            </h1>
            <p>
              Studio-styled food, polished menu pages, and images formatted for
              DoorDash and Instagram. Start with the photo you already have.
            </p>
            <Button onClick={onStart}>
              {signedIn ? "Open my studio" : "Try your first photo"}
              <ArrowRight size={17} />
            </Button>
            <span className="pw-pilot-note">
              Free during our invitation-only pilot
            </span>
          </div>
          <div className="pw-comparison" id="the-difference">
            <figure className="pw-before">
              <div className="pw-photo-label">
                <span>Before</span>
                <span>An everyday photo</span>
              </div>
              <div className="pw-photo-frame">
                <img
                  src={beforePhoto}
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
                <span>Styled for your menu</span>
              </div>
              <div className="pw-photo-frame">
                <img
                  src={afterPhoto}
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
          <p className="pw-example-note">
            Example AI edit; results vary. Check that the finished image
            accurately represents your dish.
          </p>
        </section>
        <section
          className="pw-showcase"
          id="examples"
          aria-labelledby="examples-title"
        >
          <div className="pw-section-heading">
            <h2 id="examples-title">See what your photos can become.</h2>
            <p>
              One place to create the images, menu pages, and social content
              your restaurant needs.
            </p>
          </div>
          <div className="pw-example-grid">
            <article>
              <figure
                className="pw-example-stage pw-menu-example"
                aria-label="Illustrative restaurant menu page"
              >
                <div className="pw-menu-preview">
                  <div className="pw-menu-masthead">
                    <span>Your restaurant</span>
                    <strong>Lunch menu</strong>
                  </div>
                  <img
                    src="/rigatoni-menu-example.png"
                    alt="Studio-styled tomato rigatoni presented in a restaurant menu"
                    width="1254"
                    height="1254"
                    loading="lazy"
                  />
                  <div className="pw-menu-dish">
                    <div>
                      <h4>Rigatoni al pomodoro</h4>
                      <span>$18</span>
                    </div>
                    <p>Slow-cooked tomato, fresh basil, Parmesan.</p>
                  </div>
                  <div className="pw-menu-secondary">
                    <span>Classic burger</span>
                    <span>$16</span>
                  </div>
                </div>
              </figure>
              <div className="pw-example-copy">
                <h3>A polished restaurant menu</h3>
                <p>
                  Bring photos, descriptions, and prices together on a menu page
                  you can share with a link or QR code.
                </p>
              </div>
            </article>
            <article>
              <figure
                className="pw-example-stage pw-delivery-example"
                aria-label="Illustrative food delivery listing"
              >
                <div className="pw-listing-preview">
                  <img
                    src={afterPhoto}
                    alt="Professionally presented burger with a clean studio background for a delivery listing"
                    width="1536"
                    height="1024"
                    loading="lazy"
                  />
                  <div className="pw-listing-copy">
                    <span className="pw-listing-category">Burgers</span>
                    <div>
                      <h4>Classic burger</h4>
                      <span>$16</span>
                    </div>
                    <p>
                      Beef patty, cheese, tomato, lettuce and mayo on a sesame
                      bun.
                    </p>
                  </div>
                </div>
              </figure>
              <div className="pw-example-copy">
                <h3>Standout delivery listings</h3>
                <p>
                  Clean backgrounds, appetizing styling, and clear crops. Get
                  images ready to upload to DoorDash and Uber Eats.
                </p>
              </div>
            </article>
            <article>
              <figure
                className="pw-example-stage pw-social-example"
                aria-label="Illustrative Instagram post"
              >
                <div className="pw-social-preview">
                  <div className="pw-social-handle">
                    <span>your.restaurant</span>
                    <span aria-hidden="true">•••</span>
                  </div>
                  <img
                    src="/tacos-social-example.png"
                    alt="Beautifully styled fish tacos photographed for an Instagram post"
                    width="1122"
                    height="1402"
                    loading="lazy"
                  />
                  <p>
                    <strong>your.restaurant</strong> Crispy fish. Fresh slaw.
                    Lunch is looking good.
                  </p>
                </div>
              </figure>
              <div className="pw-example-copy">
                <h3>A consistent Instagram feed</h3>
                <p>
                  Create a consistent style for your food, with post and story
                  crops plus editable captions ready to share.
                </p>
              </div>
            </article>
          </div>
          <p className="pw-showcase-note">
            Illustrative layouts and AI styling examples. You review the images
            and publish to your own delivery and social accounts.
          </p>
        </section>
        <section
          className="pw-workflow"
          id="how-it-works"
          aria-labelledby="workflow-title"
        >
          <div className="pw-section-heading">
            <h2 id="workflow-title">From photo to finished content.</h2>
            <p>No camera equipment. No editing experience.</p>
          </div>
          <ol className="pw-steps">
            <li>
              <span className="pw-step-number">1</span>
              <div>
                <h3>Upload your photo</h3>
                <p>
                  A clear phone photo of your actual dish is the best place to
                  start.
                </p>
              </div>
            </li>
            <li>
              <span className="pw-step-number">2</span>
              <div>
                <h3>Style your dish</h3>
                <p>
                  Choose the lighting, background, and presentation. Review two
                  options and ask for changes.
                </p>
              </div>
            </li>
            <li>
              <span className="pw-step-number">3</span>
              <div>
                <h3>Put it to work</h3>
                <p>
                  Add it to your menu page or download the right crop and
                  caption for your next listing or post.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="pw-start">
          <h2>Start with one dish.</h2>
          <Button onClick={onStart}>
            {signedIn ? "Open my studio" : "Try your first photo"}
            <ArrowRight size={17} />
          </Button>
        </section>
      </main>
      <footer className="pw-footer">
        <a href="/" aria-label="Plateworthy home">
          <Brand />
        </a>
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
