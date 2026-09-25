import { photoStyles, type PhotoStyle } from "./photo-styles";
import { channelRules, type ChannelRule } from "./channel-rules";
export { photoStyles, styleCategories } from "./photo-styles";
export const PIPELINE_VERSION = "studio-2026-09-24-direct-v8";
const legacyLooks = [
  {
    id: "keep",
    backdrop: "natural",
    name: "Polish my original",
    cue: "Your scene, beautifully lit",
    group: "Recommended",
    image: "/studio/styles/delivery-white.webp",
    prompt:
      "Retain the original setting and all surroundings. Improve natural lighting, neutral color and clarity.",
  },
  {
    id: "white",
    backdrop: "white",
    name: "Clean white studio",
    cue: "Soft shadows · fresh & simple",
    group: "Studio",
    image: "/studio/styles/studio-ivory.webp",
    prompt:
      "Natural white seamless studio setting, soft shadows, neutral softbox lighting.",
  },
  {
    id: "cafe",
    backdrop: "natural",
    name: "Daylight café",
    cue: "Window light · warm oak",
    group: "Restaurant",
    image: "/studio/styles/menu-wood.webp",
    prompt:
      "Warm oak café table, soft natural window light, gentle restaurant background blur.",
  },
  {
    id: "dark",
    backdrop: "dark",
    name: "Dark & dramatic",
    cue: "Deep charcoal · rich contrast",
    group: "Studio",
    image: "/studio/styles/studio-dark.webp",
    prompt:
      "Charcoal surface, restrained dramatic directional studio light, rich natural contrast.",
  },
  {
    id: "rustic",
    backdrop: "natural",
    name: "Rustic table",
    cue: "Warm wood · a cozy glow",
    group: "Restaurant",
    image: "/studio/styles/bakery-rustic.webp",
    prompt:
      "Warm dark wood table with cozy soft light, restrained linen in background, no additional food.",
  },
  {
    id: "terrace",
    backdrop: "natural",
    name: "Resort terrace",
    cue: "Pale stone · open-air light",
    group: "Outdoor",
    image: "/studio/styles/fine-counter.webp",
    prompt:
      "Airy terrace, pale limestone table, gentle outdoor light and soft distant coastal atmosphere.",
  },
  {
    id: "color",
    backdrop: "colorful",
    name: "Bold brand color",
    cue: "A clean setting in your colors",
    group: "Studio",
    image: "/studio/styles/studio-color.webp",
    prompt:
      "Simple matte seamless studio setting using the restaurant primary brand color, clean natural soft shadows.",
  },
  {
    id: "restaurant",
    name: "My restaurant look",
    cue: "Your familiar signature style",
    group: "My looks",
    image: "/studio/styles/menu-wood.webp",
    prompt: "",
  },
  {
    id: "reference",
    backdrop: "natural",
    name: "Your inspiration",
    cue: "Bring a look you love",
    group: "My looks",
    image: "/studio/styles/bakery-rustic.webp",
    prompt:
      "Match the lighting, surface and mood of the style reference. The original dish alone supplies the food.",
  },
] as const;
export const looks: PhotoStyle[] = [
  ...photoStyles,
  ...legacyLooks.map((l) => ({
    ...l,
    legacy: !["keep", "restaurant", "reference"].includes(l.id),
  })),
];
export function resolvePhotoLook(
  brief: Record<string, any>,
): PhotoStyle | null {
  const known = looks.find((look) => look.id === brief.look);
  if (known) return known;
  if (
    typeof brief.photoStyleSnapshot === "string" &&
    brief.photoStyleSnapshot.trim()
  )
    return {
      id: brief.look || "captured-look",
      name: brief.savedLookName || "Your saved look",
      cue: "Your saved setting and light",
      group: "Saved",
      image: brief.photoReferenceIds?.[0]
        ? `/api/assets/${brief.photoReferenceIds[0]}`
        : "",
      prompt: brief.photoStyleSnapshot,
    };
  return null;
}
export const unavailablePhotoLook: PhotoStyle = {
  id: "unavailable",
  name: "Look unavailable",
  cue: "Choose another look to continue",
  group: "Saved",
  image: "",
  prompt: "",
};
export const formats = {
  toast: {
    label: "Toast item photo",
    short: "Toast photo",
    width: 1500,
    height: 900,
    ratio: 5 / 3,
  },
  menu: {
    label: "Menu & website",
    short: "Menu photo",
    width: 1536,
    height: 1536,
    ratio: 1,
  },
  feed: {
    label: "Instagram post",
    short: "Portrait post",
    width: 1080,
    height: 1350,
    ratio: 4 / 5,
  },
  story: {
    label: "Instagram Story",
    short: "Story",
    width: 1080,
    height: 1920,
    ratio: 9 / 16,
  },
  doordash: {
    label: "DoorDash item photo",
    short: "Delivery photo",
    width: 1920,
    height: 1080,
    ratio: 16 / 9,
  },
  // Uber Eats accepts 5:4 to 6:4 and shows photos best at 2880 × 2304 (5:4).
  // 3:2 sat on the edge of that range; exports never enlarge past what the
  // photo supports (lib/photo-export.ts).
  uber: {
    label: "Uber Eats item photo",
    short: "Delivery photo",
    width: 2880,
    height: 2304,
    ratio: 5 / 4,
  },
  print: {
    label: "Print photo",
    short: "Print photo",
    width: 2048,
    height: 2048,
    ratio: 1,
  },
} as const;
export type PhotoFormat = keyof typeof formats;
// Catalog export limits come from the channel rules (lib/channel-rules.ts).
function catalogProfile(rule: ChannelRule) {
  return {
    version: rule.verified,
    verified: rule.verified,
    source: rule.sources[rule.sources.length - 1],
    minWidth: rule.minWidth,
    minHeight: rule.minHeight,
    maxBytes: rule.maxBytes ?? Infinity,
  };
}
export const catalogProfiles = {
  doordash: catalogProfile(channelRules.doordash),
  uber: catalogProfile(channelRules.uber),
  toast: catalogProfile(channelRules.toast),
};
// A real phone photo of a burger (credited on the homepage) for trying the
// studio without one of your own. It is always labeled as a sample.
export const samplePhoto = {
  url: "/burger-phone-original.jpg",
  file: "sample-burger.jpg",
  name: "Sample burger",
};
export const emptyAdjustments = {
  x: 50,
  y: 50,
  zoom: 1,
  rotate: 0,
  brightness: 100,
  contrast: 100,
  warmth: 0,
  fit: true,
};
export type Adjustments = typeof emptyAdjustments;
const divisor = (a: number, b: number): number => (b ? divisor(b, a % b) : a);
/**
 * The size of a saved quick adjustment: the format's exact shape, at most
 * `longest` pixels on its long side and never larger than the photo's own
 * pixels in the frame. Enlarging adds no detail, and later downloads trust
 * these pixels, so an enlarged crop could pass a delivery app's minimum size.
 * `source` is the photo's size after any rotation.
 */
