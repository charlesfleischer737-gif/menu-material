import {
  menuContentIssues,
  visibleMenuSections,
  type MenuDocument,
  type MenuSection,
} from "./menu-document";
import {
  isPlaceholderRestaurantName,
  restaurantNameMessage,
} from "./restaurant-identity";

export type MenuCheck = {
  id: string;
  level: "block" | "warn";
  message: string;
  entryId?: string;
  sectionId?: string;
  fix?: "restaurant-name" | "edit" | "remove";
};

/**
 * Automatic checks before a menu goes to guests or print. Blocking checks stop
 * publishing and PDF export; warnings are shown but never block. The server
 * runs the same checks when publishing, so the dialog can't be bypassed.
 */
export function menuPublishChecks(
  menu: Pick<
    MenuDocument,
    "sections" | "showUnavailable" | "title" | "fixedPrice"
  >,
  context: { restaurantName: string; sampleDishIds?: Iterable<string> },
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
  const samples = new Set(context.sampleDishIds || []);
  const names = new Map<string, number>();
  const undescribed: { id: string; name: string; sectionId: string }[] = [];
  const soldOut: string[] = [];
  for (const section of visibleMenuSections(menu as MenuDocument))
    for (const item of section.items) {
      const label = item.name.trim() || "This dish";
      if (item.dishId && samples.has(item.dishId))
        checks.push({
          id: `sample:${item.id}`,
          level: "block",
          message: `${label} is the sample dish. Remove it before guests see your menu.`,
          entryId: item.id,
          sectionId: section.id,
          fix: "remove",
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
  return checks;
}

export const blockingChecks = (checks: MenuCheck[]) =>
  checks.filter((check) => check.level === "block");

export type DishFacts = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  available: boolean;
};

export function dishFacts(row: Record<string, unknown>): DishFacts {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    price: typeof row.price === "number" ? row.price : null,
    available: !!row.available,
  };
}

/**
 * Carry a My Dishes edit into a menu. Only details that still match the dish's
 * previous value follow the dish; anything tailored on this menu (a brunch
 * price, a shorter description) stays as the owner set it.
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
      if (JSON.stringify(next) === JSON.stringify(item)) return item;
      changed++;
      return next;
    }),
  }));
  return { menu: changed ? { ...menu, sections } : menu, changed };
}
