import type { Row } from "./client";
export const postTemplates = [
  {
    id: "editorial",
    headline: "Love at first bite.",
    name: "Signature cover",
    group: "Everyday",
    description:
      "A full-bleed photograph with magazine typography and a quiet brand signature.",
    layout: "editorial",
    color: "#192e27",
    accent: "#f5eee0",
    kicker: "YOUR NEXT FAVORITE",
    cta: "Discover the menu",
    example: "/studio/styles/delivery-white.webp",
  },
  {
    id: "special",
    headline: "A taste of something special.",
    name: "Special spotlight",
    group: "Offers",
    description:
      "A bold offer poster with a hero photo, oversized headline and a price seal.",
    layout: "special",
    color: "#be3c26",
    accent: "#fff0ce",
    kicker: "TODAY’S SPECIAL",
    cta: "Come hungry",
    example: "/studio/styles/menu-wood.webp",
  },
  {
    id: "launch",
    headline: "Meet your new favorite.",
    name: "New on the menu",
    group: "Launches",
    description:
      "A graphic launch announcement with a shaped photo and confident headline.",
    layout: "launch",
    color: "#315744",
    accent: "#dcf3a2",
    kicker: "NEW ON THE MENU",
    cta: "Meet your new favorite",
    example: "/studio/styles/studio-color.webp",
  },
  {
    id: "afterdark",
    headline: "Stay a little longer.",
    name: "After hours",
    group: "After dark",
    description:
      "Cinematic full-frame photography, gold details and elegant evening typography.",
    layout: "afterdark",
    color: "#171a27",
    accent: "#e4bf7c",
    kicker: "AFTER HOURS",
    cta: "Make it a night",
    example: "/studio/styles/bar-speakeasy.webp",
  },
  {
    id: "brunch",
    headline: "Good food. Good company.",
    name: "Weekend table",
    group: "Everyday",
    description:
      "A bright café poster with an arched photograph and playful oversized type.",
    layout: "brunch",
    color: "#a33135",
    accent: "#ffe6dc",
    kicker: "AT OUR TABLE",
    cta: "Make a date of it",
    example: "/studio/styles/menu-overhead.webp",
  },
  {
    id: "bakery",
    headline: "Made for a little joy.",
    name: "From the kitchen",
    group: "Launches",
    description:
      "A framed editorial photo with a warm paper background and handwritten-style accent.",
    layout: "bakery",
    color: "#603e28",
    accent: "#f2dfba",
    kicker: "FROM OUR KITCHEN",
    cta: "Find your favorite",
    example: "/studio/styles/bakery-morning.webp",
  },
  {
    id: "event",
    headline: "Save your seat.",
    name: "The invitation",
    group: "Events",
    description:
      "An elegant event invitation with a ticket layout, clear date and a featured photo.",
    layout: "event",
    color: "#4b3260",
    accent: "#eee0f2",
    kicker: "YOU’RE INVITED",
    cta: "Join us",
    example: "/studio/styles/fine-candle.webp",
  },
  {
    id: "fresh",
    headline: "Fresh looks good on you.",
    name: "Fresh perspective",
    group: "Everyday",
    description:
      "A crisp split composition with fresh color and generous, readable typography.",
    layout: "fresh",
    color: "#1c614d",
    accent: "#e5efb8",
    kicker: "SOMETHING GOOD",
    cta: "Explore the menu",
    example: "/studio/styles/menu-stone.webp",
  },
  {
    id: "combo",
    headline: "Better, together.",
    name: "Better together",
    group: "Offers",
    description:
      "A coordinated photo collage for a real meal deal or pairing, with quantities included.",
    layout: "combo",
    color: "#e45b2b",
    accent: "#fff0ca",
    kicker: "BETTER TOGETHER",
    cta: "Bring your appetite",
    example: "/studio/styles/delivery-daylight.webp",
  },
  {
    id: "chef",
    headline: "A little craft. A lot of flavor.",
    name: "Chef’s edit",
    group: "Everyday",
    description:
      "A refined restaurant editorial with a tall image, restrained copy and a numbered accent.",
    layout: "chef",
    color: "#332b25",
    accent: "#f0e8d9",
    kicker: "FROM THE PASS",
    cta: "Taste what’s cooking",
    example: "/studio/styles/fine-counter.webp",
  },
] as const;
export const postTemplateGroups = [
  "All designs",
  "Everyday",
  "Offers",
  "Launches",
  "After dark",
  "Events",
];
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
export function applyPostTemplate(draft: Row, id: string) {
  const t = getPostTemplate(id);
  return {
    template: t.id,
    ...(!draft.title ||
    draft.title === draft.items?.[0]?.name ||
    postTemplates.some((p) => p.headline === draft.title)
      ? { title: t.headline }
      : {}),
    color: t.color,
    accent: t.accent,
    kicker: t.kicker,
    cta: t.cta,
    textY: 0,
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
          fit: true,
        },
      ]),
    ),
  };
}

export function postTemplateExample(id: string) {
  const template = getPostTemplate(id);
  const examples: Record<string, [string, string, string]> = {
    editorial: ["The house burger", "", ""],
    special: ["Sunday roast chicken", "24", "Sundays · from noon"],
    launch: ["Crispy mushroom bao", "", "Meet the latest addition"],
    afterdark: ["The classic Old Fashioned", "16", "Cocktails at the bar"],
    brunch: ["Skillet shakshuka", "18", "Saturday & Sunday · 9–2"],
    bakery: ["Butter croissant", "5", "From the pastry counter"],
    event: ["Chef’s evening menu", "", "Friday, September 25 · 7 pm"],
    fresh: ["Burrata & heirloom tomatoes", "", "On the seasonal menu"],
    combo: ["Carnitas tacos", "15", "Three tacos, one good idea"],
    chef: ["Tuna tartare", "", "From our kitchen to your table"],
  };
  const [name, price, validity] = examples[template.id];
  return {
    ...applyPostTemplate({ title: "", layouts: {} }, template.id),
    items: [
      {
        name,
        quantity: template.id === "combo" ? 3 : 1,
        photoUrl: template.example,
      },
    ],
    price,
    showPrice: !!price,
    validity,
    description: "",
  };
}