export function adjustedPhotoSize(
  format: PhotoFormat,
  source: { width: number; height: number },
  edits: { fit?: boolean; zoom?: number } = {},
  longest = 2048,
) {
  const shape = formats[format] || formats.menu,
    unit = divisor(shape.width, shape.height),
    across = shape.width / unit,
    down = shape.height / unit;
  // Photo pixels per unit of the shape at full scale: filling the frame
  // crops to the tighter side, fitting keeps the whole photo inside it.
  const pixels =
    (edits.fit ? Math.max : Math.min)(
      source.width / across,
      source.height / down,
    ) / Math.max(1, edits.zoom || 1);
  const k = Math.max(
    1,
    Math.floor(Math.min(pixels, longest / Math.max(across, down)) + 1e-9),
  );
  return { width: across * k, height: down * k };
}
export const foodFamilies = [
  "Plated mains",
  "Burgers & sandwiches",
  "Pizza",
  "Bowls & salads",
  "Desserts",
  "Drinks",
  "Takeout",
];
export function photoBrief(destination = "menu") {
  return {
    step: 1,
    dishId: "",
    sourceId: "",
    jobId: "",
    resultId: "",
    name: "",
    description: "",
    family: "Plated mains",
    recommendationFamily: "",
    recommendationDrink: "other",
    analysisSourceId: "",
    analysisStatus: "none",
    analysisSubject: "",
    styleChosen: true,
    mode: "photo",
    destination,
    format:
      destination === "social"
        ? "feed"
        : destination === "delivery"
          ? "doordash"
          : destination === "print"
            ? "print"
            : "menu",
    look: "keep",
    lookCategory: destination === "delivery" ? "delivery" : "menu",
    surface: "As shown",
    lighting: "As shown",
    plate: "keep",
    angle: "keep",
    composition: "Full dish",
    note: "",
    referenceId: "",
    requestKey: "",
    savedLook: false,
    photoStyleSnapshot: null,
    photoReferenceIds: null,
    adjustments: { ...emptyAdjustments },
  };
}
export function styleFor(
  brief: Record<string, any>,
  restaurant: Record<string, any>,
) {
  const base = restaurant.style || {};
  const look = resolvePhotoLook(brief);
  if (!look)
    throw new Error(
      "This saved look is unavailable. Choose another look before creating a photo.",
    );
  const prompt =
    brief.angle === "keep" && look.angle === "overhead"
      ? look.prompt.replace(
          "Straight overhead",
          "Preserve the original angle in this",
        )
      : look.prompt;
  return {
    ...base,
    photoStyle:
      brief.photoStyleSnapshot ??
      (look.id === "restaurant"
        ? base.photoStyle
        : prompt +
          (look.id === "color"
            ? ` Background color: ${base.primary || "#235b48"}.`
            : "")),
    referenceIds:
      brief.photoReferenceIds ??
      (brief.look === "reference"
        ? [brief.referenceId].filter(Boolean)
        : brief.look === "restaurant"
          ? base.referenceIds || []
          : []),
  };
}
/**
 * The dish Photo Studio saves for a photo: a new, confirmed dish, or nothing
 * when the photo already belongs to one. My Dishes owns an existing dish's
 * name and description, and live menus follow them, so the studio never
 * rewrites them. `fresh` starts a new dish, so a sample and a real photo never
 * share one.
 */
export function studioDishRequest(
  brief: Parameters<typeof styleFor>[0],
  restaurant: Parameters<typeof styleFor>[1],
  fresh?: { name: string; sample?: boolean },
) {
  if (!fresh && brief.dishId) return null;
  return {
    name:
      String(fresh ? fresh.name : brief.name || "").trim() || "Untitled dish",
    description: fresh ? "" : String(brief.description || ""),
    confirmed: true,
    // Sample dishes stay out of guest menus.
    ...(fresh?.sample ? { sample: true } : {}),
    setting: resolvePhotoLook(brief)
      ? styleFor(brief, restaurant).photoStyle
      : "",
  };
}
