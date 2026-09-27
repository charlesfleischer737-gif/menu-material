import { ArrowRight, Check } from "lucide-react";
import {
  productScreenshotPath,
  productScreenshotSrcSet,
  productScreenshots,
  type ProductScreenshot,
} from "@/lib/homepage-product";

// What Free and Pro include follows the plan cards (app/components/
// plan-cards.tsx) and lib/plans.ts; change them together. Links are plain
// <a>, as elsewhere on the public site: next/link's client navigation throws
// in the vinext production build.
const products: {
  id: string;
  label: string;
  title: string;
  lead: string;
  points: string[];
  free: string;
  pro: string;
  shot: ProductScreenshot;
  frame: "phone" | "screen";
}[] = [
  {
    id: "menus",
    label: "Menus & QR codes",
    title: "A QR code menu for every table.",
    lead: "Build your menu once and put its QR code on your tables. Guests scan it and open your menu on their phone, with your hours and one tap to call you or get directions.",
    points: [
      "Start from the menu you have: upload a photo or PDF of it, paste the text, or pick from My Dishes.",
      "Label diets and allergens, so guests can filter by diet and hide dishes with an allergen.",
      "Mark a dish sold out or change a price from your phone, and guests see it right away. Your link and QR code keep working.",
      "Print it too, as a PDF or a 4 × 6 table card with its QR code.",
    ],
    free: "One live menu in The Brasserie design, with its QR code, PDF and table card.",
    pro: "Up to 30 live menus, every menu design, a photo for every dish, your own colors, full menu insights and no “Made with Menu Material”.",
    shot: productScreenshots.menu,
    frame: "phone",
  },
  {
    id: "posts",
    label: "Posts",
    title: "Instagram posts from your own dishes.",
    lead: "Choose a dish and Post Maker lays out a matching post and Story, with a caption you can make your own.",
    points: [
      "Designs picked for the dish, in 4:5 or 3:4 for your feed and 9:16 for Stories.",
      "Story text stays clear of Instagram’s own buttons.",
      "Share straight from your phone, or download the images and copy the caption.",
    ],
    free: "Posts and Stories in three designs.",
    pro: "Every post design, carousels and multi-dish offers in your own colors and fonts, plus Campaigns: a matching post, Story, counter sign and menu special.",
    shot: productScreenshots.post,
    frame: "screen",
  },
];

/** Menus & QR codes, and Posts: what Menu Material makes beyond photos. */
export default function HomepageProduct() {
  return (
    <>
      {products.map(
        ({ id, label, title, lead, points, free, pro, shot, frame }) => (
          <section
            key={id}
            id={id}
            className={`pw-product is-${id}`}
            aria-labelledby={`${id}-title`}
          >
            <div className="pw-product-copy">
              <p className="pw-product-label">{label}</p>
              <h2 id={`${id}-title`}>{title}</h2>
              <p className="pw-product-lead">{lead}</p>
              <ul className="pw-product-points">
                {points.map((point) => (
                  <li key={point}>
                    <Check size={17} strokeWidth={2.4} aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
              <dl className="pw-product-plans">
                <div>
                  <dt>Free</dt>
                  <dd>{free}</dd>
                </div>
                <div>
                  <dt>Pro</dt>
                  <dd>{pro}</dd>
                </div>
              </dl>
              <a className="pw-product-link" href="/pricing">
                Compare Free and Pro
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            <figure className={`pw-product-shot is-${frame}`}>
              <img
                src={productScreenshotPath(shot.name, shot.widths[1])}
                srcSet={productScreenshotSrcSet(shot)}
                sizes={shot.sizes}
                alt={shot.alt}
                width={shot.width}
                height={shot.height}
                loading="lazy"
                decoding="async"
              />
              <figcaption>{shot.caption}</figcaption>
            </figure>
          </section>
        ),
      )}
    </>
  );
}
