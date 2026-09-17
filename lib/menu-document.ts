import { z } from "zod";
import type { Row } from "./client";

export const menuDesignIds = [
  "bistro",
  "cafe",
  "casual",
  "truck",
  "fine",
  "wine",
  "special",
] as const;
export const menuPurposeIds = [
  "dinner",
  "lunch",
  "brunch",
  "cafe",
  "drinks",
  "specials",
  "tasting",
  "food_truck",
] as const;
const shortText = z.string().trim().max(120);
const price = z.number().int().min(0).max(100000000);
const priceOption = z.object({
  id: z.string().max(100),
  label: shortText,
  price,
});
export const menuEntrySchema = z.object({
  id: z.string().min(1).max(100),
  dishId: z.string().uuid().nullable().default(null),
  name: shortText,
  description: z.string().max(2000).default(""),
  price: price.nullable().default(null),
  priceMode: z
    .enum(["single", "variants", "label", "included"])
    .default("single"),
  priceLabel: z.string().max(60).default(""),
  variants: z.array(priceOption).max(12).default([]),
  additions: z.array(priceOption).max(12).default([]),
  dietary: z.array(z.string().trim().max(40)).max(8).default([]),
  available: z.boolean().default(true),
  visible: z.boolean().default(true),
  photoId: z.string().uuid().nullable().default(null),
  featured: z.boolean().default(false),
  crop: z
    .object({
      fit: z.boolean().default(true),
      x: z.number().min(0).max(100).default(50),
      y: z.number().min(0).max(100).default(50),
      zoom: z.number().min(1).max(2).default(1),
    })
    .default({}),
  sourceReviewed: z.boolean().default(true),
  sourceUncertain: z
    .array(z.enum(["name", "description", "category", "price"]))
    .max(4)
    .default([]),
});
export const menuSectionSchema = z.object({
  id: z.string().min(1).max(100),
  name: shortText,
  description: z.string().max(600).default(""),
  pageBreakBefore: z.boolean().default(false),
  items: z.array(menuEntrySchema).max(100),
});
export const menuDocumentSchema = z.object({
  version: z.literal(2).default(2),
  name: shortText.default("Dinner menu"),
  title: shortText.default("Dinner"),
  subtitle: z.string().max(240).default(""),
  purpose: z.enum(menuPurposeIds).default("dinner"),
  language: z
    .string()
    .max(35)
    .refine((value) => {
      try {
        return Intl.getCanonicalLocales(value).length === 1;
      } catch {
        return false;
      }
    }, "Choose a valid language, such as en, es, or fr.")
    .default("en"),
  importSourceId: z.string().uuid().nullable().default(null),
  importSourceText: z.string().max(60000).default(""),
  footer: z.string().max(1500).default(""),
  fixedPrice: price.nullable().default(null),
  fixedPriceLabel: z.string().max(100).default("per person"),
  design: z.enum(menuDesignIds).default("bistro"),
  density: z
    .enum(["compact", "comfortable", "spacious"])
    .default("comfortable"),
  appearance: z.enum(["light", "dark"]).default("light"),
  colorMode: z
    .enum(["restaurant", "signature", "custom"])
    .default("restaurant"),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#29483b"),
  layout: z.enum(["classic", "featured", "grid"]).default("classic"),
  paper: z.enum(["letter", "a4"]).default("letter"),
  printProfile: z.enum(["home", "press"]).default("home"),
  pageTarget: z.number().int().min(0).max(2).default(0),
  columns: z.number().int().min(0).max(2).default(0),
  priceFormat: z.enum(["currency", "numbers", "whole"]).default("currency"),
  showLogo: z.boolean().default(true),
  showUnavailable: z.boolean().default(true),
  sections: z.array(menuSectionSchema).max(30).default([]),
});
export type MenuEntry = z.infer<typeof menuEntrySchema>;
export type MenuSection = z.infer<typeof menuSectionSchema>;
export type MenuDocument = z.infer<typeof menuDocumentSchema>;
export type MenuDesignId = MenuDocument["design"];
export type MenuRestaurant = {
  name: string;
  currency: string;
  cuisine?: string;
  logoId?: string | null;
  logo_id?: string | null;
  style?: { primary?: string; accent?: string; typography?: string };
  orderingUrl?: string;
};
export type DesignedMenu = MenuDocument & {
  restaurant: MenuRestaurant;
  qrUrl?: string;
  documentId?: string;
};

