// Display-only derivatives. Uploaded originals, AI settings and exports are untouched.
//
//   node scripts/prepare-web-images.mjs            # everything
//   node scripts/prepare-web-images.mjs homepage   # homepage photos only
//   node scripts/prepare-web-images.mjs studio     # style-tile previews only
//   node scripts/prepare-web-images.mjs site       # link-preview image, favicon.ico
//
// Every derivative is resized from an unchanged source (never from another
// derivative), so re-running the script does not compound compression loss.
// Sizes and the reasoning behind these settings: docs/HOMEPAGE_IMAGES.md.
import sharp from "sharp";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
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

if (!only || only === "site") {
  // Link-preview image (og:image, app/site-metadata.ts): the hero's phone
  // photo and studio edit side by side at the 1200 × 630 size preview cards
  // use, with the hero's own tags. Some apps skip preview images over about
  // 300 KB, so it is a compact JPEG.
  const { createCanvas, GlobalFonts } = await import("@napi-rs/canvas");
  GlobalFonts.registerFromPath("public/fonts/MenuSans-Bold.ttf", "Menu Sans");
  const width = 1200,
    height = 630,
    gap = 4,
    panel = (width - gap) / 2;
  // Crop each photo to the panel's shape around the burger; `zoom` evens out
  // the burger's size between the two photos.
  async function panelFrom(source, centerX, centerY, zoom) {
    const { width: w, height: h } = await sharp(source).rotate().metadata();
    const cropHeight = Math.round(h / zoom);
    const cropWidth = Math.round((cropHeight * panel) / height);
    const clamp = (value, max) => Math.min(max, Math.max(0, Math.round(value)));
    return sharp(source)
      .rotate()
      .extract({
        left: clamp(w * centerX - cropWidth / 2, w - cropWidth),
        top: clamp(h * centerY - cropHeight / 2, h - cropHeight),
        width: cropWidth,
        height: cropHeight,
      })
      .resize(panel, height, { kernel: "lanczos3" })
      .toBuffer();
  }
  function tag(text) {
    const probe = createCanvas(1, 1).getContext("2d");
    probe.font = '26px "Menu Sans"';
    const tagWidth = Math.ceil(probe.measureText(text).width) + 36,
      tagHeight = 46;
    const canvas = createCanvas(tagWidth, tagHeight);
    const context = canvas.getContext("2d");
    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.beginPath();
    context.roundRect(0, 0, tagWidth, tagHeight, tagHeight / 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = '26px "Menu Sans"';
    context.textBaseline = "middle";
    context.fillText(text, 18, tagHeight / 2 + 1);
    return canvas.toBuffer("image/png");
  }
  const share = "public/menu-material-share.jpg";
  await sharp({ create: { width, height, channels: 3, background: "#fff" } })
    .composite([
      {
        input: await panelFrom(
          "public/burger-phone-original.jpg",
          0.474,
          0.42,
          1.18,
        ),
        left: 0,
        top: 0,
      },
      {
        input: await panelFrom(
          "public/burger-studio-transformation.png",
          0.49,
          0.47,
          1,
        ),
        left: panel + gap,
        top: 0,
      },
      { input: tag("Phone photo"), left: 28, top: 28 },
      { input: tag("Studio"), left: panel + gap + 28, top: 28 },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(share);
  console.log(share, (await stat(share)).size);

  // /favicon.ico for browsers and services that ask for it directly. Pages
  // link the SVG icon; this holds PNG renders of it at the classic sizes.
  const sizes = [16, 32, 48];
  const images = await Promise.all(
    sizes.map((size) =>
      sharp("public/favicon.svg", { density: (72 * size) / 64 })
        .resize(size, size)
        .png()
        .toBuffer(),
    ),
  );
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2); // Icon resource
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4); // Color planes
    header.writeUInt16LE(32, entry + 6); // Bits per pixel
    header.writeUInt32LE(images[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  });
  await writeFile("public/favicon.ico", Buffer.concat([header, ...images]));
  console.log("public/favicon.ico", (await stat("public/favicon.ico")).size);
}
