// No imports: tests/web-assets.mjs loads this file with plain Node.

// The style photos in public/studio/styles/ are 1254 px wide, except the
// original catalog's, which are 1000 px. tests/web-assets.mjs checks this list
// against the files.
export const thousandPixelStyles = new Set([
  "bakery-jewel",
  "bakery-morning",
  "bakery-patisserie",
  "bakery-rustic",
  "bar-bluehour",
  "bar-candle",
  "bar-speakeasy",
  "bar-velvet",
  "beverage-backlit",
  "beverage-cafe",
  "beverage-citrus",
  "beverage-matcha",
  "delivery-daylight",
  "delivery-overhead",
  "delivery-takeout",
  "delivery-white",
  "fine-candle",
  "fine-counter",
  "fine-linen",
  "fine-slate",
  "menu-neutral",
  "menu-overhead",
  "menu-stone",
  "menu-wood",
  "studio-color",
  "studio-dark",
  "studio-ivory",
  "studio-pastel",
]);

/**
 * Responsive candidates for a style photo: its 400 px preview, the 640 px and
 * (for 1254 px photos) 960 px copies from scripts/prepare-web-images.mjs, and
 * the photo itself at its real width.
 */
export function styleImageSrcSet(image: string) {
  const id = image.match(/^\/studio\/styles\/([^/]+)\.webp$/)?.[1];
  if (!id) return undefined;
  const small = thousandPixelStyles.has(id);
  return [
    `/studio/styles/thumbs/${id}.webp 400w`,
    `/studio/styles/640/${id}.webp 640w`,
    // A 960 px copy of a 1000 px photo would save next to nothing.
    ...(small ? [] : [`/studio/styles/960/${id}.webp 960w`]),
    `${image} ${small ? 1000 : 1254}w`,
  ].join(", ");
}
