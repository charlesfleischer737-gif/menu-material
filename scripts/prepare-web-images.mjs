// Display-only derivatives. Uploaded originals, AI settings and exports are untouched.
import sharp from "sharp";
import { mkdir, stat, unlink } from "node:fs/promises";
await mkdir("public/homepage/optimized", { recursive: true });
for (const [name, source] of [
  ["burger-before", "public/burger-phone-original.jpg"],
  ["burger-after", "public/burger-studio-transformation.png"],
]) {
  const metadata = await sharp(source).metadata();
  for (const width of [
    ...new Set(
      [640, 960, 1536, metadata.width].filter((w) => w <= metadata.width),
    ),
  ]) {
    const path = `public/homepage/optimized/${name}-${width}.webp`;
    await sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true, kernel: "lanczos3" })
      .webp({ lossless: true, effort: 6 })
      .toFile(path);
    const size = (await stat(path)).size;
    if (size >= (await stat(source)).size) {
      await unlink(path);
      console.log("Original is smaller; retain original:", path);
    } else console.log(path, size);
  }
}
