// Public plan terms shared by pricing copy, Stripe validation, and credit grants.
export const PRO_PLAN = {
  amountCents: 900,
  currency: "usd",
  interval: "month",
  intervalCount: 1,
  imagesPerPeriod: 50,
} as const;

export const PRO_PRICE_LABEL = `$${PRO_PLAN.amountCents / 100}`;

// Every new public account gets these images once. No card, no expiry.
export const FREE_SIGNUP_IMAGES = 5;

// What Free keeps. Server checks, Pro badges and pricing copy all read these.
export const FREE_LIVE_MENUS = 1;
export const FREE_MENU_DESIGN = {
  design: "bistro",
  appearance: "light",
} as const;
// Typography only, or photos on the dishes the owner features. A photo for
// every dish is Pro.
export const FREE_MENU_LAYOUTS: readonly string[] = ["classic", "featured"];
export const FREE_POST_TEMPLATES: readonly string[] = [
  "editorial",
  "chef",
  "special",
];

/** A menu Free can publish: the basic design, without custom colors. */
export function freeMenuDesign(menu: {
  design?: string;
  layout?: string;
  appearance?: string;
  colorMode?: string;
}) {
  return (
    (menu.design ?? FREE_MENU_DESIGN.design) === FREE_MENU_DESIGN.design &&
    FREE_MENU_LAYOUTS.includes(menu.layout ?? "classic") &&
    (menu.appearance ?? FREE_MENU_DESIGN.appearance) ===
      FREE_MENU_DESIGN.appearance &&
    menu.colorMode !== "custom"
  );
}

// Each Pro feature: what the upgrade sheet promises and what a blocked
// request says. Titles also list Pro's features on the pricing page.
export const proFeatures = {
  look: {
    title: "Your restaurant look everywhere",
    detail:
      "Your colors, fonts and photo style on every photo, post, menu and table card.",
    blocked: "Using your restaurant look is part of Pro.",
  },
  savedLooks: {
    title: "Saved looks and inspiration photos",
    detail:
      "Keep up to 100 photo looks and match new photos to shots you love.",
    blocked: "Saved looks and inspiration photos are part of Pro.",
  },
  batches: {
    title: "Your whole menu at once",
    detail: "Give up to 8 dishes the same look in one batch.",
    blocked: "Photographing several dishes at once is part of Pro.",
  },
  menus: {
    title: "Up to 30 live menus",
    detail: "Lunch, dinner, drinks and more, each with its own QR code.",
    blocked: "Free includes one live menu. More live menus are part of Pro.",
  },
  menuDesigns: {
    title: "Every menu design",
    detail:
      "All 10 designs, a photo for every dish, dark mode and your own colors.",
    blocked:
      "This menu design is part of Pro. Free menus use The Brasserie design.",
  },
  postTemplates: {
    title: "Every post template",
    detail:
      "All 10 templates, carousels, multi-dish offers and your colors and fonts.",
    blocked: "This post design is part of Pro.",
  },
  campaigns: {
    title: "Campaigns",
    detail:
      "A matching post, Story, counter sign and menu special for a dish, scheduled ahead.",
    blocked: "Campaigns are part of Pro.",
  },
  downloads: {
    title: "Download everything at once",
    detail:
      "Photo packs for every delivery and social size, and ZIPs of any selection.",
    blocked: "Photo packs and ZIP downloads are part of Pro.",
  },
  staffLinks: {
    title: "Staff photo links",
    detail: "Share an upload link with your team. You approve every photo.",
    blocked: "Staff photo links are part of Pro.",
  },
  insights: {
    title: "Menu insights",
    detail:
      "Clicks to order, call and get directions, QR placements and the dishes guests look at.",
    blocked: "Detailed menu insights are part of Pro.",
  },
  menuCredit: {
    title: "No “Made with Menu Material”",
    detail: "Your guest menus show only your restaurant.",
    blocked: "Removing “Made with Menu Material” is part of Pro.",
  },
} as const;
export type ProFeature = keyof typeof proFeatures;
export const isProFeature = (value: unknown): value is ProFeature =>
  typeof value === "string" && Object.hasOwn(proFeatures, value);
