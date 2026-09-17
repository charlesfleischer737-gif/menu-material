import { photoStyles, styleCategories } from "./photo-styles";

// Lead with a mix of subjects, light and color, then weave the collections
// together so browsing feels like a gallery rather than a category catalog.
const featured = [
  "studio-color",
  "bakery-blue",
  "fine-presented",
  "menu-wood",
  "beverage-ritual",
  "delivery-white",
  "bar-rooftop",
  "bakery-morning",
  "studio-sunbeam",
];
const interleaved = Array.from({ length: photoStyles.length }, (_, index) => {
  const category = styleCategories[index % styleCategories.length].id;
  return photoStyles.filter((style) => style.category === category)[
    Math.floor(index / styleCategories.length)
  ]?.id;
});
export const exploreStyles = [
  ...new Set([
    ...featured,
    ...interleaved,
    ...photoStyles.map((style) => style.id),
  ]),
].flatMap((id) =>
  photoStyles.filter((style) => style.id === id && !style.legacy),
);
