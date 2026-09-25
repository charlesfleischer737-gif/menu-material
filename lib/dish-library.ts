import type { Row } from "./client";
export function dishPhotos(dish: Row, assets: Row[]) {
  return assets.filter(
    (a) =>
      a.dish_id === dish.id &&
      !a.deleted_at &&
      ["source", "generated", "edited"].includes(a.kind),
  );
}
export function preferredPhoto(dish: Row, assets: Row[]) {
  const photos = dishPhotos(dish, assets).filter((a) => !a.needs_correction);
  return (
    photos.find((a) => a.id === dish.preferred_photo_id && a.approved_at) ||
    photos.find((a) => a.approved_at) ||
    photos[0]
  );
}
export function dishStatus(dish: Row, assets: Row[]) {
  const photo = preferredPhoto(dish, assets);
  return photo?.approved_at ? "Approved" : photo ? "Needs review" : "No photo";
}
/** A dish's section; a blank one reads as "Dishes", as it does on menus. */
export function dishSection(dish: Row): string {
  return String(dish.category || "").trim() || "Dishes";
}
/**
 * A price typed in the currency's major units: empty means no price yet (0).
 * Null when it isn't a price from 0 to 1,000,000.
 */
export function typedPrice(value: unknown): number | null {
  const price = value === "" || value == null ? 0 : Number(value);
  return Number.isFinite(price) && price >= 0 && price <= 1000000
    ? price
    : null;
}
export function dishSnapshot(dish: Row): Row {
  return {
    name: dish.name,
    description: dish.description || "",
    price: dish.price,
    available: !!dish.available,
    category: dish.category || "Dishes",
  };
}
export function changedDishFacts(before: Row | undefined, current: Row) {
  if (!before) return [];
  const after = dishSnapshot(current);
  return Object.keys(after).filter((k) => before[k] !== after[k]);
}
