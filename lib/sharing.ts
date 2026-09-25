import type { Row } from "./client";
import { publicBrandStyle } from "./restaurant-look";

export function publishedRestaurant(restaurant: Row) {
  let snapshot: Row = {};
  try {
    snapshot =
      typeof restaurant.published === "string"
        ? JSON.parse(restaurant.published)
        : restaurant.published || {};
  } catch {}
  const saved = snapshot.restaurant || restaurant;
  return {
    name: saved.name || restaurant.name,
    style: publicBrandStyle(saved.style),
    currency: saved.currency || restaurant.currency,
  };
}

// Captions, review toggles and saved-draft revisions do not change image pixels.
export function postVisualState(
  draft: Row,
  restaurant: Row,
  channel = "feed",
  slide = 0,
) {
  const keys = [
    "items",
    "color",
    "template",
    "title",
    "description",
    "showPrice",
    "price",
    "validity",
    "textY",
    "textMode",
    "showBrand",
    "accent",
    "kicker",
    "cta",
    "typography",
    "brandMode",
    "compositionVersion",
    "textPlacement",
    "carouselCover",
    "carouselClosing",
    "feedShape",
  ];
  return {
    draft: {
      ...Object.fromEntries(keys.map((key) => [key, draft[key]])),
      layouts: { [channel]: draft.layouts?.[channel] },
    },
    restaurant: {
      name: restaurant.name,
      slug: restaurant.slug,
      currency: restaurant.currency,
      logo_id: restaurant.logo_id,
      style: {
        primary: restaurant.style?.primary,
        accent: restaurant.style?.accent,
      },
    },
    channel,
    slide,
  };
}

export const postShareFormats: Record<
  string,
  { label: string; detail: string }
> = {
  feed: { label: "Post", detail: "1080 × 1350" },
  story: { label: "Story", detail: "1080 × 1920" },
  carousel: { label: "Carousel", detail: "One dish per slide" },
};
/** The size line for a format, following the post's chosen shape. */
export function postFormatDetail(draft: Row, channel: string) {
  if (channel === "feed")
    return draft.feedShape === "3:4"
      ? "1080 × 1440 · 3:4"
      : "1080 × 1350 · 4:5";
  return postShareFormats[channel]?.detail || "";
}
