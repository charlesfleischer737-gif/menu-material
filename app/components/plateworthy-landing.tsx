"use client";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import Brand from "./brand";

const beforePhoto = "/burger-phone-original.jpg";
const afterPhoto = "/burger-studio-edit.png";

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
              Studio-quality food photos.
              <br />
              From your phone.
            </h1>
            <p>
              Turn a quick shot of your dish into a professional image for your
              menu, delivery apps, and Instagram.
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
                <span>With AI studio styling</span>
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
          className="pw-workflow"
          id="how-it-works"
          aria-labelledby="workflow-title"
        >
          <div className="pw-section-heading">
            <h2 id="workflow-title">A better photo in three steps.</h2>
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
                <h3>Choose a look</h3>
                <p>
                  Pick the lighting and setting. Get two images and ask for
                  changes.
                </p>
              </div>
            </li>
            <li>
              <span className="pw-step-number">3</span>
              <div>
                <h3>Review and download</h3>
                <p>
                  Check your dish looks right. Save the image in the size you
                  need.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section
          className="pw-destinations"
          aria-labelledby="destinations-title"
        >
          <div>
            <h2 id="destinations-title">Ready wherever you sell.</h2>
            <p>
              Download JPG or PNG images for your next menu update or social
              post.
            </p>
          </div>
          <ul aria-label="Ways to use your photos">
            <li>Menus</li>
            <li>DoorDash & Uber Eats</li>
            <li>Instagram</li>
            <li>Your website</li>
          </ul>
        </section>
        <section className="pw-faq" aria-labelledby="faq-title">
          <h2 id="faq-title">Good to know.</h2>
          <Accordion type="single" collapsible className="pw-questions">
            <AccordionItem value="phone">
              <AccordionTrigger>
                What kind of photo should I upload?
              </AccordionTrigger>
              <AccordionContent>
                A clear phone photo with the whole dish in view. The lighting
                and background don’t need to be perfect. Add the dish’s
                ingredients and portion details to help guide the edit. You can
                also start from a written description.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="accuracy">
              <AccordionTrigger>
                Will it still look like my food?
              </AccordionTrigger>
              <AccordionContent>
                Your photo and dish details guide the AI. Compare each result
                with your original and check the ingredients, portion, and
                plating before you approve it. If a detail changes, ask for a
                revision. Every version stays in your library.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="formats">
              <AccordionTrigger>
                How do I use the finished photos?
              </AccordionTrigger>
              <AccordionContent>
                Choose a square, portrait, or story crop and download a JPG or
                PNG. Upload it to your menu, delivery listing, website, or
                social account. Check the destination’s photo requirements
                before posting.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="pilot">
              <AccordionTrigger>How does the free pilot work?</AccordionTrigger>
              <AccordionContent>
                Use your invitation to create a workspace with a free image
                allowance. Each request creates two options, and failed images
                restore their allowance. No subscription or payment card is
                needed.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
          . Original and AI-edited image licensed under{" "}
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
