import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile, stat } from "node:fs/promises";
let checks = 0;
// The served pdf.js worker must match the installed library exactly, or menu
// previews fail with a version mismatch. It is the legacy build, which carries
// the polyfills current browsers still need.
const pdfjsVersion = JSON.parse(
  await readFile("node_modules/pdfjs-dist/package.json", "utf8"),
).version;
const worker = await readFile("public/pdf.worker.legacy.min.mjs");
assert(
  worker.equals(
    await readFile("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"),
  ),
  `public/pdf.worker.legacy.min.mjs must be the pdfjs-dist ${pdfjsVersion} legacy worker`,
);
checks++;
// Homepage photos are lossy WebP copies (scripts/prepare-web-images.mjs).
// Each must match its source resized to the same width closely (PSNR against
// a lanczos resize: at least 34 dB at display sizes, 31 dB for the small
// thumbnails) and be smaller than that source.
function psnr(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return 10 * Math.log10((255 * 255) / (sum / a.length));
}
const styles = ["color", "angle", "hand", "closeup"];
const { libraryStyleCount, showcaseStyles } =
  await import("../lib/homepage-showcase.ts");
for (const [source, prefix, widths] of [
  [
    "public/burger-phone-original.jpg",
    "public/homepage/optimized/burger-before",
    [640, 960, 1280, 1536],
  ],
  [
    "public/burger-studio-transformation.png",
    "public/homepage/optimized/burger-after",
    [640, 960, 1280, 1536],
  ],
  [
    "public/homepage/restaurants.webp",
    "public/homepage/optimized/restaurants",
    [320, 480, 640, 800],
  ],
  [
    "public/homepage/menus.webp",
    "public/homepage/optimized/menus",
    [320, 480, 640, 800],
  ],
  [
    "public/homepage/social-post-example.webp",
    "public/homepage/optimized/social-post-example",
    [320, 480],
  ],
  ...styles.map((style) => [
    `public/homepage/styles/cheesecake-${style}.webp`,
    `public/homepage/styles/cheesecake-${style}`,
    [160, 320, 480, 640, 960, 1254],
  ]),
  [
    "public/homepage/styles/cheesecake-original.jpg",
    "public/homepage/styles/cheesecake-original",
    [320, 640, 960, 1280],
  ],
  ...showcaseStyles.map(({ id }) => [
    `public/studio/styles/${id}.webp`,
    `public/homepage/showcase/${id}`,
    [640],
  ]),
]) {
  for (const width of widths) {
    const optimized = `${prefix}-${width}.webp`;
    const reference = await sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true, kernel: "lanczos3" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = await sharp(optimized)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.deepEqual(
      [decoded.info.width, decoded.info.height],
      [reference.info.width, reference.info.height],
      optimized,
    );
    checks++;
    const fidelity = psnr(reference.data, decoded.data);
    assert(
      fidelity >= (width >= 640 ? 34 : 31),
      `${optimized} drifts from its source (${fidelity.toFixed(1)} dB)`,
    );
    checks++;
    assert((await stat(optimized)).size < (await stat(source)).size);
    checks++;
  }
}
// Weight budgets: the hero pair a desktop or 3x phone downloads, the one
// gallery photo shown at a time, and each showcase tile on a sharp screen.
const kb = async (path) => (await stat(path)).size / 1024;
const hero =
  (await kb("public/homepage/optimized/burger-before-1536.webp")) +
  (await kb("public/homepage/optimized/burger-after-1536.webp"));
assert(hero <= 300, `hero pair is ${Math.round(hero)} KB`);
checks++;
for (const style of styles) {
  const size = await kb(`public/homepage/styles/cheesecake-${style}-960.webp`);
  assert(size <= 150, `cheesecake-${style}-960.webp is ${Math.round(size)} KB`);
  checks++;
}
for (const { id } of showcaseStyles) {
  const size = await kb(`public/homepage/showcase/${id}-640.webp`);
  assert(size <= 100, `${id}-640.webp is ${Math.round(size)} KB`);
  checks++;
}
// Every catalog example has a small tile preview of the same scene.
const { photoStyles, styleThumbnail } = await import("../lib/photo-styles.ts");
for (const style of photoStyles) {
  const thumbnail = "public" + styleThumbnail(style.image);
  assert.notEqual(thumbnail, "public" + style.image, style.id);
  const metadata = await sharp(thumbnail).metadata();
  assert.deepEqual([metadata.width, metadata.height], [400, 400], thumbnail);
  assert(
    (await stat(thumbnail)).size < (await stat("public" + style.image)).size,
  );
  checks += 3;
}
// The homepage showcase keeps its own copy of the names it shows, so the
// catalog's prompts stay out of the homepage bundle. It must name real,
// current styles and count the whole library correctly.
const catalog = photoStyles.filter((style) => !style.legacy);
assert.equal(libraryStyleCount, catalog.length, "libraryStyleCount");
checks++;
assert.equal(
  new Set(showcaseStyles.map((style) => style.id)).size,
  showcaseStyles.length,
  "the showcase repeats a style",
);
checks++;
for (const { id, name } of showcaseStyles) {
  assert.equal(catalog.find((style) => style.id === id)?.name, name, id);
  checks++;
}
console.log(
  `PASS: ${checks} display-asset checks: homepage photos match their sources at every display size (PSNR), stay within weight budgets and are smaller than their sources; every style tile has a smaller 400 px preview; the homepage showcase names current catalog styles. Full-resolution originals and export settings are untouched.`,
);
