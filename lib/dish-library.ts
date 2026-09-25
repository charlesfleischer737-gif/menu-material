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
  return photo?.approved_at ? "Ready to use" : photo ? "New photo" : "No photo";
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
