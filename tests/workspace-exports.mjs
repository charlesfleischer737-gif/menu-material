import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  createCanvas,
  GlobalFonts,
  loadImage,
  DOMMatrix,
  Path2D,
  ImageData,
} from "@napi-rs/canvas";
import { unzipSync, strFromU8 } from "fflate";
const { postFonts } = await import("../lib/post-fonts.ts");
for (const f of postFonts)
  assert(
    GlobalFonts.registerFromPath("public/fonts/social/" + f.file, f.family),
  );
const root = "/private/tmp/menu-workspace-export-qa";
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
  if (path.startsWith("data:image/png;base64,"))
    return new Response(Buffer.from(path.split(",")[1], "base64"));
  if (path.startsWith("/studio/styles/"))
    return new Response(readFileSync("public" + path));
  if (path.startsWith("/fonts/"))
    return new Response(readFileSync("public" + path));
  if (path.startsWith("/api/assets/"))
    return new Response(path.includes("pasta") ? pasta : jpg, {
      headers: { "Content-Type": "image/jpeg" },
    });
  throw Error("Unexpected export request " + path);
};
const { menuPdf, renderPost, campaignZip, photoExport, masterPhotoExport } =
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
const { postTemplates, applyPostTemplate } =
  await import("../lib/post-templates.ts");
const { postSlideCount } = await import("../lib/post-composition.ts");
const { menuDesigns } = await import("../lib/menu-design.ts");
const { PDFDocument } = await import("pdf-lib");
let checks = 0;
const base = {
  compositionVersion: 2,
  brandMode: "restaurant",
  color: "#235b48",
  accent: "#e7efb7",
  typography: "editorial",
  title: "Tomato basil pappardelle",
  description: "Pappardelle with tomato sauce and basil.",
  showPrice: true,
  price: "18.50",
  validity: "Tonight · 5–9 pm",
  items: [
    {
      dishId: "pasta",
      photoId: "pasta",
      name: "Tomato basil pappardelle",
      quantity: 1,
    },
  ],
  channels: ["feed", "story"],
  layouts: {},
  caption: "Tomato basil pappardelle. $18.50. Tonight, 5–9pm.",
};
const sheet = createCanvas(5 * 300, 2 * 440),
  sc = sheet.getContext("2d");
sc.fillStyle = "#e9ede5";
sc.fillRect(0, 0, sheet.width, sheet.height);
for (const [index, t] of postTemplates.entries())
  for (const channel of ["feed", "story"]) {
    const draft = { ...base, ...applyPostTemplate(base, t.id) },
      c = canvas();
    const result = await renderPost(c, draft, restaurant, channel);
    assert.equal(c.width, 1080);
    assert.equal(c.height, channel === "story" ? 1920 : 1350);
    for (const box of result.textBoxes) {
      assert(box.fontSize >= 36, `${t.id}: phone-size type floor`);
      assert(
        box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= 1081 &&
          box.y + box.height <= c.height,
        `${t.id}: text cannot leave the canvas`,
      );
      if (channel === "story") {
        assert(box.y >= 174);
        assert(box.y + box.height <= 1920 - 174);
      }
    }
    writeFileSync(
      `${root}/post-${t.id}-${channel}.png`,
      c.toBuffer("image/png"),
    );
    if (channel === "feed") {
      const x = (index % 5) * 300 + 10,
        y = Math.floor(index / 5) * 440 + 10;
      sc.drawImage(c, x, y, 280, 350);
      sc.fillStyle = "#24362a";
      sc.font = '16px "Post Sans"';
      sc.fillText(t.name, x, y + 375);
    }
    checks++;
  }
