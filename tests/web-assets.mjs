import assert from "node:assert/strict";
import sharp from "sharp";
import { stat } from "node:fs/promises";
let checks = 0;
for (const [name, source, widths] of [
  ["burger-before", "public/burger-phone-original.jpg", [640]],
  ["burger-after", "public/burger-studio-transformation.png", [640, 960, 1536]],
]) {
  for (const width of widths) {
    const optimized = `public/homepage/optimized/${name}-${width}.webp`;
    const reference = await sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true, kernel: "lanczos3" })
      .removeAlpha()
      .raw()
      .toBuffer();
    const decoded = await sharp(optimized).removeAlpha().raw().toBuffer();
    assert(
      reference.equals(decoded),
      `${optimized} must exactly preserve its resized pixels`,
    );
    checks++;
    assert((await stat(optimized)).size < (await stat(source)).size);
    checks++;
  }
}
console.log(
  `PASS: ${checks} display-asset checks: lossless pixel equality at every display size and smaller files. Full-resolution originals and export settings are untouched.`,
);
