import {
  menuContentIssues,
  menuPurposeDefaults,
  visibleMenuSections,
  type MenuDocument,
  type MenuSection,
} from "./menu-document";
import { inferMenuPurpose, isAddonName } from "./menu-paste";
import { normalizeDietary } from "./dietary";
import {
  isPlaceholderRestaurantName,
  restaurantNameMessage,
} from "./restaurant-identity";
import { publicBrandStyle } from "./restaurant-look";
import type { Row } from "./client";

export type MenuCheck = {
  id: string;
  level: "block" | "warn";
  message: string;
  entryId?: string;
  sectionId?: string;
  fix?: "restaurant-name" | "edit" | "remove" | "attach-addon" | "menu-type";
  purpose?: MenuDocument["purpose"];
};

/** "Drip coffee 3.00 /" — an import left a price in the dish name. */
export const hasPriceInName = (name: string) =>
  /(?:^|\s)[$€£¥]?\d{1,4}[.,]\d{2}(?=\s|$|[/|])|\s[/|]\s*$/.test(name.trim());
const drinkPurpose = (purpose: string) =>
  ["drinks", "bar", "cocktails", "smoothies"].includes(purpose);
/** The menu's type disagrees with its sections in a way guests would notice. */
function purposeMismatch(
  menu: Pick<MenuDocument, "sections" | "title"> &
    Partial<Pick<MenuDocument, "purpose">>,
) {
  if (!menu.purpose) return null;
  if (menu.title !== menuPurposeDefaults(menu.purpose).title) return null;
  const inferred = inferMenuPurpose(
    visibleMenuSections(menu as MenuDocument).map((s) => s.name),
  );
  if (!inferred || inferred === menu.purpose) return null;
  return drinkPurpose(inferred) !== drinkPurpose(menu.purpose) ||
    (menu.purpose === "dinner" && ["cafe", "brunch"].includes(inferred))
    ? inferred
    : null;
}

/**
 * Automatic checks before a menu goes to guests or print. Blocking checks stop
 * publishing and PDF export; warnings are shown but never block. The server
 * runs the same checks when publishing, so the dialog can't be bypassed.
 */
