import {
  allergensListed,
  containsText,
  dietaryParts,
  dietaryTag,
  hiddenByAllergens,
  suitsDiet,
} from "./dietary";

/** "Vegetarian · Gluten-free · Contains: milk, egg", for search. */
export function guestDietary(values: string[]) {
  const { diets, allergens, notes } = dietaryParts(values);
  return [...diets.map((tag) => tag.label), containsText(allergens), ...notes]
    .filter(Boolean)
    .join(" · ");
}

type GuestDish = { name: string; description: string; dietary: string[] };

/**
 * The dishes a guest's search and filters leave on the menu. Search and
 * "Suitable for" narrow it; "Hide dishes with" hides dishes that list one of
 * the chosen allergens and counts them per section, so a section never
 * vanishes unexplained. Dishes whose allergens aren't listed always stay.
 */
export function filterGuestMenu<
  D extends GuestDish,
  S extends { name: string; items: D[] },
>(
  sections: S[],
  {
    query = "",
    diets = [],
    allergens = [],
    language = "en",
  }: {
    query?: string;
    diets?: string[];
    allergens?: string[];
    language?: string;
  },
) {
  const search = query.trim().toLocaleLowerCase(language);
  const result = sections
    .map((section) => {
      const matching = section.items.filter(
        (item) =>
          diets.every((id) => suitsDiet(item.dietary, id)) &&
          `${section.name} ${item.name} ${item.description} ${guestDietary(item.dietary)}`
            .toLocaleLowerCase(language)
            .includes(search),
      );
      const items = matching.filter(
        (item) => !hiddenByAllergens(item.dietary, allergens),
      );
      return { ...section, items, hidden: matching.length - items.length };
    })
    .filter((section) => section.items.length || section.hidden);
  const shown = result.flatMap((section) => section.items);
  return {
    sections: result,
    /** Dishes left on the menu. */
    shown: shown.length,
    /** Of those, dishes whose allergens aren't listed. */
    unlisted: shown.filter((item) => !allergensListed(item.dietary)).length,
  };
}

/** "peanuts", "peanuts or milk", "gluten, milk or egg" */
function allergenNames(ids: string[], conjunction: "and" | "or") {
  const names = ids.map((id) => dietaryTag(id)?.label.toLowerCase() || id);
  return names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} ${conjunction} ${names[names.length - 1]}`;
}
/** The allergen filter's button: "Hide allergens", "Hiding peanuts and milk". */
export function allergenFilterLabel(chosen: string[]) {
  if (!chosen.length) return "Hide allergens";
  if (chosen.length > 2) return `Hiding ${chosen.length} allergens`;
  return `Hiding ${allergenNames(chosen, "and")}`;
}
/** Under a section: "Hidden here: 2 dishes with peanuts or milk." */
export function hiddenDishesText(count: number, chosen: string[]) {
  return `Hidden here: ${count} ${count === 1 ? "dish" : "dishes"} with ${allergenNames(chosen, "or")}.`;
}
