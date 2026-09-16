"use client";

import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HomepageStyleGallery from "./homepage-style-gallery";
const PostCanvas = lazy(() =>
  import("./post-canvas").then((m) => ({ default: m.PostCanvas })),
);

const useCases = [
  {
    name: "Delivery apps",
    image: "/homepage/restaurants.webp",
    alt: "Sliced steak with herb butter and golden fries on a ceramic plate",
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
  const [preview, setPreview] = useState("post");
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
      <HomepageStyleGallery />
      <section
        className="pw-features pw-features-compact"
        id="features"
        aria-labelledby="features-title"
        tabIndex={-1}
      >
        <article className="pw-showcase" style={theme}>
          <div className="pw-showcase-copy">
            <span className="pw-eyebrow">ONE DISH. EVERY CHANNEL.</span>
            <h2 id="features-title">
              One great photo.
              <br /> Ready for every channel.
            </h2>
            <p>
              Your menu photo, a matching post, and a Story. Download for the
              places you already sell and share.
            </p>
            <Button onClick={onStart}>
              {signedIn ? "Open my studio" : "Try it with your dish"}
              <ArrowRight size={17} />
            </Button>
          </div>
          <Tabs
            value={preview}
            onValueChange={setPreview}
            className="pw-showcase-demo"
            aria-label="Preview a dish in different formats"
          >
            <TabsList aria-label="Preview format">
              <TabsTrigger value="photo">Menu photo</TabsTrigger>
              <TabsTrigger value="post">Post</TabsTrigger>
              <TabsTrigger value="story">Story</TabsTrigger>
            </TabsList>
            <TabsContent value="photo" className="pw-showcase-panel">
              <div className="pw-showcase-stage">
                <img
                  className="pw-showcase-photo"
                  src="/homepage/menus.webp"
                  alt="Rigatoni photo ready for an existing menu or ordering platform"
                  width="1024"
                  height="1024"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </TabsContent>
            <TabsContent value="post" className="pw-showcase-panel">
              <div className="pw-showcase-stage">
                <PromotionGraphic price={displayPrice} palette={palette} />
              </div>
            </TabsContent>
            <TabsContent value="story" className="pw-showcase-panel">
              <div className="pw-showcase-stage">
                <PromotionGraphic
                  price={displayPrice}
                  palette={palette}
                  story
                />
              </div>
            </TabsContent>
            {preview === "photo" ? (
              <div
                className="pw-showcase-destinations"
                aria-label="Example photo destinations"
              >
                <span>Toast</span>
                <span>Delivery apps</span>
                <span>Your website</span>
              </div>
            ) : (
              <div className="pw-demo-controls pw-showcase-controls">
                <label htmlFor="demo-offer-price">
                  Price
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
                      aria-invalid={displayPrice === "$—"}
                    />
                  </span>
                </label>
                <fieldset>
                  <legend className="sr-only">Choose a brand color</legend>
                  <span className="pw-showcase-color-label" aria-hidden="true">
                    Color
                  </span>
                  <div className="pw-demo-swatches">
                    <button
                      type="button"
                      className="pw-demo-swatch is-wine"
                      aria-label="Use wine brand color"
                      aria-pressed={palette === "wine"}
                      onClick={() => setPalette("wine")}
                    >
                      {palette === "wine" && (
                        <Check size={16} aria-hidden="true" />
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
                        <Check size={16} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </fieldset>
              </div>
            )}
            <p
              id="demo-price-hint"
              className="pw-showcase-note"
              aria-live="polite"
            >
              {preview === "photo"
                ? "Download, then upload through your existing platform."
                : displayPrice === "$—"
                  ? "Enter a price from $0 to $9,999."
                  : preview === "post"
                    ? `Caption starter: Pasta night. ${displayPrice} tonight, 5–9 pm.`
                    : "Same dish. Same colors. Ready for your Story."}
            </p>
          </Tabs>
        </article>
      </section>
    </>
  );
}
