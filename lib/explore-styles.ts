import { photoStyles, styleCategories, type PhotoStyle } from "./photo-styles";

// Lead with a mix of subjects, light and color, then weave the collections
// together so browsing feels like a gallery rather than a category catalog.
const featured = [
  "studio-color",
  "beverage-ritual",
  "menu-wood",
  "bakery-morning",
  "delivery-white",
  "bakery-blue",
  "studio-sunbeam",
  "fine-linen",
  "bar-speakeasy",
];
// The most striking photographs open each part of the lookbook at double size.
const spotlight = [
  "studio-color",
  "bar-rooftop",
  "fine-presented",
  "beverage-poolside",
  "bakery-paris",
  "studio-levitate",
];
const interleaved = Array.from({ length: photoStyles.length }, (_, index) => {
  const category = styleCategories[index % styleCategories.length].id;
  return photoStyles.filter((style) => style.category === category)[
    Math.floor(index / styleCategories.length)
  ]?.id;
});

export type LookbookEntry = { style: PhotoStyle; feature: boolean };

// Every 26 looks form one part: a double-size feature beside four looks, eight
// looks, two looks, a second feature beside two more, then eight looks. Rows
// stay complete in two and four columns, so a feature is only placed where
// enough looks follow to fill the rows beside it.
function featureSlot(index: number, total: number) {
  const slot = index % 26;
  return (
    (slot === 0 && total - index > 4) || (slot === 15 && total - index > 2)
  );
}

/** Arranges looks for the gallery, placing spotlight photographs in the feature slots. */
export function lookbook(styles: PhotoStyle[]): LookbookEntry[] {
  const slots = styles.map((_, index) => featureSlot(index, styles.length));
  const features = spotlight
    .flatMap((id) => styles.filter((style) => style.id === id))
    .slice(0, slots.filter(Boolean).length);
  const rest = styles.filter((style) => !features.includes(style));
  let next = 0;
  return slots.map((feature) => ({
    style: (feature && features.shift()) || rest[next++],
    feature,
  }));
}

export const exploreStyles = lookbook(
  [
    ...new Set([
      ...featured,
      ...interleaved,
      ...photoStyles.map((style) => style.id),
    ]),
  ].flatMap((id) =>
    photoStyles.filter((style) => style.id === id && !style.legacy),
  ),
).map((entry) => entry.style);
