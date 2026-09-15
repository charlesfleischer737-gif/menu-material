"use client";

import { useState, type CSSProperties } from "react";
import { ArrowLeftRight, ArrowRight, Check, Clock3, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    name: "Menus",
    image: "/homepage/menus.webp",
    alt: "Tomato rigatoni with basil and Parmesan on a ceramic plate",
    text: "Let customers order with their eyes. Bring every dish to life on a menu you can share anywhere.",
  },
  {
    name: "Bars & restaurants",
    image: "/homepage/restaurants.webp",
    alt: "Seared steak with melting herb butter and golden fries in a warmly lit bistro",
    text: "From lunch specials to date-night favorites, give people a reason to book a table or stop by.",
  },
  {
    name: "Bakeries & cafés",
    image: "/homepage/cafes.webp",
    alt: "Flaky golden croissant, strawberry pastry and a latte in soft morning light",
    text: "Make the morning irresistible. Show off fresh pastries, seasonal drinks, and your daily bake.",
  },
  {
    name: "Food trucks",
    image: "/homepage/food-trucks.webp",
    alt: "Birria tacos with cilantro, onion, lime and consommé on a sunlit food truck counter",
    text: "Turn the next scroll into your next stop. Put street-food favorites and daily specials in the spotlight.",
  },
];

