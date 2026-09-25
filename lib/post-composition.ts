import type { Row } from "./client";
import { money } from "./client";
import { emptyAdjustments } from "./studio";
import { brandTypeface } from "./restaurant-look";
import { getPostTemplate } from "./post-templates";
import { loadPostFonts } from "./post-fonts";
import {
  PostKit,
  analyzePhoto,
  makeCanvas,
  type Framing,
  type Safe,
  luminance,
} from "./post-kit";
import { designFonts, designs, type Design, type Logo } from "./post-designs";

export function carouselSlides(draft: Row): Row[] {
  const items: Row[] = draft.items || [];
  return [
    ...(draft.carouselCover
      ? [{ kind: "cover", items, title: draft.title, key: "cover" }]
      : []),
    ...items.map((item, index) => ({
      kind: "dish",
      items: [item],
      title: item.headline || item.name,
      key: item.dishId || String(index),
      itemIndex: index,
    })),
    ...(draft.carouselClosing
      ? [
          {
            kind: "closing",
            items: items.slice(0, 1),
            title: draft.carouselClosing,
            key: "closing",
          },
        ]
      : []),
  ];
}
export function postSlideCount(draft: Row, channel: string) {
  return channel === "carousel"
    ? draft.compositionVersion === 2
      ? carouselSlides(draft).length
      : draft.items.length
    : 1;
}
/** Output size: Stories are 9:16; a single post is 4:5 or, when chosen, 3:4. */
export function postSize(draft: Row, channel: string) {
  return {
    width: 1080,
    height:
      channel === "story"
        ? 1920
        : channel === "feed" && draft.feedShape === "3:4"
          ? 1440
          : 1350,
  };
}
/**
 * Text and logos stay clear of Instagram's own controls: the profile row and
 * the reply bar on Stories, and the 3:4 grid crop on posts.
 */
export function postSafeArea(
  width: number,
  height: number,
  channel: string,
): Safe {
  return channel === "story"
    ? { top: 270, bottom: 1540, left: 72, right: width - 72 }
    : { top: 76, bottom: height - 76, left: 72, right: width - 72 };
}
const designWords: [string, RegExp][] = [
  [
    "afterdark",
    /cocktail|wine|beer|\bbar\b|drink|martini|spritz|negroni|whisk|mezcal|sake|highball/,
  ],
  [
    "bakery",
    /bakery|croissant|cake|pastry|bread|cookie|\bpie\b|tart|donut|doughnut|muffin|scone|brioche/,
  ],
  [
    "brunch",
    /brunch|pancake|waffle|\beggs?\b|toast|benedict|granola|breakfast|coffee|latte/,
  ],
  [
    "launch",
    /burger|pizza|taco|sandwich|fries|wings|hot dog|\bbao\b|ramen|noodle|kebab|burrito/,
  ],
  ["fresh", /salad|\bbowl|vegan|green|matcha|smoothie|juice|poke|season/],
];
export function recommendedDesigns(draft: Row, restaurant: Row) {
  // The dish itself speaks first; the restaurant's cuisine only breaks a tie.
  const match = (words: string) =>
    designWords.find(([, pattern]) => pattern.test(words))?.[0];
  const lead =
    draft.occasion === "event"
      ? "event"
      : draft.occasion === "combo"
        ? "combo"
        : draft.occasion === "special"
          ? "special"
          : match(
              `${draft.items?.[0]?.name || ""} ${draft.items?.[0]?.category || ""}`.toLowerCase(),
            ) ||
            match(String(restaurant.cuisine || "").toLowerCase()) ||
            "chef";
  return [
    ...new Set([lead, "editorial", lead === "special" ? "launch" : "special"]),
  ];
}

/* Decoded photos are shared by the preview, thumbnails and exports, and released when idle. */
type Entry = { promise: Promise<ImageBitmap>; users: number; last: number };
const photoCache = new Map<string, Entry>();
async function acquirePhoto(url: string) {
  let entry = photoCache.get(url);
  if (!entry) {
    const promise = fetch(url).then(async (res) => {
      if (!res.ok)
        throw Error("This photo could not be opened. Please try again.");
      return createImageBitmap(await res.blob());
    });
    entry = { promise, users: 0, last: 0 };
    photoCache.set(url, entry);
    promise.catch(() => photoCache.delete(url));
  }
  entry.users++;
  try {
    return await entry.promise;
  } catch (error) {
    entry.users--;
    throw error;
  }
}
let released = 0;
function releasePhoto(url: string) {
  const entry = photoCache.get(url);
  if (!entry) return;
  entry.users = Math.max(0, entry.users - 1);
  entry.last = ++released;
  const idle = [...photoCache]
    .filter(([, e]) => !e.users)
    .sort((a, b) => a[1].last - b[1].last);
  while (idle.length > 4) {
    const [key, e] = idle.shift()!;
    photoCache.delete(key);
    void e.promise.then((b) => b.close?.()).catch(() => {});
  }
}
function describeLogo(im: ImageBitmap): Logo {
  const c = makeCanvas(32, 32),
    ctx = c.getContext("2d")!;
  ctx.drawImage(im, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data;
  let clear = 0,
    lum = 0,
    solid = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) clear++;
    else {
      lum += luminance([d[i], d[i + 1], d[i + 2]]);
      solid++;
    }
  }
  return {
    im,
    transparent: clear > 32 * 32 * 0.08,
    lum: solid ? lum / solid : 0.5,
  };
}