export function menuPublishChecks(
  menu: Pick<
    MenuDocument,
    "sections" | "showUnavailable" | "title" | "fixedPrice"
  > &
    Partial<Pick<MenuDocument, "purpose">>,
  context: {
    restaurantName: string;
    sampleDishIds?: Iterable<string>;
    /** Photos the owner reported as inaccurate. */
    correctionPhotoIds?: Iterable<string>;
  },
): MenuCheck[] {
  const checks: MenuCheck[] = [];
  if (isPlaceholderRestaurantName(context.restaurantName))
    checks.push({
      id: "restaurant-name",
      level: "block",
      message: restaurantNameMessage,
      fix: "restaurant-name",
    });
  menuContentIssues(menu as MenuDocument).forEach((issue, index) =>
    checks.push({
      id: `content:${issue.entryId || issue.sectionId || index}:${index}`,
      level: "block",
      fix: "edit",
      ...issue,
    }),
  );
  const samples = new Set(context.sampleDishIds || []),
    reported = new Set(context.correctionPhotoIds || []);
  const names = new Map<string, number>();
  const undescribed: { id: string; name: string; sectionId: string }[] = [];
  const soldOut: string[] = [];
  for (const section of visibleMenuSections(menu as MenuDocument))
    for (const item of section.items) {
      const label = item.name.trim() || "This dish";
      // The dish an add-on would join is the one directly above it.
      const all = menu.sections.find((s) => s.id === section.id)?.items || [];
      const above = all[all.findIndex((i) => i.id === item.id) - 1];
      if (hasPriceInName(item.name))
        checks.push({
          id: `price-name:${item.id}`,
          level: "warn",
          message: `${label} has a price in its name. Move it to the price, or use Sizes / options.`,
          entryId: item.id,
          sectionId: section.id,
          fix: "edit",
        });
      if (isAddonName(item.name) && item.priceMode === "single")
        checks.push({
          id: `addon:${item.id}`,
          level: "warn",
          message: above
            ? `${label} looks like an add-on for ${above.name.trim() || "the dish above it"}.`
            : `${label} looks like an add-on. Add it to the dish it belongs to.`,
          entryId: item.id,
          sectionId: section.id,
          fix: above ? "attach-addon" : "edit",
        });
      if (item.dishId && samples.has(item.dishId))
        checks.push({
          id: `sample:${item.id}`,
          level: "block",
          message: `${label} is the sample dish. Remove it before guests see your menu.`,
          entryId: item.id,
          sectionId: section.id,
          fix: "remove",
        });
      if (item.photoId && reported.has(item.photoId))
        checks.push({
          id: `photo-reported:${item.id}`,
          level: "warn",
          message: `${label} has a photo you reported as inaccurate. Choose another photo or remove it.`,
          entryId: item.id,
          sectionId: section.id,
          fix: "edit",
        });
      if (item.priceMode === "single" && item.price === 0)
        checks.push({
          id: `zero:${item.id}`,
          level: "block",
          message: `${label} has a price of 0. Set its price, or choose Included if it’s free.`,
          entryId: item.id,
          sectionId: section.id,
          fix: "edit",
        });
      const key = item.name.trim().toLowerCase();
      if (key) {
        const count = (names.get(key) || 0) + 1;
        names.set(key, count);
        if (count === 2)
          checks.push({
            id: `duplicate:${key}`,
            level: "warn",
            message: `${label} appears more than once.`,
            entryId: item.id,
            sectionId: section.id,
            fix: "edit",
          });
      }
      if (!item.description.trim())
        undescribed.push({ id: item.id, name: label, sectionId: section.id });
      if (!item.available) soldOut.push(label);
    }
  if (undescribed.length)
    checks.push({
      id: "descriptions",
      level: "warn",
      message:
        undescribed.length === 1
          ? `${undescribed[0].name} has no description.`
          : `${undescribed.length} dishes have no description.`,
      entryId: undescribed[0].id,
      sectionId: undescribed[0].sectionId,
      fix: "edit",
    });
  if (soldOut.length && menu.showUnavailable)
    checks.push({
      id: "sold-out",
      level: "warn",
      message:
        soldOut.length === 1
          ? `${soldOut[0]} will show as unavailable.`
          : `${soldOut.length} dishes will show as unavailable.`,
    });
  const purpose = purposeMismatch(menu);
  if (purpose)
    checks.push({
      id: "menu-type",
      level: "warn",
      message: `This menu is titled “${menu.title}”, but its sections look like a ${menuPurposeDefaults(purpose).name.toLowerCase()}.`,
      fix: "menu-type",
      purpose,
    });
  return checks;
}

/** Move "Add bacon" into the add-ons of the dish above it. */
export function attachAddonToDishAbove<T extends { sections: MenuSection[] }>(
  menu: T,
  entryId: string,
  label: string,
): T {
  return {
    ...menu,
    sections: menu.sections.map((section) => {
      const index = section.items.findIndex((i) => i.id === entryId);
      if (index < 1) return section;
      const addon = section.items[index],
        parent = section.items[index - 1];
      return {
        ...section,
        items: section.items
          .filter((i) => i.id !== entryId)
          .map((i) =>
            i.id === parent.id
              ? {
                  ...i,
                  additions: [
                    ...i.additions,
                    {
                      id: crypto.randomUUID(),
                      label,
                      price: addon.price ?? 0,
                    },
                  ].slice(0, 12),
                }
              : i,
          ),
      };
    }),
  };
}

export const blockingChecks = (checks: MenuCheck[]) =>
  checks.filter((check) => check.level === "block");

/**
 * A published menu keeps the restaurant's name, logo, colors, currency,
 * cuisine and ordering link from when it was published. True when the
 * owner's settings have changed since, so publishing again would show them.
 */
