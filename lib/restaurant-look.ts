import { photoStyles } from "./photo-styles";

export const brandTypefaces = [
  {
    id: "modern",
    name: "Clean & modern",
    family: "Post Sans",
    file: "DMSans-Variable.ttf",
    sample: "Fresh from our kitchen",
  },
  {
    id: "editorial",
    name: "Warm & editorial",
    family: "Post Serif",
    file: "CormorantGaramond-Variable.ttf",
    sample: "A taste of something special",
  },
  {
    id: "bold",
    name: "Bold & expressive",
    family: "Post Condensed",
    file: "BarlowCondensed-Bold.ttf",
    sample: "Made to be craved",
  },
] as const;
export type BrandTypography = (typeof brandTypefaces)[number]["id"];
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
    lookCategory:
      photoStyles.find((p) => p.id === style.photoPreset)?.category || "menu",
    surface: style.photoDefaults?.surface || "As shown",
    lighting: style.photoDefaults?.lighting || "As shown",
    plate: style.photoDefaults?.plate || "keep",
    angle: style.photoDefaults?.angle || "keep",
    composition: style.photoDefaults?.composition || "Full dish",
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
