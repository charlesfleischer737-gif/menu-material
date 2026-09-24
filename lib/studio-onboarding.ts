import { photoStyles } from "./photo-styles";
import type { Row } from "./client";

export const drinkKinds = [
  "beer",
  "wine",
  "cocktail",
  "spirits",
  "coffee",
  "tea",
  "juice",
  "smoothie",
  "other",
] as const;

// Subject relevance comes before output size. A delivery-format drink still
// needs beverage examples, never the burger/food defaults.
export function recommendedPhotoStyles(
  family = "",
  destination = "menu",
  drinkKind = "other",
) {
  const drinks: Record<string, string[]> = {
    beer: ["bar-brass", "bar-speakeasy", "beverage-backlit"],
    wine: ["bar-cellar", "bar-velvet", "bar-speakeasy"],
    cocktail: ["bar-rooftop", "bar-velvet", "bar-bluehour"],
    spirits: ["bar-speakeasy", "bar-bluehour", "bar-velvet"],
    coffee: ["beverage-cafe", "beverage-ritual", "beverage-backlit"],
    tea: ["beverage-botanical", "beverage-matcha", "beverage-backlit"],
    juice: ["beverage-citrus", "beverage-poolside", "beverage-backlit"],
    smoothie: ["beverage-orchid", "beverage-citrus", "beverage-matcha"],
    other: ["beverage-backlit", "beverage-cafe", "bar-speakeasy"],
  };
  const families: Record<string, string[]> = {
    "Plated mains": ["menu-neutral", "menu-wood", "fine-slate"],
    "Burgers & sandwiches": [
      "delivery-white",
      "delivery-daylight",
      "studio-color",
    ],
    Pizza: ["delivery-overhead", "menu-overhead", "menu-wood"],
    "Bowls & salads": ["delivery-takeout", "menu-stone", "menu-neutral"],
    Desserts: ["bakery-patisserie", "studio-ivory", "bakery-jewel"],
    Takeout: ["delivery-takeout", "delivery-white", "delivery-daylight"],
  };
  let ids =
    family === "Drinks"
      ? drinks[drinkKind] || drinks.other
      : families[family] || [];
  if (destination === "delivery" && family !== "Drinks") {
    if (family === "Pizza")
      ids = ["delivery-overhead", "delivery-daylight", "delivery-white"];
    else if (family === "Desserts")
      ids = ["bakery-patisserie", "studio-ivory", "bakery-jewel"];
    else if (ids.length)
      ids = ["delivery-white", "delivery-takeout", "delivery-daylight"];
  }
  return ids.map((id) => photoStyles.find((style) => style.id === id)!);
}

// Analysis can offer alternatives, but never silently select a different style.
export function photoAnalysisRecommendation(
  current: Row,
  result: Row,
  sourceId: string,
) {
  if (
    current.sourceId !== sourceId ||
    current.step > 3 ||
    current.mode !== "photo" ||
    (current.analysisSourceId === sourceId &&
      current.analysisStatus === "manual")
  )
    return {};
  const confident =
    result.confidence === "high" &&
    !result.menuDocument &&
    result.issue !== "multiple";
  return {
    analysisSourceId: sourceId,
    analysisStatus: confident ? "ready" : "uncertain",
    analysisSubject: confident ? result.subject : "",
    recommendationFamily: confident ? result.family : "",
    recommendationDrink:
      confident && result.family === "Drinks"
        ? result.drinkKind || "other"
        : "other",
    ...(confident ? { family: result.family } : {}),
    menuDocument: result.menuDocument,
    analysisAdvice: result.advice,
  };
}

export function recommendationsForPhoto(draft: Row) {
  if (
    !draft.sourceId ||
    draft.mode !== "photo" ||
    draft.analysisSourceId !== draft.sourceId ||
    !["ready", "manual"].includes(draft.analysisStatus) ||
    draft.menuDocument
  )
    return [];
  return recommendedPhotoStyles(
    draft.recommendationFamily,
    draft.destination,
    draft.recommendationDrink,
  );
}

// This is an estimate for the waiting experience, not provider telemetry.
// Completion is driven exclusively by a real saved output.
export function studioRenderProgress(elapsedSeconds: number, queued: boolean) {
  const elapsed = Math.max(0, elapsedSeconds);
  return {
    value: queued
      ? 6
      : Math.min(94, Math.round(8 + 86 * (1 - Math.exp(-elapsed / 13)))),
    stage: queued ? -1 : elapsed < 8 ? 0 : elapsed < 18 ? 1 : 2,
    takingLonger: elapsed >= 45,
  };
}