export function newMenuDocument(
  patch: Partial<MenuDocument> = {},
): MenuDocument {
  return menuDocumentSchema.parse(patch);
}
export function newMenuEntry(patch: Partial<MenuEntry> = {}): MenuEntry {
  return menuEntrySchema.parse({ id: crypto.randomUUID(), name: "", ...patch });
}
export function menuPrice(
  value: number | null,
  currency = "USD",
  format: MenuDocument["priceFormat"] = "currency",
  language = "en",
) {
  if (value == null) return "";
  const whole = value % 100 === 0;
  return new Intl.NumberFormat(language || "en", {
    ...(format === "currency" ? { style: "currency", currency } : {}),
    minimumFractionDigits: format === "whole" && whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}
export function entryPrice(item: MenuEntry, menu: DesignedMenu) {
  return item.priceMode === "included" || item.priceMode === "variants"
    ? ""
    : item.priceMode === "label"
      ? item.priceLabel
      : menuPrice(
          item.price,
          menu.restaurant.currency,
          menu.priceFormat,
          menu.language,
        );
}
export function visibleMenuSections(menu: DesignedMenu | MenuDocument) {
  return menu.sections
    .map((s) => ({
      ...s,
      items: s.items.filter(
        (i) => i.visible && (menu.showUnavailable || i.available),
      ),
    }))
    .filter((s) => s.items.length);
}
export function menuContentIssues(menu: MenuDocument) {
  const issues: { message: string; entryId?: string; sectionId?: string }[] =
    [];
  if (!visibleMenuSections(menu).length)
    issues.push({ message: "Add at least one visible dish to your menu." });
  for (const section of visibleMenuSections(menu)) {
    if (!section.name.trim())
      issues.push({
        message: "Give this section a name.",
        sectionId: section.id,
      });
    for (const item of section.items) {
      if (!item.visible) continue;
      const add = (message: string) =>
        issues.push({ message, entryId: item.id, sectionId: section.id });
      if (!item.name.trim()) add("Give this dish a name.");
      if (!item.sourceReviewed)
        add(`Check ${item.name || "this imported dish"} against the original.`);
      if (item.priceMode === "single" && item.price == null)
        add(
          `Set a price for ${item.name || "this dish"}, or choose Included or Market price.`,
        );
      if (item.priceMode === "label" && !item.priceLabel.trim())
        add(`Add a price label for ${item.name || "this dish"}.`);
      if (
        item.priceMode === "variants" &&
        (!item.variants.length || item.variants.some((v) => !v.label.trim()))
      )
        add(`Name each size or price option for ${item.name || "this dish"}.`);
      if (item.additions.some((v) => !v.label.trim()))
        add(`Name each add-on for ${item.name || "this dish"}.`);
    }
  }
  return issues;
}

/** Copy legacy content once. Later menu edits never mutate the shared dish library. */
export function upgradeMenuDocument(
  legacy: Row,
  dishes: Row[] = [],
): MenuDocument {
  if (legacy.version === 2) return menuDocumentSchema.parse(legacy);
  const rows = legacy.rows as Row[] | undefined;
  const grouped = rows
    ? [...new Set(rows.map((r) => r.category || "Dishes"))].map((name) => ({
        name,
        items: rows
          .filter((r) => (r.category || "Dishes") === name)
          .map((r) => ({
            ...r,
            dishId: r.id || null,
            price:
              r.price === "" || r.price == null
                ? null
                : Math.round(Number(r.price) * 100),
          })),
      }))
    : legacy.sections || [];
  return newMenuDocument({
    name: legacy.name || legacy.title || "Dinner menu",
    title: legacy.title || "Dinner",
    design: menuDesignIds.includes(legacy.design) ? legacy.design : "bistro",
    layout: legacy.layout || "classic",
    appearance: legacy.appearance || "light",
    paper: legacy.paper || "letter",
    density: legacy.density || "comfortable",
    sections: grouped.map((s: Row) => ({
      id: crypto.randomUUID(),
      name: s.name || "Dishes",
      description: "",
      pageBreakBefore: false,
      items: s.items.map((i: Row) => {
        const d = dishes.find((d) => d.id === (i.dishId || i.id));
        return newMenuEntry({
          ...d,
          ...i,
          id: crypto.randomUUID(),
          dishId: d?.id || i.dishId || null,
          name: i.name ?? d?.name ?? "",
          price: i.price ?? d?.price ?? null,
          photoId: i.photoId || null,
          available:
            (i.available ?? d?.available) !== false &&
            (i.available ?? d?.available) !== 0,
          sourceReviewed: i.importReviewed !== false,
        });
      }),
    })),
  });
}
