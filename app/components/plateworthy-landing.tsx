"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Upload,
  SlidersHorizontal,
  Download,
  MoveHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import Brand from "./brand";

// Enabled only after the illustration has been inspected.
const hasStudioExample = true;
const studioPhoto = hasStudioExample
  ? "/plateworthy-burger.png"
  : "/burger.jpg";
const formats = {
  menu: {
    label: "Menus & delivery",
    title: "Make the menu scroll stop.",
    text: "Give hungry customers a clear, appetizing look at what they’re ordering. Use your photos on menus, DoorDash, Uber Eats, and your website.",
    format: "Square photo",
    ratio: "1 / 1",
  },
  social: {
    label: "Instagram posts",
    title: "Put your next special in the spotlight.",
    text: "Turn the dish you’re serving today into the photo you post tonight. A portrait crop gives your food more room in the feed.",
    format: "Portrait · 4:5",
    ratio: "4 / 5",
  },
  stories: {
    label: "Stories",
    title: "Fill the screen. Bring on the appetite.",
    text: "Give your lunch special, seasonal dish, or new menu item a full-screen moment. Download a vertical image and add your message when you post.",
    format: "Story · 9:16",
    ratio: "9 / 16",
  },
};

export default function Landing({
  onStart,
  onSignIn,
  signedIn = false,
}: {
  onStart: () => void;
  onSignIn: () => void;
  signedIn?: boolean;
}) {
  const [format, setFormat] = useState<keyof typeof formats>("menu");
  const selected = formats[format];
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
          <a href="#the-difference">The difference</a>
          <a href="#how-it-works">How it works</a>
          <a href="#where-it-works">Where to use it</a>
        </nav>
        <div className="pw-account">
          <button onClick={onSignIn}>
            {signedIn ? "My studio" : "Log in"}
          </button>
          <Button onClick={onStart}>
            {signedIn ? "Open studio" : "Try Plateworthy"}
            <ArrowUpRight size={16} />
          </Button>
        </div>
      </header>
      <main id="main">
        <section className="pw-hero" aria-labelledby="hero-title">
          <div className="pw-hero-intro">
            <div>
              <p className="pw-eyebrow">
                AI FOOD PHOTOGRAPHY. MADE FOR RESTAURANTS.
              </p>
              <h1 id="hero-title">
                Make your food
                <br />
                look <em>worth ordering.</em>
              </h1>
            </div>
            <div className="pw-hero-message">
              <p>
                Turn everyday phone photos into{" "}
                <strong>studio-quality food images</strong> for your menu,
                delivery apps, and Instagram. Give customers a reason to choose
                your food.
              </p>
              <Button onClick={onStart}>
                {signedIn
                  ? "Open my photo studio"
                  : "Create better food photos"}
                <ArrowUpRight />
              </Button>
              <span>Free private pilot · Invitation required</span>
            </div>
          </div>
          <div
            className={
              "pw-photo-stage " + (!hasStudioExample ? "single-photo" : "")
            }
            id="the-difference"
          >
            {hasStudioExample && (
              <figure className="pw-original">
                <div className="pw-photo-label">
                  <span>01 / ORIGINAL</span>
                  <span>Your starting point</span>
                </div>
                <img
                  src="/burger.jpg"
                  alt="Original burger photograph on a wooden table"
                  width="1125"
                  height="750"
                />
                <figcaption>Start with your original dish photo.</figcaption>
              </figure>
            )}
            <figure className="pw-studio">
              <div className="pw-photo-label">
                <span>
                  {hasStudioExample
                    ? "02 / STUDIO STYLING"
                    : "THE FOOD COMES FIRST"}
                </span>
                <span>
                  {hasStudioExample
                    ? "A new look, built around your dish"
                    : "Photography inspiration"}
                </span>
              </div>
              <img
                src={studioPhoto}
                alt={
                  hasStudioExample
                    ? "AI styling example of the reference burger in a clean studio setting"
                    : "A cheeseburger photographed with natural light"
                }
                width="1536"
                height="1024"
                fetchPriority="high"
              />
              <figcaption>
                {hasStudioExample
                  ? "Better lighting. A cleaner setting. Food at the center."
                  : "Help customers see what makes your food worth ordering."}
              </figcaption>
            </figure>
            {hasStudioExample && (
              <span className="pw-stage-arrow" aria-hidden="true">
                <ArrowRight size={22} />
              </span>
            )}
          </div>
          <div className="pw-example-note">
            <p>
              {hasStudioExample
                ? "Illustrative AI edit of a licensed photo, created for this demo. Live pilot results may differ."
                : "Licensed photography shown for inspiration, not as a generated result."}
            </p>
            <a href="#how-it-works">
              From photo to finished image <ArrowRight size={15} />
            </a>
          </div>
        </section>
        <div className="pw-channel-bar">
          <p>
            LOOK GOOD WHERE
            <br />
            CUSTOMERS CHOOSE.
          </p>
          <span>Menus</span>
          <span>DoorDash</span>
          <span>Uber Eats</span>
          <span>Instagram</span>
          <span>Your website</span>
        </div>
        <section className="pw-workflow" id="how-it-works">
          <div className="pw-section-heading">
            <div>
              <p className="pw-eyebrow">FROM YOUR PHONE. TO YOUR NEXT ORDER.</p>
              <h2>
                A better photo.
                <br />
                Three simple steps.
              </h2>
            </div>
            <p>
              You’ve already made the food.
              <br />
              Here’s how to make the photo work harder.
            </p>
          </div>
          <ol className="pw-steps">
            <li>
              <div className="pw-step-top">
                <span>01</span>
                <Upload size={23} strokeWidth={1.4} />
              </div>
              <h3>Upload your dish.</h3>
              <p>
                Take a quick photo on your phone. Add the dish details so we
                know what should stay true to the plate.
              </p>
              <span className="pw-step-note">
                No camera kit. No editing skills.
              </span>
            </li>
            <li>
              <div className="pw-step-top">
                <span>02</span>
                <SlidersHorizontal size={23} strokeWidth={1.4} />
              </div>
              <h3>Choose your look.</h3>
              <p>
                Pick natural light, a clean tabletop, or a warmer restaurant
                feel. Get two options and ask for changes.
              </p>
              <span className="pw-step-note">
                Two images. You choose the favorite.
              </span>
            </li>
            <li>
              <div className="pw-step-top">
                <span>03</span>
                <Download size={23} strokeWidth={1.4} />
              </div>
              <h3>Review. Download. Share.</h3>
              <p>
                Check the ingredients and portion, choose a crop, and download.
                Your next menu photo or social post is ready.
              </p>
              <span className="pw-step-note">
                JPG & PNG · Square, portrait & story
              </span>
            </li>
          </ol>
        </section>
        <section className="pw-placements" id="where-it-works">
          <div className="pw-placement-copy">
            <p className="pw-eyebrow">
              ONE GREAT IMAGE. MORE WAYS TO GET NOTICED.
            </p>
            <h2>
              From “looks good”
              <br />
              to “let’s order.”
            </h2>
            <Tabs
              value={format}
              onValueChange={(v) => setFormat(v as keyof typeof formats)}
            >
              <TabsList className="pw-format-tabs">
                {Object.entries(formats).map(([key, item]) => (
                  <TabsTrigger key={key} value={key}>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.entries(formats).map(([key, item]) => (
                <TabsContent
                  key={key}
                  value={key}
                  className="pw-format-description"
                >
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <ul>
                    <li>
                      <Check size={16} />
                      Choose the crop before you download
                    </li>
                    <li>
                      <Check size={16} />
                      Keep every version in your photo library
                    </li>
                  </ul>
                </TabsContent>
              ))}
            </Tabs>
            <Button variant="outline" onClick={onStart}>
              Start with your food
              <ArrowUpRight />
            </Button>
          </div>
          <div className={"pw-format-stage format-" + format}>
            <div className="pw-format-top">
              <span>READY FOR YOUR NEXT POST</span>
              <span>{selected.format}</span>
            </div>
            <div
              className="pw-crop-frame"
              style={{ aspectRatio: selected.ratio }}
            >
              <img
                src={studioPhoto}
                alt={
                  "Example " +
                  selected.format.toLowerCase() +
                  " crop of the burger photo"
                }
                width="1536"
                height="1024"
                loading="lazy"
              />
            </div>
            <div className="pw-format-bottom">
              <span>
                <MoveHorizontal size={15} />
                {hasStudioExample
                  ? "Illustrative crop preview"
                  : "Photography inspiration"}
              </span>
              <span>JPG / PNG</span>
            </div>
          </div>
        </section>
        <section className="pw-real-food">
          <div className="pw-real-photo">
            <img
              src="/pasta.jpg"
              alt="Tomato pasta with visible basil and Parmesan"
              width="1000"
              height="1000"
              loading="lazy"
            />
            <span>Real food is the reference.</span>
          </div>
          <div className="pw-real-copy">
            <p className="pw-eyebrow">MAKE IT APPETIZING. KEEP IT HONEST.</p>
            <h2>
              Your regulars should
              <br />
              recognize the dish.
            </h2>
            <p>
              A great food photo sets the right expectation. Start with your
              actual dish, keep the details specific, and compare your original
              with every edit.
            </p>
            <p>
              Better light and presentation are the goal. You approve the
              ingredients, portion, and final image before using it.
            </p>
            <a href="#how-it-works">
              You’re always the final set of eyes.
              <ArrowUpRight size={17} />
            </a>
          </div>
        </section>
        <section className="pw-faq">
          <div>
            <p className="pw-eyebrow">BEFORE YOUR FIRST PHOTO</p>
            <h2>
              A few good
              <br />
              questions.
            </h2>
          </div>
          <Accordion type="single" collapsible className="pw-questions">
            <AccordionItem value="phone">
              <AccordionTrigger>
                Is a phone photo really enough?
              </AccordionTrigger>
              <AccordionContent>
                Yes. Start with a clear photo of the whole dish. You can choose
                the lighting and setting, then review two options. If you don’t
                have a photo, you can also start from a detailed description.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="accuracy">
              <AccordionTrigger>
                Will it still look like my food?
              </AccordionTrigger>
              <AccordionContent>
                Your reference photo and dish details guide the edit. AI can
                still change details, so compare the result with your original
                and check ingredients, portion, and plating before approving it.
                You can ask for a revision whenever it needs work.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="channels">
              <AccordionTrigger>
                Can I use the images on delivery apps and social media?
              </AccordionTrigger>
              <AccordionContent>
                Download JPG or PNG files for your menu, delivery listings,
                website, or social posts. Choose a square, portrait, or story
                crop. You upload the finished image to the platform yourself;
                Plateworthy doesn’t publish or connect to your delivery
                accounts.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="pilot">
              <AccordionTrigger>How does the free pilot work?</AccordionTrigger>
              <AccordionContent>
                Restaurant access is by invitation. Your invitation includes a
                free image allowance, and each request creates two options.
                Failed options restore their allowance. Use the invitation from
                your pilot coordinator to create your workspace. No subscription
                or payment card is needed.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
        <section className="pw-final-cta">
          <p className="pw-eyebrow">
            YOU MAKE IT DELICIOUS. NOW MAKE IT PLATEWORTHY.
          </p>
          <h2>
            The next photo
            <br />
            could be their next order.
          </h2>
          <Button onClick={onStart}>
            {signedIn ? "Open my photo studio" : "Make my food Plateworthy"}
            <ArrowUpRight />
          </Button>
          <p>Start with one dish. Free during the invitation-only pilot.</p>
        </section>
      </main>
      <footer className="pw-footer">
        <a href="/" aria-label="Plateworthy home">
          <Brand />
        </a>
        <p>Food photos worth ordering from.</p>
        <button onClick={onSignIn}>
          {signedIn ? "My studio" : "Log in"}
          <ArrowUpRight size={16} />
        </button>
        <div>
          <span>© {new Date().getFullYear()} Plateworthy</span>
          <span>Made for independent restaurants, cafés, and food trucks.</span>
        </div>
      </footer>
    </div>
  );
}
