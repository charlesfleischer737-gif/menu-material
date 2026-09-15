import { photoStyles } from "./photo-styles";

// Recommendations use existing presets and never require a paid image preview.
// Keep the source camera angle in the short flow; new angles remain optional.
export function recommendedPhotoStyles(
  family = "Plated mains",
  destination = "menu",
) {
  const ids =
    destination === "delivery" || family === "Takeout"
      ? ["delivery-white", "delivery-takeout", "delivery-daylight"]
      : family === "Drinks"
        ? ["beverage-backlit", "beverage-cafe", "bar-speakeasy"]
        : family === "Desserts"
          ? ["bakery-morning", "bakery-patisserie", "bakery-jewel"]
          : destination === "social"
            ? ["studio-color", "menu-wood", "studio-dark"]
            : family === "Burgers & sandwiches"
              ? ["delivery-daylight", "menu-stone", "studio-dark"]
              : family === "Bowls & salads"
                ? ["menu-stone", "delivery-takeout", "fine-counter"]
                : family === "Pizza"
                  ? ["menu-neutral", "menu-wood", "studio-ivory"]
                  : ["menu-stone", "menu-wood", "fine-slate"];
  return ids.map((id) => photoStyles.find((style) => style.id === id)!);
}

export function studioProgress(step: number) {
  return step < 3 ? step : step === 3 ? 2 : 3;
}

export function photoAnalysisRecommendation(
  current: Record<string, any>,
  family: string,
) {
  if (current.styleChosen || current.step !== 2) return {};
  const style = recommendedPhotoStyles(family, current.destination)[0];
  return {
    recommendationFamily: family,
    look: style.id,
    lookCategory: style.category,
  };
}
