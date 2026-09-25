import type { Row } from "./client";
import { postHeadline } from "./post-flow";

/** Original compositions informed by restaurant feeds; reference imagery is never used in exports. */
export const postTemplates = [
  {
    id: "editorial",
    name: "Just the dish",
    group: "Photo first",
    headline: "",
    description:
      "An uninterrupted photograph. Let the food do the talking, with the story in your caption.",
    layout: "editorial",
    color: "#242922",
    accent: "#fffdf5",
    kicker: "",
    cta: "",
    textMode: "photo",
    showBrand: false,
    example: "/studio/styles/menu-stone.webp",
  },
  {
    id: "special",
    name: "The daily special",
    group: "Announcements",
    headline: "",
    description:
      "Cinematic light, an elegant headline, and a discreet metallic price detail over your food photograph.",
    layout: "special",
    color: "#c42d23",
    accent: "#fff3d8",
    kicker: "",
    cta: "",
    textMode: "full",
    showBrand: true,
    example: "/studio/styles/menu-wood.webp",
  },
  {
    id: "launch",
    name: "Menu drop",
    group: "Announcements",
    headline: "",
    description:
      "Oversized type and a full-frame photograph for a dish worth announcing.",
    layout: "launch",
    color: "#e24725",
    accent: "#fff8db",
    kicker: "ON THE MENU",
    cta: "",
    textMode: "minimal",
    showBrand: false,
    example: "/studio/styles/studio-color.webp",
  },
  {
    id: "afterdark",
    name: "The nightcap",
    group: "After hours",
    headline: "",
    description:
      "A cinematic drink portrait with a single elegant line. Made for the evening scroll.",
    layout: "afterdark",
    color: "#17130f",
    accent: "#f4e6c9",
    kicker: "",
    cta: "",
    textMode: "minimal",
    showBrand: true,
    example: "/studio/styles/bar-velvet.webp",
  },
  {
    id: "brunch",
    name: "Slow mornings",
    group: "Photo first",
    headline: "",
    description:
      "Botanical paper, soft morning light, and an offset photograph with expressive italic type.",
    layout: "brunch",
    color: "#43352c",
    accent: "#fff6de",
    kicker: "",
    cta: "",
    textMode: "minimal",
    showBrand: false,
    example: "/studio/styles/menu-overhead.webp",
  },
  {
    id: "bakery",
    name: "The morning bake",
    group: "Photo first",
    headline: "",
    description:
      "Sunlit photography blends into textured paper, with an elegant italic signature.",
    layout: "bakery",
    color: "#704126",
    accent: "#fff9e9",
    kicker: "",
    cta: "",
    textMode: "minimal",
    showBrand: true,
    example: "/studio/styles/bakery-morning.webp",
  },
  {
    id: "event",
    name: "Supper club",
    group: "Announcements",
    headline: "",
    description:
      "A copper-lit invitation with an arched photograph, expressive serif type, and a clear reservation date.",
    layout: "event",
    color: "#291b1d",
    accent: "#fff0d1",
    kicker: "",
    cta: "",
    textMode: "full",
    showBrand: true,
    example: "/studio/styles/fine-candle.webp",
  },
  {
    id: "fresh",
    name: "In season",
    group: "Photo first",
    headline: "",
    description:
      "Restrained typography tucked into the corner of a generous ingredient-led photograph.",
    layout: "fresh",
    color: "#253c27",
    accent: "#ffffff",
    kicker: "",
    cta: "",
    textMode: "minimal",
    showBrand: false,
    example: "/studio/styles/beverage-matcha.webp",
  },
  {
    id: "combo",
    name: "A table for two",
    group: "Announcements",
    headline: "",
    description:
      "An edge-to-edge photo pairing with confident type. Your real dishes, quantities, and offer stay together.",
    layout: "combo",
    color: "#b72e23",
    accent: "#fff4df",
    kicker: "",
    cta: "",
    textMode: "full",
    showBrand: true,
    example: "/studio/styles/delivery-daylight.webp",
  },
  {
    id: "chef",
    name: "From the pass",
    group: "Photo first",
    headline: "",
    description:
      "A quiet fine-dining editorial: generous photography, delicate typography, and a small restaurant signature.",
    layout: "chef",
    color: "#282820",
    accent: "#fffbee",
    kicker: "",
    cta: "",
    textMode: "minimal",
    showBrand: true,
    example: "/studio/styles/fine-counter.webp",
  },
] as const;
export function getPostTemplate(id: string) {
  const aliases: Record<string, string> = {
    photo: "editorial",
    price: "special",
    story: "chef",
  };
  return (
    postTemplates.find((t) => t.id === (aliases[id] || id)) || postTemplates[0]
  );
}
const retiredHeadlines = [
  "Love at first bite.",
  "A taste of something special.",
  "Meet your new favorite.",
  "Stay a little longer.",
  "Good food. Good company.",
  "Made for a little joy.",
  "Save your seat.",
  "Fresh looks good on you.",
  "Better, together.",
  "A little craft. A lot of flavor.",
];
export function applyPostTemplate(draft: Row, id: string) {
  const t = getPostTemplate(id);
  return {
    template: t.id,
    ...(!draft.title || retiredHeadlines.includes(draft.title)
      ? { title: postHeadline(draft.items || []) }
      : {}),
    color: draft.brandMode === "restaurant" ? draft.color : t.color,
    accent: draft.brandMode === "restaurant" ? draft.accent : t.accent,
    ...(draft.brandMode === "restaurant" ? { brandMode: "restaurant" } : {}),
    kicker: t.kicker,
    cta: t.cta,
    textMode: t.textMode,
    showBrand: t.showBrand,
    textY: 0,
    typography: "template",
    layouts: Object.fromEntries(
      ["feed", "story", "carousel"].map((c) => [
        c,
        {
          ...(draft.layouts?.[c] || {
            x: 50,
            y: 50,
            zoom: 1,
            rotate: 0,
            brightness: 100,
            contrast: 100,
            warmth: 0,
          }),
          fit: false,
        },
      ]),
    ),
  };
}
export function postTemplateExample(id: string) {
  const t = getPostTemplate(id);
  const examples: Record<
    string,
    {
      name: string;
      title: string;
      brand: string;
      price?: string;
      validity?: string;
      description?: string;
    }
  > = {
    editorial: {
      name: "Burrata & heirloom tomatoes",
      title: "Burrata & heirloom tomatoes",
      brand: "FIELD & VINE",
    },
    special: {
      name: "Roast chicken",
      title: "Sunday roast.",
      brand: "THE CORNER",
      price: "24",
      validity: "Sundays · from noon",
    },
    launch: {
      name: "Crispy mushroom bao",
      title: "Bao.\nNow.",
      brand: "LITTLE STEAM",
    },
    afterdark: {
      name: "Dry martini",
      title: "One more?",
      brand: "BELLINI",
      validity: "At the bar, from 5",
    },
    brunch: {
      name: "Skillet shakshuka",
      title: "Take it slow.",
      brand: "SUNDAY CLUB",
      validity: "Weekend brunch · 9—2",
    },
    bakery: {
      name: "Butter croissant",
      title: "Morning,\nbeautiful.",
      brand: "FLOUR HOUSE",
    },
    event: {
      name: "Chef’s evening menu",
      title: "An evening\nat our table.",
      brand: "MAISON",
      validity: "Friday 25 September · 7 pm",
      description: "A seasonal dinner with the chef",
    },
    fresh: {
      name: "Iced matcha",
      title: "A little green.",
      brand: "MATCHA ROOM",
    },
    combo: {
      name: "Carnitas taco",
      title: "Good things\ncome in threes.",
      brand: "MESA",
      price: "15",
      validity: "At the taqueria",
    },
    chef: { name: "Tuna tartare", title: "Tuna tartare.", brand: "ATELIER" },
  };
  const e = examples[t.id];
  return {
    ...applyPostTemplate({ title: e.title }, t.id),
    title: e.title,
    restaurantName: e.brand,
    items: [
      { name: e.name, quantity: t.id === "combo" ? 3 : 1, photoUrl: t.example },
    ],
    price: e.price || "",
    showPrice: !!e.price,
    validity: e.validity || "",
    description: e.description || "",
  };
}