function PromotionGraphic({
  price,
  story = false,
}: {
  price: string;
  story?: boolean;
}) {
  return (
    <div className={`pw-demo-graphic ${story ? "is-story" : "is-feed"}`}>
      <div className="pw-demo-brand">THE NEIGHBORHOOD TABLE</div>
      <img
        src="/homepage/menus.webp"
        alt="Tomato rigatoni featured in the example promotion"
        width="960"
        height="960"
        loading="lazy"
      />
      <div className="pw-demo-graphic-copy">
        <span>TONIGHT’S SPECIAL</span>
        <strong>
          A little taste
          <br />
          of the good life.
        </strong>
        <div className="pw-demo-offer">
          <span>Rigatoni al pomodoro</span>
          <b data-demo-price>{price}</b>
        </div>
        <small>Tonight · 5–9 pm</small>
      </div>
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
  const [enhanced, setEnhanced] = useState(true);
  const [soldOut, setSoldOut] = useState(false);
  const amount = Number(price);
  const displayPrice =
    price !== "" && Number.isFinite(amount) && amount >= 0
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
      >
        <div className="pw-section-heading pw-split-heading">
          <div>
            <span className="pw-eyebrow">
              MADE FOR YOUR KIND OF FOOD BUSINESS
            </span>
            <h2 id="use-cases-title">Good food. So many ways to show it.</h2>
          </div>
          <p>
            Wherever you serve it. Wherever they discover it.
            <br className="pw-desktop-break" /> Make every first impression look
            delicious.
          </p>
        </div>
        <div className="pw-use-case-grid">
          {useCases.map((item) => (
            <article className="pw-use-case" key={item.name}>
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
          ))}
        </div>
      </section>

      <section
        className="pw-features"
        id="features"
        aria-labelledby="features-title"
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
            <span className="pw-feature-kicker">01 / THE WHOLE PROMOTION</span>
            <h3>
              One special.
              <br />
              Every way to share it.
            </h3>
            <p>
              Turn one dish photo into a matching post, Story, counter sign, and
              caption. Your colors carry through. Your food gets the spotlight.
            </p>
            <ul className="pw-feature-benefits">
              <li>
                <Check size={17} aria-hidden="true" />
                Change the price without remaking the photo
              </li>
              <li>
                <Check size={17} aria-hidden="true" />
                Keep your logo, colors, and tone consistent
              </li>
              <li>
                <Check size={17} aria-hidden="true" />
                Review, download, and share when you’re ready
              </li>
            </ul>
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
                    step="0.5"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    aria-describedby="demo-price-hint"
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
              Watch the examples update. The food photo stays the same.
            </p>
          </div>
          <div
            className="pw-promotion-demo"
            aria-label="Interactive example promotion package"
          >
            <div className="pw-demo-output pw-demo-feed">
              <span className="pw-output-label">Instagram post</span>
              <PromotionGraphic price={displayPrice} />
            </div>
            <div className="pw-demo-output pw-demo-story">
              <span className="pw-output-label">Story</span>
              <PromotionGraphic price={displayPrice} story />
            </div>
            <div className="pw-demo-caption">
              <span className="pw-output-label">
                Your caption, ready to edit
              </span>
              <p>
                Tonight calls for a little comfort. Rigatoni, slow-cooked
                tomato, fresh basil.{" "}
                <strong data-demo-price>{displayPrice}</strong> tonight, 5–9 pm.
                See you at the table.
              </p>
            </div>
          </div>
        </article>

        <div className="pw-feature-pair">
          <article className="pw-feature-card">
            <div className="pw-fidelity-demo">
              <img
                src={
                  enhanced
                    ? "/homepage/burger-enhanced.webp"
                    : "/homepage/burger-original.webp"
                }
                alt={
                  enhanced
                    ? "AI-enhanced burger with studio lighting and a clean background"
                    : "Original phone-style photo of the burger on a plate"
                }
                width="960"
                height="640"
                loading="lazy"
              />
              <span className="pw-fidelity-label">
                {enhanced
                  ? "After · Studio lighting"
                  : "Before · Original photo"}
              </span>
              <button
                type="button"
                onClick={() => setEnhanced(!enhanced)}
                className="pw-photo-toggle"
                aria-pressed={!enhanced}
              >
                <ArrowLeftRight size={16} aria-hidden="true" />
                {enhanced ? "See the original" : "See the result"}
              </button>
            </div>
            <div className="pw-feature-card-copy">
              <span className="pw-feature-kicker">
                02 / FOOD WORTH A SECOND LOOK
              </span>
              <h3>Better light. A more appetizing first impression.</h3>
              <p>
                Start with your actual dish. Refine the lighting and
                surroundings, compare the original, and ask for a targeted
                change. You choose the result that represents your food.
              </p>
              <span className="pw-feature-footnote">
                AI-enhanced example. Always review your dish before sharing.
              </span>
            </div>
          </article>
          <article className="pw-feature-card">
            <div className="pw-live-menu-demo">
              <div className="pw-demo-menu-sheet">
                <div className="pw-demo-menu-header">
                  <span>THE NEIGHBORHOOD TABLE</span>
                  <strong>
                    Something good,
                    <br />
                    on the menu.
                  </strong>
                </div>
                <div className="pw-demo-menu-item">
                  <img
                    src="/homepage/menus.webp"
                    alt="Rigatoni in the example hosted menu"
                    width="320"
                    height="320"
                    loading="lazy"
                  />
                  <div>
                    <span className="pw-menu-special-label">
                      TONIGHT’S SPECIAL
                    </span>
                    <h4>Rigatoni al pomodoro</h4>
                    <p>Tomato, basil, Parmesan.</p>
                    <strong data-demo-price>{displayPrice}</strong>
                  </div>
                </div>
                <div
                  className={`pw-demo-menu-status ${soldOut ? "is-sold-out" : ""}`}
                  aria-live="polite"
                >
                  <Clock3 size={15} aria-hidden="true" />
                  {soldOut
                    ? "Sold out for tonight"
                    : "Available tonight · 5–9 pm"}
                </div>
                <div className="pw-demo-menu-link">
                  <Link2 size={14} aria-hidden="true" />
                  One menu link. Always up to date.
                </div>
              </div>
              <button
                type="button"
                className="pw-menu-demo-toggle"
                onClick={() => setSoldOut(!soldOut)}
                aria-pressed={soldOut}
              >
                {soldOut ? "Make available again" : "Try marking it sold out"}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="pw-feature-card-copy">
              <span className="pw-feature-kicker">
                03 / A MENU THAT KEEPS UP
              </span>
              <h3>Tonight’s special. Live when you say so.</h3>
              <p>
                Approve and publish to your hosted menu. Specials expire on
                time, and sold-out dishes stop taking the spotlight. Your
                shareable link and QR code stay the same.
              </p>
              <span className="pw-feature-footnote">
                Interactive example. Changes here don’t publish a real menu.
              </span>
            </div>
          </article>
        </div>
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