writeFileSync(`${root}/post-designs.jpg`, sheet.toBuffer("image/jpeg"));
const longBrand = {
  ...restaurant,
  name: "The Orchard Kitchen and Neighborhood Dining Room",
};
await renderPost(
  canvas(),
  { ...base, template: "chef", showBrand: true, textMode: "minimal" },
  longBrand,
);
checks++;
const longDescription = await renderPost(
  canvas(),
  {
    ...base,
    template: "special",
    textMode: "full",
    description:
      "Our pappardelle, prepared in the kitchen with tomato sauce and fresh basil. A dish made for a relaxed evening around your table.",
  },
  restaurant,
);
assert(longDescription.warnings.some((w) => w.includes("caption")));
checks++;
await assert.rejects(
  () =>
    renderPost(
      canvas(),
      {
        ...base,
        title: "A very long headline repeated ".repeat(10),
        textMode: "minimal",
      },
      restaurant,
    ),
  /too long to read comfortably/,
);
checks++;
const carousel = {
  ...base,
  template: "chef",
  textMode: "minimal",
  showBrand: true,
  carouselCover: true,
  carouselClosing: "Come by for dinner",
  items: [
    ...base.items,
    {
      dishId: "burger",
      photoId: "burger",
      name: "The house burger",
      headline: "Your table is ready",
      quantity: 1,
      layouts: { carousel: { fit: false, x: 30, y: 50, zoom: 1.5 } },
    },
  ],
  channels: ["carousel"],
};
assert.equal(postSlideCount(carousel, "carousel"), 4);
for (let n = 0; n < 4; n++) {
  const c = canvas(),
    result = await renderPost(c, carousel, restaurant, "carousel", n);
  if (n === 1) assert(result.renderedText.includes(base.items[0].name));
  if (n === 2) {
    assert(result.renderedText.includes("Your table is ready"));
    assert(result.warnings.some((w) => w.includes("fill crop")));
  }
  writeFileSync(`${root}/carousel-${n + 1}.png`, c.toBuffer("image/png"));
  checks++;
}
const zip = unzipSync(
  new Uint8Array(await (await campaignZip(carousel, restaurant)).arrayBuffer()),
);
assert.equal(Object.keys(zip).filter((k) => k.endsWith(".png")).length, 4);
checks++;
// Per-slide framing must change only the selected slide's pixels.
const revised = structuredClone(carousel);
revised.items[1].layouts.carousel.x = 90;
for (const n of [1, 2]) {
  const a = canvas(),
    b = canvas();
  await renderPost(a, carousel, restaurant, "carousel", n);
  await renderPost(b, revised, restaurant, "carousel", n);
  assert.equal(
    a.toBuffer("image/png").equals(b.toBuffer("image/png")),
    n === 1,
  );
  checks++;
}
for (const d of menuDesigns)
  for (const paper of ["letter", "a4"])
    for (const printProfile of ["home", "press"]) {
      const menu = {
        restaurant,
        design: d.id,
        density: d.id === "fine" ? "spacious" : "comfortable",
        title: "Dinner",
        layout: "featured",
        appearance: "light",
        paper,
        printProfile,
        sections: [
          {
            id: "mains",
            name: "From our kitchen",
            items: items.map((i, n) => ({
              ...i,
              featured: n === 1,
              crop: { fit: false, x: 65, y: 40, zoom: 1.1 },
            })),
          },
        ],
      };
      const result = await menuPdf(menu),
        bytes = new Uint8Array(await result.blob.arrayBuffer()),
        doc = await PDFDocument.load(bytes);
      assert.equal(doc.getPageCount(), 1);
      const first = doc.getPage(0),
        trim = first.getTrimBox();
      assert(Math.abs(trim.width - (paper === "a4" ? 595.28 : 612)) < 0.01);
      if (printProfile === "press") {
        assert.equal(trim.x, 24);
        assert.equal(first.getBleedBox().x, 15);
        assert(result.warnings.some((w) => /RGB color/.test(w)));
      } else assert.equal(first.getWidth(), paper === "a4" ? 595.28 : 612);
      const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
      const pdf = await task.promise,
        page = await pdf.getPage(1),
        content = (await page.getTextContent()).items
          .map((i) => i.str)
          .join(" ");
      assert(
        content.includes("18.50") &&
          content.includes("16.00") &&
          content.toLowerCase().includes("dinner"),
      );
      if (paper === "letter" && printProfile === "home") {
        const viewport = page.getViewport({ scale: 1.3 }),
          c = createCanvas(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height),
          );
        await page.render({
          canvas: c,
          canvasContext: c.getContext("2d"),
          viewport,
        }).promise;
        writeFileSync(`${root}/menu-${d.id}.png`, c.toBuffer("image/png"));
      }
      writeFileSync(`${root}/menu-${d.id}-${paper}-${printProfile}.pdf`, bytes);
      await task.destroy();
      checks++;
    }
// Long multi-section menus: no isolated section heading and no off-page text.
for (const layout of ["classic", "grid"]) {
  const sections = Array.from({ length: 6 }, (_, s) => ({
    id: String(s),
    name: `Section ${s + 1}`,
    items: Array.from({ length: 10 }, (_, i) => ({
      name: `Dish ${s + 1}-${i + 1}`,
      description:
        "Prepared with care in our kitchen. A generous dish to enjoy around the table, with a carefully balanced finish.",
      price: 1250 + i * 25,
      available: i !== 3,
    })),
  }));
  const result = await menuPdf({
    restaurant,
    sections,
    layout,
    paper: "a4",
    design: "fine",
    density: "comfortable",
  });
  const task = pdfjs.getDocument({
      data: new Uint8Array(await result.blob.arrayBuffer()),
      useSystemFonts: true,
    }),
    pdf = await task.promise;
  assert(pdf.numPages > 2);
  let total = "";
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n),
      content = await page.getTextContent(),
      text = content.items.map((i) => i.str).join(" ");
    total += text;
    for (const section of sections)
      if (text.toLowerCase().includes(section.name.toLowerCase()))
        assert(
          section.items.some((i) => text.includes(i.name)),
          `Orphan heading on ${layout} page ${n}`,
        );
    for (const t of content.items)
      if (t.str.trim()) {
        assert(
          t.transform[5] > 15 && t.transform[5] < 842,
          `Print text out of bounds: ${t.str}`,
        );
      }
  }
  for (const section of sections)
    for (const item of section.items) assert(total.includes(item.name));
  await task.destroy();
  checks++;
}
console.log(
  `PASS: ${checks} new composition/export cases, all designs and paper profiles, phone-size type and Story safety, independent carousel framing, searchable PDFs, print trim/bleed, 60-dish pagination. Artifacts: ${root}`,
);
