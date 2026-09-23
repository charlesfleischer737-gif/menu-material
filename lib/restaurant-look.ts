import { photoStyles } from "./photo-styles";

export const brandTypefaces = [
  {
    id: "modern",
    name: "Clean & modern",
    family: "Post Sans",
    file: "DMSans-Variable.ttf",
    printFile: "/fonts/print/DMSans-Semibold.ttf",
    sample: "Fresh from our kitchen",
  },
  {
    id: "editorial",
    name: "Warm & editorial",
    family: "Post Serif",
    file: "CormorantGaramond-Variable.ttf",
    printFile: "/fonts/print/CormorantGaramond-Semibold.ttf",
    sample: "A taste of something special",
  },
  {
    id: "bold",
    name: "Bold & expressive",
    family: "Post Condensed",
    file: "BarlowCondensed-Bold.ttf",
    printFile: "/fonts/social/BarlowCondensed-Bold.ttf",
    sample: "Made to be craved",
  },
] as const;

export const restaurantLooks = [
  {
    id: "neighborhood",
    name: "The neighborhood table",
    note: "Warm wood, familiar favorites",
    photoPreset: "menu-wood",
    primary: "#244638",
    accent: "#f4e8c8",
    typography: "editorial",
  },
  {
    id: "modern",
    name: "Fresh & modern",
    note: "Bright light, clean presentation",
    photoPreset: "menu-stone",
    primary: "#174e55",
    accent: "#e1f2e7",
    typography: "modern",
  },
  {
    id: "evening",
    name: "After hours",
    note: "Low light, a little drama",
    photoPreset: "bar-velvet",
    primary: "#3f2039",
    accent: "#f5dcae",
    typography: "editorial",
  },
  {
    id: "bakery",
    name: "The morning bake",
    note: "Soft light, golden pastry",
    photoPreset: "bakery-morning",
    primary: "#643827",
    accent: "#ffe6bb",
    typography: "editorial",
  },
  {
    id: "bold",
    name: "Big appetite",
    note: "Colorful, confident, full of flavor",
    photoPreset: "studio-color",
    primary: "#932d25",
    accent: "#fff1c5",
    typography: "bold",
  },
  {
    id: "fine",
    name: "Evening service",
    note: "Considered plating, elegant type",
    photoPreset: "fine-linen",
    primary: "#242b39",
    accent: "#eee6d3",
    typography: "editorial",
  },
] as const;

export function photoPresetFields(id: string) {
  const preset = photoStyles.find((p) => p.id === id);
  if (!preset) throw Error("Choose an available photo style.");
  return {
    photoPreset: preset.id,
    photoStyle: preset.prompt,
    referenceIds: [],
    photoDefaults: {
      surface: "As shown",
      lighting: "As shown",
      plate: "style",
      angle: "keep",
      composition: "Full dish",
    },
  };
}

export function restaurantLookFields(id: string) {
  const look = restaurantLooks.find((l) => l.id === id);
  if (!look) throw Error("Choose an available restaurant look.");
  return {
    ...photoPresetFields(look.photoPreset),
    primary: look.primary,
    accent: look.accent,
    typography: look.typography,
    autoApply: true,
  };
}

export function normalizeBrandColor(value: string) {
  const hex = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex))
    return (
      "#" +
      [...hex]
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    );
  return /^[\da-f]{6}$/i.test(hex) ? "#" + hex.toLowerCase() : null;
}

export function readableBrandInk(color: string) {
  const hex = normalizeBrandColor(color) || "#ffffff";
  const values = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
export function brandTypeface(style: Record<string, any> = {}) {
  return (
    brandTypefaces.find((font) => font.id === style.typography) ||
    brandTypefaces[0]
  );
}
export function restaurantPhotoDefaults(restaurant: Record<string, any>) {
  const style = restaurant.style || {};
  if (!style.autoApply) return {};
  return {
    look: "restaurant",
    styleChosen: true,
    photoStyleSnapshot: style.photoStyle || null,
    photoReferenceIds: style.referenceIds || null,
    lookCategory:
      photoStyles.find((p) => p.id === style.photoPreset)?.category || "menu",
    surface: style.photoDefaults?.surface || "As shown",
    lighting: style.photoDefaults?.lighting || "As shown",
    plate: style.photoDefaults?.plate || "style",
    angle: style.photoDefaults?.angle || "keep",
    composition: style.photoDefaults?.composition || "Full dish",
  };
}

const photoSelectionKeys = [
  "look",
  "lookCategory",
  "surface",
  "lighting",
  "plate",
  "angle",
  "composition",
  "photoStyleSnapshot",
  "photoReferenceIds",
] as const;

export function restaurantPhotoSelection(
  draft: Record<string, any>,
  restaurant: Record<string, any>,
  enabled: boolean,
) {
  const selection = (value: Record<string, any>) =>
    Object.fromEntries(
      photoSelectionKeys
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, value[key]]),
    );
  if (enabled) {
    return {
      ...restaurantPhotoDefaults({
        style: { ...restaurant.style, autoApply: true },
      }),
      previousPhotoStyle:
        draft.look === "restaurant"
          ? draft.previousPhotoStyle || null
          : selection(draft),
    };
  }
  const previous = draft.previousPhotoStyle;
  const hasPrevious =
    previous &&
    (photoStyles.some((style) => style.id === previous.look) ||
      ["keep", "reference"].includes(previous.look));
  const fallback =
    photoStyles.find((style) => style.id === restaurant.style?.photoPreset) ||
    photoStyles.find((style) => style.id === "menu-stone")!;
  return {
    look: fallback.id,
    photoStyleSnapshot: null,
    photoReferenceIds: null,
    lookCategory: fallback.category,
    surface: "As shown",
    lighting: "As shown",
    plate: "style",
    angle: fallback.angle || "keep",
    composition: "Full dish",
    ...(hasPrevious ? selection(previous) : {}),
    styleChosen: true,
    previousPhotoStyle: null,
  };
}
export function brandPostFields(style: Record<string, any> = {}) {
  return {
    color: style.primary || "#202820",
    accent: style.accent || "#f0e3c3",
    typography: brandTypeface(style).id,
    brandMode: "restaurant",
  };
}
// Public menu data never needs the private photographic prompt or reference IDs.
export function publicBrandStyle(style: Record<string, any> = {}) {
  return {
    primary: /^#[0-9a-f]{6}$/i.test(style.primary) ? style.primary : "#202820",
    accent: /^#[0-9a-f]{6}$/i.test(style.accent) ? style.accent : "#f0e3c3",
    typography: brandTypeface(style).id,
  };
}
