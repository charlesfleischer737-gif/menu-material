/**
 * Dietary and allergen tags the owner sets on a dish. Tags are facts the
 * restaurant confirms; nothing here is inferred from photos or recipes. A
 * menu entry stores tag ids alongside any older free-text notes, which are
 * kept and shown as written.
 */
export type DietaryTag = {
  id: string;
  label: string;
  kind: "diet" | "allergen";
  /** Printed after the dish name and explained in the menu's key. */
  code?: string;
};
export const dietaryTags: DietaryTag[] = [
  { id: "vegetarian", label: "Vegetarian", kind: "diet", code: "V" },
  { id: "vegan", label: "Vegan", kind: "diet", code: "VG" },
  { id: "gluten-free", label: "Gluten-free", kind: "diet", code: "GF" },
  { id: "dairy-free", label: "Dairy-free", kind: "diet", code: "DF" },
  { id: "contains-gluten", label: "Gluten", kind: "allergen" },
  { id: "contains-milk", label: "Milk", kind: "allergen" },
  { id: "contains-egg", label: "Egg", kind: "allergen" },
  { id: "contains-peanuts", label: "Peanuts", kind: "allergen" },
  { id: "contains-tree-nuts", label: "Tree nuts", kind: "allergen" },
  { id: "contains-soy", label: "Soy", kind: "allergen" },
  { id: "contains-sesame", label: "Sesame", kind: "allergen" },
  { id: "contains-fish", label: "Fish", kind: "allergen" },
  { id: "contains-shellfish", label: "Shellfish", kind: "allergen" },
  { id: "contains-molluscs", label: "Molluscs", kind: "allergen" },
  { id: "contains-celery", label: "Celery", kind: "allergen" },
  { id: "contains-mustard", label: "Mustard", kind: "allergen" },
  { id: "contains-lupin", label: "Lupin", kind: "allergen" },
  { id: "contains-sulphites", label: "Sulphites", kind: "allergen" },
];
const byId = new Map(dietaryTags.map((tag) => [tag.id, tag]));
export const dietTags = dietaryTags.filter((tag) => tag.kind === "diet");
export const allergenTags = dietaryTags.filter(
  (tag) => tag.kind === "allergen",
);
export const dietaryTag = (id: string) => byId.get(id);

// Notes written before tags existed, matched only when they say exactly this.
const synonyms: Record<string, string> = {
  v: "vegetarian",
  veg: "vegetarian",
  vegetarian: "vegetarian",
  vg: "vegan",
  vegan: "vegan",
  "plant-based": "vegan",
  gf: "gluten-free",
  "gluten free": "gluten-free",
  "gluten-free": "gluten-free",
  df: "dairy-free",
  "dairy free": "dairy-free",
  "dairy-free": "dairy-free",
  "contains gluten": "contains-gluten",
  "contains wheat": "contains-gluten",
  "contains milk": "contains-milk",
  "contains dairy": "contains-milk",
  "contains egg": "contains-egg",
  "contains eggs": "contains-egg",
  "contains peanuts": "contains-peanuts",
  "contains peanut": "contains-peanuts",
  "contains tree nuts": "contains-tree-nuts",
  "contains soy": "contains-soy",
  "contains sesame": "contains-sesame",
  "contains fish": "contains-fish",
  "contains shellfish": "contains-shellfish",
};

/** Tag ids first (in vocabulary order), then any free-text notes. */
export function normalizeDietary(values: unknown): string[] {
  let list: unknown = values;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];
  const tags = new Set<string>(),
    notes: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const value = raw.trim().slice(0, 40);
    if (!value) continue;
    const id = byId.has(value) ? value : synonyms[value.toLowerCase()];
    if (id) tags.add(id);
    else if (!notes.some((n) => n.toLowerCase() === value.toLowerCase()))
      notes.push(value);
  }
  return [
    ...dietaryTags.filter((tag) => tags.has(tag.id)).map((tag) => tag.id),
    ...notes,
  ].slice(0, 16);
}
export function dietaryParts(values: unknown) {
  const normalized = normalizeDietary(values);
  return {
    diets: dietTags.filter((tag) => normalized.includes(tag.id)),
    allergens: allergenTags.filter((tag) => normalized.includes(tag.id)),
    notes: normalized.filter((value) => !byId.has(value)),
  };
}
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
/** "Contains milk, egg" */
export function containsText(allergens: DietaryTag[]) {
  return allergens.length
    ? `Contains ${allergens.map((tag) => lower(tag.label)).join(", ")}`
    : "";
}
/** Printed under a dish: "V · GF · Contains milk, egg". */
export function printedDietary(values: unknown) {
  const { diets, allergens, notes } = dietaryParts(values);
  return [...diets.map((tag) => tag.code!), containsText(allergens), ...notes]
    .filter(Boolean)
    .join(" · ");
}
export const allergyNotice =
  "Please tell us about any allergies before you order.";
/** The key printed at the foot of a menu, for the codes it uses. */
export function dietaryKey(
  entries: { dietary: string[] }[],
  footer = "",
): string {
  const used = new Set(entries.flatMap((e) => normalizeDietary(e.dietary)));
  const codes = dietTags
    .filter((tag) => used.has(tag.id))
    .map((tag) => `${tag.code} ${lower(tag.label)}`);
  const allergens =
    allergenTags.some((tag) => used.has(tag.id)) && !/allerg/i.test(footer);
  return [codes.join(" · "), allergens ? allergyNotice : ""]
    .filter(Boolean)
    .join(". ");
}
