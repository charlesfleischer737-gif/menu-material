import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  createCanvas,
  loadImage,
  DOMMatrix,
  Path2D,
  ImageData,
} from "@napi-rs/canvas";
import { unzipSync, strFromU8 } from "fflate";
const root = "/private/tmp/plated-export-qa";
mkdirSync(root, { recursive: true });
const jpg = readFileSync("public/burger.jpg"),
  pasta = readFileSync("public/pasta.jpg");
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData });
function canvas() {
  const c = createCanvas(1, 1);
  c.toBlob = (cb, type = "image/png", quality = 0.94) =>
    cb(
      new Blob(
        [
          c.toBuffer(
            type,
            type === "image/jpeg" ? Math.round(quality * 100) : undefined,
          ),
        ],
        { type },
      ),
    );
  return c;
}
globalThis.document = {
  createElement: (tag) => {
    assert.equal(tag, "canvas");
    return canvas();
  },
};
globalThis.createImageBitmap = async (blob) => {
  const im = await loadImage(Buffer.from(await blob.arrayBuffer()));
  im.close = () => {};
  return im;
};
globalThis.fetch = async (url) => {
  const path = String(url);
  if (path.startsWith("/fonts/"))
    return new Response(readFileSync("public" + path));
  if (path.startsWith("/api/assets/"))
    return new Response(path.includes("pasta") ? pasta : jpg, {
      headers: { "Content-Type": "image/jpeg" },
    });
  throw Error("Unexpected export request " + path);
};
const { menuPdf, renderPost, campaignZip, photoExport } =
  await import("../lib/creation-export.ts");
const restaurant = {
  name: "The Orchard Kitchen",
  slug: "orchard",
  currency: "USD",
  style: { primary: "#235b48", accent: "#e7efb7" },
};
const items = [
  {
    name: "Tomato basil pappardelle",
    description: "Pappardelle with tomato sauce and basil.",
    price: 1850,
    available: true,
    photoId: "pasta",
  },
  {
    name: "The house burger",
    description: "Our house burger.",
    price: 1600,
    available: true,
    photoId: "burger",
  },
];
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
let checks = 0;
for (const layout of ["classic", "grid", "featured"])
  for (const paper of ["letter", "a4"]) {
    const result = await menuPdf({
      restaurant,
      sections: [{ name: "Mains", items }],
      layout,
      paper,
      appearance: "light",
    });
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    writeFileSync(`${root}/menu-${layout}-${paper}.pdf`, bytes);
    const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const text = (await page.getTextContent()).items
      .map((i) => i.str)
      .join(" ");
    assert(
      text.includes("18.50") &&
        text.includes("16.00") &&
        text.includes("The house burger"),
    );
    assert.equal(pdf.numPages, 1);
    const viewport = page.getViewport({ scale: 1.3 }),
      c = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({
      canvas: c,
      canvasContext: c.getContext("2d"),
      viewport,
    }).promise;
    writeFileSync(
      `${root}/menu-${layout}-${paper}.png`,
      c.toBuffer("image/png"),
    );
    await task.destroy();
    checks++;
  }
const draft = {
  title: "The house burger",
  description: "Our house burger.",
  price: "14.50",
  showPrice: true,
  validity: "Tonight · 5–9 pm",
  color: "#235b48",
  template: "price",
  items: [
    {
      photoId: "burger",
      name: "The house burger",
      dishId: "burger",
      quantity: 1,
    },
  ],
  layouts: {},
  caption: "The house burger\n$14.50\nTonight · 5–9 pm",
  channels: ["feed", "story"],
};
for (const template of ["photo", "price", "story"])
  for (const channel of ["feed", "story"]) {
    const c = canvas();
    await renderPost(c, { ...draft, template }, restaurant, channel);
    assert.equal(c.width, 1080);
    assert.equal(c.height, channel === "story" ? 1920 : 1350);
    writeFileSync(
      `${root}/post-${template}-${channel}.png`,
      c.toBuffer("image/png"),
    );
    checks++;
  }
const combined = {
  ...draft,
  occasion: "combo",
  title: "Dinner for two",
  channels: ["feed", "story", "carousel"],
  items: [
    ...draft.items,
    {
      photoId: "pasta",
      dishId: "pasta",
      name: "Tomato basil pappardelle",
      quantity: 2,
    },
  ],
};
const zip = await campaignZip(combined, restaurant),
  files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
assert.equal(Object.keys(files).length, 5);
assert.equal(strFromU8(files["caption.txt"]), draft.caption);
writeFileSync(`${root}/campaign.zip`, new Uint8Array(await zip.arrayBuffer()));
for (const [name, bytes] of Object.entries(files)) {
  if (!name.endsWith(".png")) continue;
  const im = await loadImage(Buffer.from(bytes));
  assert.equal(im.width, 1080);
  assert.equal(im.height, name.includes("story") ? 1920 : 1350);
  writeFileSync(`${root}/${name}`, bytes);
  checks++;
}
const delivery = await photoExport("burger", "uber");
assert.equal(delivery.blob.type, "image/jpeg");
assert(delivery.width >= 550 && delivery.height >= 440);
checks++;
console.log(
  `PASS: ${checks} exported PDF/image checks, embedded-text prices, US Letter/A4, all three post templates, independent feed/story dimensions, carousel ZIP and clean delivery JPEG. Artifacts: ${root}`,
);
