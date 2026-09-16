import type { Row } from "./client";
export const menuDesigns = [
  {
    id: "bistro",
    name: "Brasserie",
    note: "Serif masthead · editorial columns",
  },
  {
    id: "cafe",
    name: "Market Café",
    note: "Category rails · warm, open space",
  },
  { id: "fine", name: "Atelier", note: "Centered courses · quiet luxury" },
  {
    id: "casual",
    name: "Counter Club",
    note: "Oversized type · asymmetric columns",
  },
];
export const menuCrop = (crop: Row = {}) => ({
  fit: crop.fit !== false,
  x: crop.x ?? 50,
  y: crop.y ?? 50,
  zoom: crop.zoom ?? 1,
});
export function duplicateMenuRows(rows: Row[]) {
  const seen = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const key = String(r.name).trim().toLocaleLowerCase();
    if (key) seen.set(key, [...(seen.get(key) || []), i]);
  });
  return new Set([...seen.values()].filter((ids) => ids.length > 1).flat());
}
export function menuChanges(
  menu: Row,
  published: Row | string | null,
): string[] {
  const previous =
    typeof published === "string" ? JSON.parse(published) : published;
  if (!previous)
    return [
      `First publication · ${menu.sections.flatMap((s: Row) => s.items).length} dishes`,
    ];
  const flatten = (m: Row) =>
    m.sections.flatMap((s: Row) =>
      s.items.map((i: Row) => ({ ...i, section: s.name })),
    );
  const before: Row[] = flatten(previous),
    after: Row[] = flatten(menu),
    changes: string[] = [];
  for (const item of after) {
    const old = before.find((i) => i.id === item.id);
    if (!old) {
      changes.push(`Added ${item.name}`);
      continue;
    }
    const fields = [
      "name",
      "description",
      "price",
      "available",
      "photoId",
      "section",
      "featured",
      "crop",
    ].filter(
      (key) =>
        JSON.stringify(old[key] ?? null) !== JSON.stringify(item[key] ?? null),
    );
    if (fields.length)
      changes.push(
        `${item.name}: ${fields.map((f) => ({ photoId: "photo", available: "availability", section: "section", featured: "featured photo", crop: "framing" })[f] || f).join(", ")} changed`,
      );
  }
  before
    .filter((i) => !after.some((n) => n.id === i.id))
    .forEach((i) => changes.push(`Removed ${i.name}`));
  if (
    before.map((i) => i.id).join() !== after.map((i) => i.id).join() &&
    before.length === after.length &&
    before.every((i) => after.some((n) => n.id === i.id))
  )
    changes.push("Dish order changed");
  if (
    ["layout", "appearance", "design", "density", "title"].some(
      (k) => (menu[k] || "") !== (previous[k] || ""),
    )
  )
    changes.push("Menu design changed");
  if (
    JSON.stringify(menu.restaurant.style) !==
      JSON.stringify(previous.restaurant.style) ||
    menu.restaurant.name !== previous.restaurant.name ||
    menu.restaurant.logoId !== previous.restaurant.logoId
  )
    changes.push("Restaurant look or name changed");
  return changes;
}
