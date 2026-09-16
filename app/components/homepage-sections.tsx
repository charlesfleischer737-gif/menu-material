"use client";

import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ArrowRight, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const PostCanvas = lazy(() =>
  import("./post-canvas").then((m) => ({ default: m.PostCanvas })),
);

const useCases = [
  {
    name: "Delivery apps",
    image: "/homepage/delivery.webp",
    alt: "Juicy burger with crisp lettuce on a sesame bun, photographed against a clean background",
    text: "Make the first bite happen with a photo. Clean, appetizing images for your delivery listings.",
  },
  {
    name: "Social media",
    image: "/homepage/social.webp",
    alt: "Crispy fish tacos with fresh slaw, herbs and lime, styled for a vibrant social post",
    text: "Give today’s special its moment. Beautiful posts, Stories, and captions ready to make your own.",
  },
  {
    name: "Your existing menu",
    image: "/homepage/menus.webp",
    alt: "Tomato rigatoni with basil and Parmesan on a ceramic plate",
    text: "Refresh the photos on Toast, your website, or the menu platform you already use.",
  },
];

function PromotionGraphic({
  price,
  story = false,
  palette,
}: {
  price: string;
  story?: boolean;
  palette: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (!("IntersectionObserver" in window)) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const placeholder = (
    <div
      className="pw-demo-placeholder"
      style={{ aspectRatio: story ? "9 / 16" : "4 / 5" }}
      aria-label="Interactive design preview"
    >
      <img
        src="/homepage/menus.webp"
        alt="Rigatoni al pomodoro"
        loading="lazy"
      />
      <span>Pasta night. {price}</span>
    </div>
  );
  return (
    <div
      ref={ref}
      className={`pw-demo-graphic pw-live-design ${story ? "is-story" : "is-feed"}`}
    >
      {visible ? (
        <Suspense fallback={placeholder}>
          <PostCanvas
            channel={story ? "story" : "feed"}
            example
            restaurant={{ name: "THE NEIGHBORHOOD TABLE", currency: "USD" }}
            draft={{
              template: "special",
              title: `Pasta night.\n${price}`,
              kicker: "",
              cta: "",
              textMode: "full",
              showBrand: true,
              color: palette === "wine" ? "#531f34" : "#214a36",
              accent: palette === "wine" ? "#ffd0dd" : "#cafa98",
              items: [
                {
                  name: "Rigatoni al pomodoro",
                  quantity: 1,
                  photoUrl: "/homepage/menus.webp",
                },
              ],
              price: price.replace(/[^0-9.]/g, ""),
              showPrice: false,
              validity: "Tonight · 5–9 pm",
              layouts: {},
            }}
          />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}

export default function HomepageSections({
  onStart,
  signedIn,
}: {
  onStart: () => void;
  signedIn: boolean;
}) {
  const [price, setPrice] = useState("18");
  const [palette, setPalette] = useState("wine");
  const amount = Number(price);
  const displayPrice =
    price !== "" && Number.isFinite(amount) && amount >= 0 && amount <= 9999
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        }).format(amount)
      : "$—";
  const theme = {
    "--demo-color": palette === "wine" ? "#672e39" : "#263f34",
  } as CSSProperties;

  return (
    <>
      <section
        className="pw-use-cases"
        id="use-cases"
        aria-labelledby="use-cases-title"
        tabIndex={-1}
      >
        <div className="pw-section-heading pw-split-heading">
          <div>
            <span className="pw-eyebrow">ONE DISH. THREE WAYS TO SHOW IT.</span>
            <h2 id="use-cases-title">Good food, ready to go places.</h2>
          </div>
          <div className="pw-use-case-intro">
            <p>For restaurants, bars, cafés, bakeries, and food trucks.</p>
          </div>
        </div>
        <Carousel
          className="pw-use-case-carousel"
          aria-label="Ways to use Plateworthy"
          tabIndex={0}
          opts={{
            align: "start",
            loop: false,
            breakpoints: {
              "(min-width: 701px)": { active: false },
              "(prefers-reduced-motion: reduce)": { duration: 0 },
            },
          }}
        >
          <CarouselContent className="pw-use-case-slides">
            {useCases.map((item, index) => (
              <CarouselItem
                className="pw-use-case-slide"
                key={item.name}
                aria-label={`${index + 1} of ${useCases.length}: ${item.name}`}
              >
                <article className="pw-use-case">
                  <div className="pw-use-case-photo">
                    <img
                      src={item.image}
                      alt={item.alt}
                      width="960"
                      height="640"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <h3>{item.name}</h3>
                  <p>{item.text}</p>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="pw-gallery-controls">
            <span>Swipe to explore</span>
            <div>
              <CarouselPrevious aria-label="Previous use case" />
              <CarouselNext aria-label="Next use case" />
            </div>
          </div>
        </Carousel>
      </section>
      <section
        className="pw-features"
        id="features"
        aria-labelledby="features-title"
        tabIndex={-1}
      >
        <div className="pw-section-heading">
          <span className="pw-eyebrow">
            FROM A GREAT DISH TO A FINISHED PROMOTION
          </span>
          <h2 id="features-title">A better photo is just the start.</h2>
          <p>
            Your food, your look, and everything you need to put it out there.
          </p>
        </div>
        <article className="pw-feature-main" style={theme}>
          <div className="pw-feature-main-copy">
            <span className="pw-feature-kicker">TRY IT FOR YOURSELF</span>
            <h3>
              One special.
              <br />
              Every way to share it.
            </h3>
            <p>
              Start with a photo for your existing menu. Make a matching post
              and Story with your colors, then download for the channels you
              use.
            </p>
            <ul className="pw-feature-benefits">
              <li>
                <Check size={17} aria-hidden="true" />
                One photo, a consistent look
              </li>
              <li>
                <Check size={17} aria-hidden="true" />
                Ready to review, download, and share
              </li>
            </ul>
          </div>
          <Tabs
            defaultValue="photo"
            className="pw-promotion-demo"
            aria-label="Interactive example promotion package"
          >
            <TabsList aria-label="Preview format">
              <TabsTrigger value="photo">Menu photo</TabsTrigger>
              <TabsTrigger value="post">Post</TabsTrigger>
              <TabsTrigger value="story">Story</TabsTrigger>
            </TabsList>
            <div className="pw-demo-controls">
              <label htmlFor="demo-offer-price">
                Try your own price
                <span className="pw-demo-price-field">
                  <span aria-hidden="true">$</span>
                  <input
                    id="demo-offer-price"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="9999"
                    step="0.01"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    aria-describedby="demo-price-hint"
                    aria-invalid={price !== "" && displayPrice === "$—"}
                  />
                </span>
              </label>
              <fieldset>
                <legend>Make it your color</legend>
                <div className="pw-demo-swatches">
                  <button
                    type="button"
                    className="pw-demo-swatch is-wine"
                    aria-label="Use wine brand color"
                    aria-pressed={palette === "wine"}
                    onClick={() => setPalette("wine")}
                  >
                    {palette === "wine" && (
                      <Check size={17} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="pw-demo-swatch is-green"
                    aria-label="Use forest brand color"
                    aria-pressed={palette === "green"}
                    onClick={() => setPalette("green")}
                  >
                    {palette === "green" && (
                      <Check size={17} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </fieldset>
            </div>
            <p id="demo-price-hint" className="pw-demo-hint">
              {price !== "" && displayPrice === "$—"
                ? "Enter a price from $0 to $9,999."
                : "Change the price or color in your matching post and Story."}
            </p>
            <TabsContent value="post" className="pw-format-panel">
              <div className="pw-preview-stage">
                <PromotionGraphic price={displayPrice} palette={palette} />
              </div>
              <div className="pw-demo-caption">
                <span className="pw-output-label">
                  Your caption, ready to edit
                </span>
                <p>
                  Tonight calls for a little comfort. Rigatoni, tomato, fresh
                  basil. <strong data-demo-price>{displayPrice}</strong>{" "}
                  tonight, 5–9 pm. See you at the table.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="story" className="pw-format-panel">
              <div className="pw-preview-stage">
                <PromotionGraphic
                  price={displayPrice}
                  palette={palette}
                  story
                />
              </div>
              <p className="pw-format-note">
                A matching vertical design, ready for your Story.
              </p>
            </TabsContent>
            <TabsContent value="photo" className="pw-format-panel">
              <div className="pw-preview-stage pw-export-example">
                <img
                  src="/homepage/menus.webp"
                  alt="The same rigatoni photo, ready to crop for an existing menu or ordering platform"
                  width="1024"
                  height="1024"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <Download size={20} aria-hidden="true" />
                  <strong>Your dish. Your existing menu.</strong>
                  <span>
                    Download a clean photo for Toast, delivery apps, or your
                    website.
                  </span>
                </div>
              </div>
              <p className="pw-format-note">
                Choose a destination, check the crop, and upload through the
                platform you already use.
              </p>
            </TabsContent>
            <p className="pw-demo-disclosure">
              Example previews. Download files to upload yourself; no platform
              connection required.
            </p>
          </Tabs>
        </article>
        <div className="pw-features-end">
          <p>
            Start with a photo. Finish with something you’re proud to share.
          </p>
          <Button onClick={onStart}>
            {signedIn ? "Open my studio" : "Try it with your dish"}
            <ArrowRight size={17} />
          </Button>
        </div>
      </section>
    </>
  );
}
