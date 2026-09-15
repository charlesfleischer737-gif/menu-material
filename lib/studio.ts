export const PIPELINE_VERSION = "studio-2026-09-15-v1";
export const looks = [
  {
    id: "keep",
    name: "Keep my setting",
    cue: "Your scene, beautifully lit",
    group: "Recommended",
    image: "/homepage/burger-enhanced.webp",
    prompt:
      "Retain the original setting and all surroundings. Improve natural lighting, neutral color and clarity.",
  },
  {
    id: "white",
    name: "Clean white studio",
    cue: "Soft shadows · fresh & simple",
    group: "Studio",
    image: "/studio/clean-white.webp",
    prompt:
      "Natural white seamless studio setting, soft shadows, neutral softbox lighting.",
  },
  {
    id: "cafe",
    name: "Daylight café",
    cue: "Window light · warm oak",
    group: "Restaurant",
    image: "/studio/daylight-cafe.webp",
    prompt:
      "Warm oak café table, soft natural window light, gentle restaurant background blur.",
  },
  {
    id: "dark",
    name: "Dark & dramatic",
    cue: "Deep charcoal · rich contrast",
    group: "Studio",
    image: "/studio/dark-dramatic.webp",
    prompt:
      "Charcoal surface, restrained dramatic directional studio light, rich natural contrast.",
  },
  {
    id: "rustic",
    name: "Rustic table",
    cue: "Warm wood · a cozy glow",
    group: "Restaurant",
    image: "/studio/rustic-table.webp",
    prompt:
      "Warm dark wood table with cozy soft light, restrained linen in background, no additional food.",
  },
  {
    id: "terrace",
    name: "Resort terrace",
    cue: "Pale stone · open-air light",
    group: "Outdoor",
    image: "/studio/resort-terrace.webp",
    prompt:
      "Airy terrace, pale limestone table, gentle outdoor light and soft distant coastal atmosphere.",
  },
  {
    id: "color",
    name: "Bold brand color",
    cue: "A clean setting in your colors",
    group: "Studio",
    image: "/studio/bold-color.webp",
    prompt:
      "Simple matte seamless studio setting using the restaurant primary brand color, clean natural soft shadows.",
  },
  {
    id: "restaurant",
    name: "My restaurant look",
    cue: "Your familiar signature style",
    group: "My looks",
    image: "/studio/daylight-cafe.webp",
    prompt: "",
  },
  {
    id: "reference",
    name: "Match this photo",
    cue: "Bring a look you love",
    group: "My looks",
    image: "/studio/rustic-table.webp",
    prompt:
      "Match the lighting, surface and mood of the style reference. The original dish alone supplies the food.",
  },
] as const;
export type LookId = (typeof looks)[number]["id"];
export const formats = {
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
    version: "2026-09-15",
    verified: "2026-09-15",
    source:
      "https://help.doordash.com/en-us/merchants/article/common-photo-issues-explained",
    minWidth: 1400,
    minHeight: 800,
    maxBytes: 2 * 1024 * 1024,
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
    look: "cafe",
    surface: "As shown",
    lighting: "As shown",
    plate: "keep",
    angle: "keep",
    composition: "Full dish",
    note: "",
    referenceId: "",
    requestKey: "",
    savedLook: false,
    adjustments: { ...emptyAdjustments },
  };
}
export function styleFor(
  brief: Record<string, any>,
  restaurant: Record<string, any>,
) {
  const base = restaurant.style || {};
  const look = looks.find((l) => l.id === brief.look) || looks[2];
  return {
    ...base,
    photoStyle:
      look.id === "restaurant"
        ? base.photoStyle
        : look.prompt +
          (look.id === "color"
            ? ` Background color: ${base.primary || "#235b48"}.`
            : ""),
    referenceIds:
      brief.look === "reference"
        ? [brief.referenceId].filter(Boolean)
        : brief.look === "restaurant"
          ? base.referenceIds || []
          : [],
  };
}