/** Each art direction owns its geometry. Shared primitives keep proofs and exports identical. */
export async function renderComposedPost(
  canvas: HTMLCanvasElement,
  draft: Row,
  restaurant: Row,
  channel = "feed",
  slide = 0,
  options: { scale?: number } = {},
) {
  const t = getPostTemplate(draft.template);
  const { width: W, height: H } = postSize(draft, channel);
  const card = channel === "carousel" ? carouselSlides(draft)[slide] : null;
  const items: Row[] = card?.items || draft.items || [];
  if (!items.length) throw Error("Choose an approved dish photo first.");
  const brandFont =
    draft.typography && draft.typography !== "template"
      ? brandTypeface({ typography: draft.typography }).family
      : null;
  await loadPostFonts([
    "Post Sans",
    ...(designFonts[t.id] || []),
    ...(brandFont ? [brandFont] : []),
  ]);
  const mode = draft.textMode || t.textMode,
    closingSlide = card?.kind === "closing",
    photoOnly = mode === "photo" && !closingSlide,
    showBrand = draft.showBrand ?? t.showBrand;
  const warnings: string[] = [];
  const price =
    draft.showPrice &&
    draft.price !== "" &&
    draft.price != null &&
    (channel !== "carousel" || card?.kind === "cover")
      ? money(Math.round(Number(draft.price) * 100), restaurant.currency)
      : "";
  let detail =
    mode === "full" && channel !== "carousel"
      ? String(draft.description || "")
      : "";
  if (detail.length > 100) {
    warnings.push(
      "The description is too long for the image. Check that your caption includes the details you want to share.",
    );
    detail = "";
  }
  const withFacts = !photoOnly && card?.kind !== "dish";
  const urls = items.map((i) => i.photoUrl || `/api/assets/${i.photoId}`);
  const logoId = restaurant.logo_id || restaurant.logoId;
  const held: string[] = [];
  try {
    const images: ImageBitmap[] = [];
    for (const url of urls) {
      images.push(await acquirePhoto(url));
      held.push(url);
    }
    let logo: Logo | null = null;
    if (logoId && showBrand) {
      const url = `/api/assets/${logoId}`;
      logo = describeLogo(await acquirePhoto(url));
      held.push(url);
    }
    const safe = postSafeArea(W, H, channel);
    const kit = new PostKit(canvas, W, H, options.scale || 1, safe);
    const design: Design = {
      k: kit,
      W,
      H,
      safe,
      format: channel === "story" ? "story" : H > 1350 ? "tall" : "feed",
      slide: card ? (card.kind as Design["slide"]) : "single",
      images,
      analyses: images.map((im) => analyzePhoto(im)),
      framings: items.map(
        (item) =>
          ({
            ...emptyAdjustments,
            fit: false,
            ...draft.layouts?.[channel],
            ...item.layouts?.[channel],
          }) as Framing,
      ),
      names: items.map((i) => i.name || "This photo"),
      headline: photoOnly
        ? ""
        : String(card?.title ?? draft.title ?? items[0].name ?? ""),
      kicker:
        photoOnly || card?.kind === "dish" || closingSlide
          ? ""
          : String(draft.kicker || ""),
      price: withFacts && !closingSlide ? price : "",
      validity: withFacts ? String(draft.validity || "") : "",
      cta: withFacts ? String(draft.cta || "") : "",
      detail: withFacts && !closingSlide ? detail : "",
      itemsLine:
        withFacts &&
        !closingSlide &&
        (items.length > 1 || items.some((i) => (i.quantity || 1) > 1))
          ? items.map((i) => `${i.quantity || 1} × ${i.name}`).join("  ·  ")
          : "",
      photoOnly,
      showBrand,
      brandName: String(restaurant.name || ""),
      logo,
      primary: draft.color || restaurant.style?.primary || t.color,
      accent: draft.accent || restaurant.style?.accent || t.accent,
      family: (fallback) => brandFont || fallback,
      placement:
        draft.textPlacement === "top" || draft.textPlacement === "bottom"
          ? draft.textPlacement
          : "auto",
    };
    await (designs[t.id] || designs.chef)(design);
    kit.flush();
    if (kit.photoBoxes.some((b) => b.height < (items.length > 1 ? 120 : 220)))
      throw Error(
        "There is too much text for this design. Move the description to your caption.",
      );
    if (
      kit.textBoxes.some(
        (b) =>
          b.x < -1 ||
          b.x + b.width > W + 1 ||
          b.y < safe.top - 4 ||
          b.y + b.height > safe.bottom + 4,
      )
    )
      throw Error(
        "Some text is too long to read comfortably in this design. Shorten it or move details to the caption.",
      );
    return {
      renderedText: kit.renderedText,
      textBoxes: kit.textBoxes,
      photoBoxes: kit.photoBoxes,
      warnings: [...new Set([...warnings, ...kit.warnings])],
      template: t.id,
      width: W,
      height: H,
    };
  } finally {
    held.forEach(releasePhoto);
  }
}