export function restaurantSettingsChanged(
  published: Row | null | undefined,
  restaurant: Row,
) {
  const shown = published?.restaurant;
  if (!shown) return false;
  const look = shown.style || {},
    style = publicBrandStyle(restaurant.style || {});
  return (
    shown.name !== restaurant.name ||
    shown.currency !== restaurant.currency ||
    (shown.cuisine || "") !== (restaurant.cuisine || "") ||
    (shown.orderingUrl || "") !== (restaurant.ordering_url || "") ||
    (shown.logoId || null) !==
      ((published.showLogo !== false && restaurant.logo_id) || null) ||
    look.primary !== style.primary ||
    look.accent !== style.accent ||
    look.typography !== style.typography
  );
}

export type DishFacts = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  available: boolean;
  dietary?: string[];
};

export function dishFacts(row: Record<string, unknown>): DishFacts {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    price: typeof row.price === "number" ? row.price : null,
    available: !!row.available,
    dietary: normalizeDietary(row.dietary),
  };
}
const sameTags = (a: unknown, b: unknown) =>
  JSON.stringify(normalizeDietary(a)) === JSON.stringify(normalizeDietary(b));

/**
 * Menu dishes gain their My Dishes link, any approved photo it has, and its
 * dietary and allergen tags when the menu dish has none of its own.
 */
export function withLibraryLinks(
  menu: MenuDocument,
  links: {
    entryId: string;
    dishId: string;
    photoId: string | null;
    dietary?: string[];
  }[],
): MenuDocument {
  const byEntry = new Map(links.map((link) => [link.entryId, link]));
  const hadPhotos = menu.sections.some((s) => s.items.some((i) => i.photoId));
  let featured = menu.sections.reduce(
      (n, s) => n + s.items.filter((i) => i.featured).length,
      0,
    ),
    added = 0;
  const sections = menu.sections.map((s) => ({
    ...s,
    items: s.items.map((i) => {
      const link = byEntry.get(i.id);
      if (!link || i.dishId) return i;
      const linked = {
        ...i,
        dishId: link.dishId,
        dietary: i.dietary.length ? i.dietary : normalizeDietary(link.dietary),
      };
      if (i.photoId || !link.photoId) return linked;
      added++;
      return {
        ...linked,
        photoId: link.photoId,
        featured: i.featured || featured++ < 4,
      };
    }),
  }));
  return {
    ...menu,
    sections,
    // Photos lead the menu when they're its first ones.
    layout:
      added && !hadPhotos && menu.layout === "classic"
        ? "featured"
        : menu.layout,
  };
}

/**
 * Carry a My Dishes edit into a menu. Only details that still match the dish's
 * previous value follow the dish; anything tailored on this menu (a brunch
 * price, a shorter description) stays as the owner set it. A menu dish with
 * no tags (imports start with none) counts as not set, so tag edits reach it.
 */
export function applyDishUpdate<T extends { sections: MenuSection[] }>(
  menu: T,
  before: DishFacts,
  after: DishFacts,
): { menu: T; changed: number } {
  let changed = 0;
  const sections = menu.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.dishId !== after.id) return item;
      const next = { ...item };
      if (before.name !== after.name && item.name === before.name)
        next.name = after.name;
      if (
        before.description !== after.description &&
        item.description === before.description
      )
        next.description = after.description;
      if (
        before.price !== after.price &&
        (item.priceMode ?? "single") === "single" &&
        item.price === before.price
      )
        next.price = after.price;
      if (
        before.available !== after.available &&
        item.available === before.available
      )
        next.available = after.available;
      if (
        !sameTags(before.dietary, after.dietary) &&
        (sameTags(item.dietary, before.dietary) ||
          !normalizeDietary(item.dietary).length)
      )
        next.dietary = normalizeDietary(after.dietary);
      if (JSON.stringify(next) === JSON.stringify(item)) return item;
      changed++;
      return next;
    }),
  }));
  return { menu: changed ? { ...menu, sections } : menu, changed };
}
