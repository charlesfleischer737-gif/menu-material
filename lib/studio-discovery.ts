import { looks, photoStyles, resolvePhotoLook } from "./studio";
import { restaurantPhotoDefaults } from "./restaurant-look";
import type { PhotoStyle } from "./photo-styles";
import type { Row } from "./client";

type Draft = Row;
export function searchIntent(query: string) {
  const text = query.toLowerCase();
  if (
    /christmas|holiday|valentine|game.?day|football|foodball|summer/.test(text)
  )
    return "occasion";
  if (/wood|marble|stone|table|background|linen/.test(text)) return "setting";
  if (/light|bright|dark|warm|co[sz]y|color|moody/.test(text)) return "mood";
  if (/burger|pizza|pasta|dessert|coffee|cocktail|drink|salad/.test(text))
    return "subject";
  return "other";
}
export function studioCreationBlock(draft: Draft, availability?: Draft) {
  if (availability?.creationEnabled === false)
    return (
      availability.message ||
      "Photo creation is temporarily paused. Your saved photos are safe."
    );
  if (!resolvePhotoLook(draft))
    return "This saved look is unavailable. Choose another look to continue; your photo and custom choices are kept.";
  if (availability?.disabledStyleIds?.includes(draft.look))
    return "This look is temporarily unavailable. Choose another look; your original photo is safe.";
  return "";
}
export const lookControls = [
  "surface",
  "lighting",
  "plate",
  "angle",
  "composition",
] as const;
export const lookMoods = ["All", "Bright", "Warm", "Dark", "Colorful"] as const;
export { findStyles } from "./studio-search";

// Style changes never discard deliberate adjustments. The recipe stored on a
// draft is independent of later changes to a restaurant's default look.
export function studioLookPatch(
  current: Draft,
  id: string,
  restaurant: Draft = {},
) {
  const style = looks.find((look) => look.id === id);
  if (!style) return {};
  const defaults: Draft =
    id === "restaurant"
      ? restaurantPhotoDefaults({
          ...restaurant,
          style: { ...restaurant.style, autoApply: true },
        })
      : {
          surface: "As shown",
          lighting: "As shown",
          plate: current.family === "Drinks" ? "keep" : style.plate || "keep",
          angle: "keep",
          composition: "Full dish",
        };
  const overrides = lookControls.filter((key) =>
    (current.studioOverrides || []).includes(key),
  );
  for (const key of overrides) defaults[key] = current[key];
  return {
    ...defaults,
    look: id,
    styleChosen: true,
    styleIntent: true,
    lookCategory: style.category || current.lookCategory,
    previousPhotoStyle: null,
    savedLookId: "",
    savedLookName: "",
    savedLookVersion: null,
    occasionId: "",
    photoStyleSnapshot:
      id === "restaurant" ? (restaurant.style?.photoStyle ?? null) : null,
    photoReferenceIds:
      id === "restaurant" ? restaurant.style?.referenceIds || [] : null,
    studioOverrides: overrides,
  };
}
export function exploreStyleSelection(
  current: Draft,
  id: string,
  restaurant: Draft = {},
) {
  if (!photoStyles.some((style) => style.id === id && !style.legacy))
    return null;
  const startNew = !!(current.step >= 4 || current.resultId || current.jobId);
  return {
    startNew,
    draft: {
      ...current,
      ...studioLookPatch(current, id, restaurant),
      selectionOrigin: "explore",
      studioDefaultResolved: true,
      requestKey: "",
      step: 1,
      ...(startNew
        ? { jobId: "", resultId: "", generationStartedAt: null }
        : {}),
    },
  };
}

export function lookSummary(draft: Draft) {
  return [
    draft.surface === "As shown"
      ? draft.look === "keep"
        ? "Your setting"
        : "Style setting"
      : draft.surface,
    draft.lighting === "As shown"
      ? draft.look === "keep"
        ? "Natural light"
        : "Style lighting"
      : draft.lighting,
    draft.family === "Drinks"
      ? "Your glass"
      : draft.plate === "keep"
        ? "Your serving dish"
        : draft.plate === "white"
          ? "White serving dish"
          : "Style serving dish",
    ...(draft.angle !== "keep"
      ? [draft.angle === "overhead" ? "New overhead angle" : "New angled view"]
      : []),
  ].filter(Boolean);
}

// Describe the same effective choices that selecting a catalog look will apply.
// Only explicit food serving ware is applied; example camera angles are not defaults.
export function lookExpectations(
  current: Draft,
  id: string,
  restaurant: Draft = {},
) {
  const next: Draft = {
    ...current,
    ...studioLookPatch(current, id, restaurant),
  };
  const fromPhoto = next.mode === "photo";
  const drink = next.family === "Drinks";
  const rows = [
    {
      label: "Setting",
      value:
        next.surface === "As shown"
          ? id === "keep"
            ? "Keep your setting"
            : "Follow this look"
          : next.surface,
      custom: next.studioOverrides?.includes("surface") || false,
    },
    {
      label: "Light",
      value:
        next.lighting === "As shown"
          ? id === "keep"
            ? "Polish the natural light"
            : "Follow this look"
          : next.lighting,
      custom: next.studioOverrides?.includes("lighting") || false,
    },
    {
      label: drink ? "Glass" : "Serving dish",
      value:
        drink || next.plate === "keep"
          ? fromPhoto
            ? drink
              ? "Keep your glass"
              : "Keep your serving dish"
            : "Choose a suitable vessel"
          : next.plate === "white"
            ? "Simple white serving dish"
            : "Follow this look",
      custom: !drink && (next.studioOverrides?.includes("plate") || false),
    },
    {
      label: "Camera angle",
      value:
        next.angle === "overhead"
          ? "New overhead view"
          : next.angle === "three-quarter"
            ? "New angled view"
            : fromPhoto
              ? "Keep your original angle"
              : "A natural view of the dish",
      custom: next.studioOverrides?.includes("angle") || false,
    },
  ];
  return {
    rows,
    framing: next.studioOverrides?.includes("composition")
      ? next.composition
      : "",
    angleChanged: fromPhoto && next.angle !== "keep",
    vesselConflict: fromPhoto && drink && next.plate !== "keep",
    fromPhoto,
  };
}
export function startingLooks(
  draft: Draft,
  suggested: PhotoStyle[],
  restaurantLook?: PhotoStyle,
  excludeIds: string[] = [],
  unavailableIds: string[] = [],
  count = 3,
) {
  const keep = looks.find((look) => look.id === "keep")!;
  const defaults =
    draft.family === "Drinks"
      ? ["beverage-cafe", "bar-velvet"]
      : ["menu-wood", "delivery-white"];
  const choices = [
    ...(restaurantLook ? [restaurantLook] : []),
    keep,
    ...suggested,
    ...(defaults
      .map((id) => photoStyles.find((style) => style.id === id))
      .filter(Boolean) as PhotoStyle[]),
    ...photoStyles.filter((style) =>
      draft.family === "Drinks"
        ? ["bar", "beverage"].includes(style.category || "")
        : !["bar", "beverage"].includes(style.category || ""),
    ),
  ];
  return choices
    .filter((style) => !unavailableIds.includes(style.id))
    .filter((style) => style.id === "keep" || !excludeIds.includes(style.id))
    .filter(
      (style, index, candidates) =>
        candidates.findIndex((s) => s.id === style.id) === index,
    )
    .slice(0, count);
}
