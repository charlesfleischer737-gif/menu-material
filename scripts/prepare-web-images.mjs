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

// Style tiles show examples at up to ~200 CSS px. Small lossy previews keep
// the studio and style library light; the full examples stay for details.
await mkdir("public/studio/styles/thumbs", { recursive: true });
const { readdir } = await import("node:fs/promises");
for (const file of (await readdir("public/studio/styles")).filter((name) =>
  name.endsWith(".webp"),
)) {
  const path = `public/studio/styles/thumbs/${file}`;
  await sharp(`public/studio/styles/${file}`)
    .resize({ width: 400, height: 400, fit: "cover", kernel: "lanczos3" })
    .webp({ quality: 82, effort: 6 })
    .toFile(path);
  console.log(path, (await stat(path)).size);
}
