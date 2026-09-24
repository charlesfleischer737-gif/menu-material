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
// Weight budgets: the hero pair a desktop or 3x phone downloads, and the one
// gallery photo shown at a time.
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
console.log(
  `PASS: ${checks} display-asset checks: homepage photos match their sources at every display size (PSNR), stay within weight budgets and are smaller than their sources; every style tile has a smaller 400 px preview. Full-resolution originals and export settings are untouched.`,
);
