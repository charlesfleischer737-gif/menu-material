"use client";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Brand from "./brand";

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
    <div className="landing">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="landing-header">
        <a href="/" aria-label="SideDish home">
          <Brand />
        </a>
        <nav aria-label="Main navigation">
          <a href="#toolkit">What you can do</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="landing-account">
          <button onClick={onSignIn}>
            {signedIn ? "Workspace" : "Log in"}
          </button>
          <Button onClick={onStart}>
            {signedIn ? "Open workspace" : "Get started"}{" "}
            <ArrowUpRight size={16} />
          </Button>
        </div>
      </header>
      <main id="main">
        <section className="sd-hero">
          <div className="hero-copy">
            <p className="sd-kicker">YOUR RESTAURANT’S NEW RIGHT HAND</p>
            <h1>
              Good food.
              <br />
              <span>
                Less on
                <br className="hero-break" /> your plate.
              </span>
            </h1>
            <p className="hero-description">
              Food photos, social posts, and your online menu. One helpful
              workspace that gives you more time for the restaurant you love.
            </p>
            <div className="hero-actions">
              <Button onClick={onStart}>
                {signedIn ? "Back to your workspace" : "Meet your SideDish"}{" "}
                <ArrowUpRight />
              </Button>
              <a href="#toolkit">
                Take a look <ArrowRight size={16} />
              </a>
            </div>
            <p className="pilot-line">
              Free during our private pilot. Yours by invitation.
            </p>
          </div>
          <figure className="hero-food">
            <div className="hero-food-photo">
              <img
                src="/burger.jpg"
                alt="A freshly made cheeseburger with tomato, lettuce, and a toasted bun"
                fetchPriority="high"
                width="1400"
                height="1600"
              />
            </div>
            <figcaption>
              <span>YOU BRING THE GOOD FOOD.</span>
              <span>
                We’ll help get it out there. <ArrowUpRight size={18} />
              </span>
            </figcaption>
          </figure>
        </section>
        <div className="restaurant-strip">
          <p>
            Made for the people
            <br />
            behind the counter.
          </p>
          <span>Neighborhood restaurants</span>
          <span>Food trucks</span>
          <span>Cafés & market stalls</span>
        </div>
        <section className="toolkit-section" id="toolkit">
          <div className="section-heading">
            <p className="sd-kicker">A LITTLE HELP GOES A LONG WAY</p>
            <h2>
              One dish.
              <br />
              <span>A whole lot of possibilities.</span>
            </h2>
            <p>
              Your photos, words, and menu belong together.
              <br className="desktop" /> SideDish keeps them that way.
            </p>
          </div>
          <Tabs defaultValue="photos" className="toolkit-tabs">
            <TabsList className="toolkit-tab-list">
              <TabsTrigger value="photos">
                <Camera size={18} />
                <span>Food photos</span>
                <span className="tab-number">01</span>
              </TabsTrigger>
              <TabsTrigger value="captions">
                <MessageSquare size={18} />
                <span>Social captions</span>
                <span className="tab-number">02</span>
              </TabsTrigger>
              <TabsTrigger value="menu">
                <BookOpen size={18} />
                <span>Online menu</span>
                <span className="tab-number">03</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="photos" className="toolkit-panel">
              <div className="toolkit-visual photo-visual">
                <img
                  src="/pasta.jpg"
                  alt="Spaghetti with tomato sauce and fresh basil"
                  loading="lazy"
                  width="1000"
                  height="1000"
                />
                <span className="sample-label">
                  Photography inspiration · not an AI result
                </span>
                <div className="photo-detail">
                  <span>THE DETAILS MATTER</span>
                  <p>
                    Real ingredients.
                    <br />
                    Honest portions.
                    <br />
                    Your final say.
                  </p>
                </div>
              </div>
              <div className="toolkit-copy">
                <p className="sd-kicker">THE PHOTO STUDIO</p>
                <h3>
                  Make it look
                  <br />
                  as good as it tastes.
                </h3>
                <p>
                  Start with a quick photo of your dish, or describe it. Get two
                  image options, ask for changes, and choose the one that feels
                  right.
                </p>
                <ul>
                  <li>
                    <Check />
                    Original and edited photos, side by side
                  </li>
                  <li>
                    <Check />
                    Every version saved with your dish
                  </li>
                  <li>
                    <Check />
                    Ready to download for posts and menus
                  </li>
                </ul>
                <Button variant="outline" onClick={onStart}>
                  Start with your dish <ArrowUpRight />
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="captions" className="toolkit-panel">
              <div className="toolkit-visual caption-visual">
                <div className="sample-post">
                  <div className="sample-post-header">
                    <span className="sample-avatar">Y</span>
                    <div>
                      <b>Your restaurant</b>
                      <span>Caption example</span>
                    </div>
                  </div>
                  <img
                    src="/pasta.jpg"
                    alt="Example restaurant post featuring tomato pasta"
                    loading="lazy"
                    width="600"
                    height="430"
                  />
                  <p>
                    Tomato sauce, fresh basil, a little Parmesan. Sometimes the
                    simplest plates say it best.
                  </p>
                  <div className="sample-post-footer">
                    YOUR DISH. YOUR VOICE.
                  </div>
                </div>
              </div>
              <div className="toolkit-copy">
                <p className="sd-kicker">THE WORDS TO GO WITH IT</p>
                <h3>
                  Today’s special.
                  <br />
                  Tomorrow’s post.
                </h3>
                <p>
                  Turn the details you’ve already saved into a caption. Make it
                  sound like you, copy it, and share it wherever your customers
                  are.
                </p>
                <ul>
                  <li>
                    <Check />
                    Written from your confirmed dish details
                  </li>
                  <li>
                    <Check />
                    Edit and save your favorite captions
                  </li>
                  <li>
                    <Check />
                    No starting from a blank page
                  </li>
                </ul>
                <Button variant="outline" onClick={onStart}>
                  Find the words <ArrowUpRight />
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="menu" className="toolkit-panel">
              <div className="toolkit-visual menu-visual">
                <div className="sample-menu">
                  <div className="sample-menu-top">
                    YOUR RESTAURANT<span>Menu example</span>
                  </div>
                  <h4>
                    A little
                    <br />
                    something good.
                  </h4>
                  <p className="sample-menu-section">FROM THE KITCHEN</p>
                  <img
                    src="/pasta.jpg"
                    alt="Tomato pasta on an example restaurant menu"
                    loading="lazy"
                    width="600"
                    height="300"
                  />
                  <div className="sample-menu-dish">
                    <b>Tomato & basil pasta</b>
                    <span>14</span>
                  </div>
                  <p>Spaghetti, tomato sauce, basil & Parmesan.</p>
                  <footer>
                    Made with <Brand />
                  </footer>
                </div>
              </div>
              <div className="toolkit-copy">
                <p className="sd-kicker">A MENU THAT KEEPS UP</p>
                <h3>
                  Fresh specials.
                  <br />
                  Fresh menu.
                </h3>
                <p>
                  Bring your saved dishes together on a simple menu page. Update
                  prices, mark what’s available, then publish when you’re ready.
                </p>
                <ul>
                  <li>
                    <Check />
                    One link for your customers
                  </li>
                  <li>
                    <Check />A downloadable QR code for your counter
                  </li>
                  <li>
                    <Check />
                    Private edits until you hit publish
                  </li>
                </ul>
                <Button variant="outline" onClick={onStart}>
                  Make your menu <ArrowUpRight />
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </section>
        <section className="how-section" id="how-it-works">
          <div className="how-intro">
            <p className="sd-kicker">LESS ADMIN. MORE SERVICE.</p>
            <h2>
              Start with what
              <br />
              you’re serving.
            </h2>
            <p>
              One dish is all you need to get going.
              <br />
              No design skills. No new routine.
            </p>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>Show us your dish.</h3>
                <p>
                  Add a photo or a few details. We recommend a photo of the real
                  thing.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Make it yours.</h3>
                <p>
                  Review your images, refine the caption, and keep everything
                  that works.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Put it to work.</h3>
                <p>
                  Download the photo, copy your post, and add the dish to your
                  menu.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="pilot-section" id="pilot">
          <div>
            <p className="sd-kicker">IN YOUR CORNER. ON YOUR COUNTER.</p>
            <h2>
              You’ve got enough
              <br />
              on your plate.
            </h2>
            <p>
              Let SideDish help with the rest.
              <br />
              Join our free, invitation-only restaurant pilot.
            </p>
          </div>
          <div className="pilot-action">
            <Button onClick={onStart}>
              Let’s get cooking <ArrowUpRight />
            </Button>
            <span>Already invited? Your workspace is ready.</span>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <a href="/" aria-label="SideDish home">
          <Brand />
        </a>
        <p>A little help for the restaurant you love.</p>
        <button onClick={onSignIn}>
          Log in <ArrowUpRight size={16} />
        </button>
        <div className="landing-fineprint">
          <span>© {new Date().getFullYear()} SideDish</span>
          <span>
            Photos shown are inspiration. Your images are yours to review.
          </span>
        </div>
      </footer>
    </div>
  );
}
