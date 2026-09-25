// Display-only derivatives. Uploaded originals, AI settings and exports are untouched.
//
//   node scripts/prepare-web-images.mjs            # everything
//   node scripts/prepare-web-images.mjs homepage   # homepage photos only
//   node scripts/prepare-web-images.mjs studio     # style-tile previews only
//
// Every derivative is resized from an unchanged source (never from another
// derivative), so re-running the script does not compound compression loss.
// Sizes and the reasoning behind these settings: docs/HOMEPAGE_IMAGES.md.
import sharp from "sharp";
import { mkdir, readdir, stat } from "node:fs/promises";
import { showcaseStyles } from "../lib/homepage-showcase.ts";

// Lossy WebP tuned for photographs: quality 82 with sharp YUV conversion
// ("smartSubsample") keeps red-on-blue edges and fine crumb texture clean at
// about a tenth of the lossless size.
const photoWebp = { quality: 82, smartSubsample: true, effort: 6 };

const only = process.argv[2];

async function derive(source, path, width) {
  await sharp(source)
    .rotate()
    .resize({ width, withoutEnlargement: true, kernel: "lanczos3" })
    .webp(photoWebp)
    .toFile(path);
  const size = (await stat(path)).size;
  if (size >= (await stat(source)).size)
    throw new Error(`${path} is not smaller than ${source}`);
  console.log(path, size);
}

if (!only || only === "homepage") {
  // Hero comparison. The phone photo is 4:3 and the studio edit 3:2; both
  // cover the same frame, so they share widths.
  await mkdir("public/homepage/optimized", { recursive: true });
  for (const [name, source] of [
    ["burger-before", "public/burger-phone-original.jpg"],
    ["burger-after", "public/burger-studio-transformation.png"],
  ])
    for (const width of [640, 960, 1280, 1536])
      await derive(
        source,
        `public/homepage/optimized/${name}-${width}.webp`,
        width,
      );

  // Use-case cards show these at roughly 220–300 CSS px. The 960 px sources
  // stay as the largest candidate for 3x phones.
  for (const [name, widths] of [
    ["restaurants", [320, 480, 640, 800]],
    ["menus", [320, 480, 640, 800]],
    ["social-post-example", [320, 480]],
  ])
    for (const width of widths)
      await derive(
        `public/homepage/${name}.webp`,
        `public/homepage/optimized/${name}-${width}.webp`,
        width,
      );

  // Style gallery: responsive copies of the lossless 1254 px masters and of
  // the original JPEG. The masters themselves are never served.
  for (const style of ["color", "angle", "hand", "closeup"])
    for (const width of [160, 320, 480, 640, 960, 1254])
      await derive(
        `public/homepage/styles/cheesecake-${style}.webp`,
        `public/homepage/styles/cheesecake-${style}-${width}.webp`,
        width,
      );
  for (const width of [320, 640, 960, 1280])
    await derive(
      "public/homepage/styles/cheesecake-original.jpg",
      `public/homepage/styles/cheesecake-original-${width}.webp`,
      width,
    );

  // Showcase wall: tiles are at most 300 CSS px, so 640 px copies cover 2x
  // desktops and 3x phones. The 400 px style-tile previews serve the rest.
  await mkdir("public/homepage/showcase", { recursive: true });
  for (const { id } of showcaseStyles)
    await derive(
      `public/studio/styles/${id}.webp`,
      `public/homepage/showcase/${id}-640.webp`,
      640,
    );
}

if (!only || only === "studio") {
  // Style tiles show examples at up to ~200 CSS px. Small lossy previews keep
  // the studio and style library light; the full examples stay for details.
  await mkdir("public/studio/styles/thumbs", { recursive: true });
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
}
