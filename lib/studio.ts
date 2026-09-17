import { photoStyles, type PhotoStyle } from "./photo-styles";
export { photoStyles, styleCategories } from "./photo-styles";
export const PIPELINE_VERSION = "studio-2026-09-17-studio-v7";
const legacyLooks = [
  {
    id: "keep",
    name: "Polish my original",
    cue: "Your scene, beautifully lit",
    group: "Recommended",
    image: "/studio/styles/delivery-white.webp",
    prompt:
      "Retain the original setting and all surroundings. Improve natural lighting, neutral color and clarity.",
  },
  {
    id: "white",
    name: "Clean white studio",
    cue: "Soft shadows · fresh & simple",
    group: "Studio",
    image: "/studio/styles/studio-ivory.webp",
    prompt:
      "Natural white seamless studio setting, soft shadows, neutral softbox lighting.",
  },
  {
    id: "cafe",
    name: "Daylight café",
    cue: "Window light · warm oak",
    group: "Restaurant",
    image: "/studio/styles/menu-wood.webp",
    prompt:
      "Warm oak café table, soft natural window light, gentle restaurant background blur.",
  },
  {
    id: "dark",
    name: "Dark & dramatic",
    cue: "Deep charcoal · rich contrast",
    group: "Studio",
    image: "/studio/styles/studio-dark.webp",
    prompt:
      "Charcoal surface, restrained dramatic directional studio light, rich natural contrast.",
  },
  {
    id: "rustic",
    name: "Rustic table",
    cue: "Warm wood · a cozy glow",
    group: "Restaurant",
    image: "/studio/styles/bakery-rustic.webp",
    prompt:
      "Warm dark wood table with cozy soft light, restrained linen in background, no additional food.",
  },
  {
    id: "terrace",
    name: "Resort terrace",
    cue: "Pale stone · open-air light",
    group: "Outdoor",
    image: "/studio/styles/fine-counter.webp",
    prompt:
      "Airy terrace, pale limestone table, gentle outdoor light and soft distant coastal atmosphere.",
  },
  {
    id: "color",
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
export type LookId = string;
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
  uber: {
    label: "Uber Eats item photo",
    short: "Delivery photo",
    width: 1500,
    height: 1000,
    ratio: 3 / 2,
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
export const deliveryProfiles = {
  doordash: {
    version: "2026-09-16",
    verified: "2026-09-16",
    source:
      "https://help.doordash.com/en-us/merchants/article/common-photo-issues-explained",
    minWidth: 1400,
    minHeight: 800,
    maxBytes: 16 * 1024 * 1024,
  },
  uber: {
    version: "2026-09-15",
    verified: "2026-09-15",
    source:
      "https://help.uber.com/merchants-and-restaurants/article/merchant-submitted-menu-catalog-photo-guidelines?nodeId=6985355b-0426-4523-94f2-89bb9b0566e9",
    minWidth: 550,
    minHeight: 440,
    maxBytes: 10 * 1024 * 1024,
  },
};
export const catalogProfiles = {
  ...deliveryProfiles,
  toast: {
    version: "2026-09-16",
    verified: "2026-09-16",
    source:
      "https://support.toasttab.com/en/article/Adding-Images-to-Menu-Items-in-the-Menu?lang=en_US",
    minWidth: 750,
    minHeight: 450,
    maxBytes: 5 * 1024 * 1024,
  },
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
