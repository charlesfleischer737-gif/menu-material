import type { DesignedMenu, MenuDesignId, MenuDocument } from "./menu-document";

export type MenuFont = "serif" | "sans" | "display" | "italic";
export type MenuDesignSpec = {
  id: MenuDesignId;
  name: string;
  description: string;
  category: string;
  color: string;
  paper: string;
  heading: MenuFont;
  item: MenuFont;
  architecture:
    | "editorial"
    | "ledger"
    | "poster"
    | "centered"
    | "list"
    | "feature"
    | "street";
  columns: 1 | 2;
  titleSize: number;
  itemSize: number;
  sectionSize: number;
  purposes: MenuDocument["purpose"][];
};
export const menuDesignCollection: MenuDesignSpec[] = [
  {
    id: "bistro",
    name: "The Brasserie",
    description: "Considered type. A timeless table menu.",
    category: "Classic editorial",
    color: "#314e42",
    paper: "#fffef9",
    heading: "serif",
    item: "serif",
    architecture: "editorial",
    columns: 2,
    titleSize: 38,
    itemSize: 14,
    sectionSize: 12,
    purposes: ["dinner", "lunch"],
  },
  {
    id: "cafe",
    name: "Everyday Café",
    description: "A fresh, orderly menu for everyday favorites.",
    category: "Modern café",
    color: "#315848",
    paper: "#ffffff",
    heading: "sans",
    item: "sans",
    architecture: "ledger",
    columns: 2,
    titleSize: 31,
    itemSize: 12.5,
    sectionSize: 16,
    purposes: ["cafe", "brunch", "lunch"],
  },
  {
    id: "casual",
    name: "Corner House",
    description: "Big personality. Beautifully easy to read.",
    category: "Bold neighborhood",
    color: "#993f29",
    paper: "#fffdf7",
    heading: "display",
    item: "sans",
    architecture: "poster",
    columns: 2,
    titleSize: 49,
    itemSize: 12.5,
    sectionSize: 23,
    purposes: ["lunch", "dinner", "brunch"],
  },
  {
    id: "truck",
    name: "Street Kitchen",
    category: "Food truck & counter service",
    description: "Big flavors. Bold type. Prices you can spot at a glance.",
    color: "#32271f",
    paper: "#fffaf0",
    heading: "display",
    item: "display",
    architecture: "street",
    columns: 2,
    titleSize: 53,
    itemSize: 19,
    sectionSize: 19,
    purposes: ["food_truck", "lunch", "specials"],
  },
  {
    id: "fine",
    name: "Atelier",
    description: "Quiet elegance, with room for every detail.",
    category: "Refined dining",
    color: "#4c5146",
    paper: "#fffefb",
    heading: "serif",
    item: "serif",
    architecture: "centered",
    columns: 1,
    titleSize: 35,
    itemSize: 15,
    sectionSize: 11,
    purposes: ["tasting", "dinner"],
  },
  {
    id: "wine",
    name: "The Cellar",
    description: "An elegant list, from the first glass to the last.",
    category: "Bar & wine",
    color: "#5b3344",
    paper: "#fffefd",
    heading: "serif",
    item: "sans",
    architecture: "list",
    columns: 1,
    titleSize: 40,
    itemSize: 13,
    sectionSize: 17,
    purposes: ["drinks"],
  },
  {
    id: "special",
    name: "Of the Season",
    description: "A little space for something special.",
    category: "Seasonal & specials",
    color: "#3f5540",
    paper: "#fffef9",
    heading: "italic",
    item: "serif",
    architecture: "feature",
    columns: 1,
    titleSize: 42,
    itemSize: 17,
    sectionSize: 12,
    purposes: ["specials", "tasting", "brunch"],
  },
];
export const menuFontFamilies: Record<MenuFont, string> = {
  serif: '"Post Serif", Georgia, serif',
  sans: '"Post Sans", Arial, sans-serif',
  display: '"Post Condensed", Impact, sans-serif',
  italic: '"Post Serif Italic", Georgia, serif',
};
export function menuDesignSpec(id: string) {
  return (
    menuDesignCollection.find((s) => s.id === id) || menuDesignCollection[0]
  );
}
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) =>
  rgb(hex)
    .map((v) => {
      const n = v / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    })
    .reduce((v, n, i) => v + n * [0.2126, 0.7152, 0.0722][i], 0);
export function menuContrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function menuTheme(menu: DesignedMenu) {
  const spec = menuDesignSpec(menu.design),
    dark = menu.appearance === "dark";
  const background = dark ? "#18211e" : spec.paper,
    ink = dark ? "#fffdf6" : "#242923",
    muted = dark ? "#d1d7ce" : "#525b51";
  let accent =
    menu.colorMode === "custom"
      ? menu.color
      : menu.colorMode === "signature"
        ? spec.color
        : menu.restaurant.style?.primary || spec.color;
  if (!/^#[0-9a-f]{6}$/i.test(accent)) accent = spec.color;
  for (
    let step = 0;
    menuContrast(accent, background) < 4.5 && step < 15;
    step++
  )
    accent =
      "#" +
      rgb(accent)
        .map((v) =>
          Math.round(dark ? v + (255 - v) * 0.16 : v * 0.84)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
  return {
    background,
    ink,
    muted,
    accent,
    rule: dark ? "#516057" : "#c4cbbf",
    subtle: dark ? "#26362d" : spec.id === "truck" ? "#f8d97c" : "#f0f3ed",
    onAccent: menuContrast(accent, "#ffffff") >= 4.5 ? "#ffffff" : "#152016",
  };
}
export function recommendMenuDesigns(menu: MenuDocument) {
  const count = menu.sections.reduce(
      (n, s) => n + s.items.filter((i) => i.visible).length,
      0,
    ),
    photos = menu.sections.some((s) =>
      s.items.some((i) => i.photoId && i.featured),
    );
  return menuDesignCollection
    .map((s, index) => ({
      spec: s,
      score:
        (s.purposes.includes(menu.purpose) ? 20 : 0) +
        (count > 20 && s.columns === 2 ? 8 : 0) +
        (count < 12 && ["feature", "centered"].includes(s.architecture)
          ? 6
          : 0) +
        (photos && s.id === "casual" ? 4 : 0) -
        index * 0.01,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ spec }) => spec);
}
export function designReason(menu: MenuDocument, id: string) {
  const spec = menuDesignSpec(id);
  if (spec.id === "truck")
    return "Bold section bars, generous dish names, and highlighted prices keep counter-service choices quick to read.";
  if (spec.id === "cafe")
    return "Clear sections and structured prices make sizes easy to compare.";
  if (spec.id === "wine")
    return "An uncluttered list keeps glass, bottle, and tasting prices together.";
  if (spec.id === "fine")
    return "A centered composition gives each course a moment of its own.";
  if (spec.id === "special")
    return "A focused composition makes a short, seasonal menu feel complete.";
  return spec.id === "casual"
    ? "Confident headings and flexible columns suit a lively neighborhood menu."
    : "Balanced columns and classic typography keep a full menu easy to scan.";
}
