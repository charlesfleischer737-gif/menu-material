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
const { postTemplates, applyPostTemplate, postTemplateExample } =
  await import("../lib/post-templates.ts");
const { brandTypefaces, brandPostFields } =
  await import("../lib/restaurant-look.ts");
for (const font of brandTypefaces) {
  const branded = {
    ...restaurant,
    style: { ...restaurant.style, typography: font.id, autoApply: true },
  };
  const pdf = await menuPdf({
    restaurant: branded,
    sections: [{ name: "Mains", items }],
    layout: "featured",
    paper: "letter",
    appearance: "light",
  });
  const pdfTask = pdfjs.getDocument({
    data: new Uint8Array(await pdf.blob.arrayBuffer()),
    useSystemFonts: true,
  });
  const document = await pdfTask.promise;
  const page = await document.getPage(1);
  const text = (await page.getTextContent()).items
    .map((item) => item.str)
    .join(" ");
  assert(
    text.includes(restaurant.name) && text.includes("18.50"),
    `${font.id} print menu preserves name and price`,
  );
  await pdfTask.destroy();
  checks++;
  for (const template of postTemplates) {
    for (const channel of ["feed", "story"]) {
      const styled = { ...draft, ...brandPostFields(branded.style) };
      const design = {
        ...styled,
        ...applyPostTemplate(styled, template.id),
        textMode: "full",
      };
      const c = canvas();
      const rendered = await renderPost(c, design, branded, channel);
      for (const box of rendered.textBoxes) {
        assert(
          box.x >= 35 && box.x + box.width <= 1045,
          `${font.id}/${template.id}/${channel} fits horizontal margins`,
        );
        assert(
          box.y >= (channel === "story" ? 150 : 40) &&
            box.y + box.height <= (channel === "story" ? 1780 : 1320),
          `${font.id}/${template.id}/${channel} fits vertical safe areas`,
        );
      }
      checks++;
    }
  }
}
for (const template of [
  "photo",
  "price",
  "story",
  ...postTemplates.map((t) => t.id),
])
  for (const channel of ["feed", "story"]) {
    const c = canvas();
    const design = {
      ...draft,
      ...applyPostTemplate(draft, template),
      textMode: "full",
    };
    const result = await renderPost(c, design, restaurant, channel);
    assert(
      result.renderedText.some((t) =>
        t.toLowerCase().includes(design.title.toLowerCase()),
      ),
    );
    assert(result.renderedText.some((t) => t.includes("14.50")));
    assert(result.renderedText.some((t) => t.includes(draft.validity)));
    for (const box of result.textBoxes) {
      assert(
        box.x >= 35 && box.x + box.width <= 1045,
        `${template}/${channel}: text outside horizontal margin`,
      );
      assert(
        box.y >= (channel === "story" ? 150 : 40) &&
          box.y + box.height <= (channel === "story" ? 1780 : 1320),
        `${template}/${channel}: text outside safe area`,
      );
    }
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
for (const template of postTemplates)
  for (const channel of ["feed", "story"]) {
    const design = {
      ...combined,
      ...applyPostTemplate(combined, template.id),
      textMode: "full",
    };
    const c = canvas(),
      result = await renderPost(c, design, restaurant, channel);
    assert(
      result.renderedText.some((t) =>
        t.includes("2 × Tomato basil pappardelle"),
      ),
      `${template.id}: combo quantity missing`,
    );
    assert(
      result.renderedText.some((t) => t.includes("14.50")),
      `${template.id}: combo price missing`,
    );
    for (let i = 0; i < result.textBoxes.length; i++)
      for (let j = i + 1; j < result.textBoxes.length; j++) {
        const a = result.textBoxes[i],
          b = result.textBoxes[j];
        const overlapX =
            Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
          overlapY =
            Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        assert(
          !(overlapX > 4 && overlapY > 4),
          `${template.id}/${channel}: text overlaps: ${a.value} / ${b.value}`,
        );
      }
    checks++;
  }
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
const { menuQrCard } = await import("../lib/qr-card.ts");
const { default: QR } = await import("qrcode");
const qrLink = "https://example.test/m/orchard";
const qr = await QR.toDataURL(qrLink, { width: 1000, margin: 4 });
for (const typography of ["modern", "editorial", "bold"]) {
  const card = await menuQrCard(
    { ...restaurant, style: { ...restaurant.style, typography } },
    qrLink,
    qr,
  );
  assert.equal(card.type, "application/pdf");
  const bytes = new Uint8Array(await card.arrayBuffer());
  writeFileSync(`${root}/qr-card-${typography}.pdf`, bytes);
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  assert.deepEqual(page.view, [0, 0, 288, 432]);
  const content = await page.getTextContent();
  const text = content.items.map((item) => item.str).join(" ");
  assert(text.includes(restaurant.name));
  assert(text.includes("example.test/m/orchard"));
  assert(text.includes("Scan to explore our menu"));
  for (const item of content.items)
    if (item.str.trim()) {
      assert(
        item.transform[4] >= 0 && item.transform[4] + item.width <= 288.1,
        "card text stays inside its paper",
      );
      assert(
        item.transform[5] > 0 && item.transform[5] < 432,
        "card text stays inside its paper",
      );
    }
  const viewport = page.getViewport({ scale: 2 });
  const out = createCanvas(viewport.width, viewport.height);
  await page.render({
    canvas: out,
    canvasContext: out.getContext("2d"),
    viewport,
  }).promise;
  writeFileSync(`${root}/qr-card-${typography}.png`, out.toBuffer("image/png"));
  await task.destroy();
  checks++;
}
const longCard = await menuQrCard(
  {
    ...restaurant,
    name: "THE NEIGHBORHOOD RESTAURANT & BAKERY — BREAKFAST, LUNCH AND SUPPER AROUND OUR TABLE",
    style: { ...restaurant.style, typography: "bold" },
  },
  qrLink,
  qr,
);
const longTask = pdfjs.getDocument({
  data: new Uint8Array(await longCard.arrayBuffer()),
  useSystemFonts: true,
});
const longDoc = await longTask.promise;
const longPage = await longDoc.getPage(1);
for (const item of (await longPage.getTextContent()).items)
  if (item.str.trim())
    assert(item.transform[4] >= 0 && item.transform[4] + item.width <= 288.1);
await longTask.destroy();
checks++;
console.log(
  `PASS: ${checks} exported PDF/image checks, embedded-text prices, US Letter/A4, all ten new post templates and legacy draft mappings, independent feed/story dimensions, carousel ZIP and clean delivery JPEG. Artifacts: ${root}`,
);

// Render the actual default gallery, including the photo-only design, with shipped fonts and images.
for (const channel of ["feed", "story"]) {
  const sheet = createCanvas(1500, channel === "feed" ? 850 : 1150),
    sc = sheet.getContext("2d");
  sc.fillStyle = "#f4f4f0";
  sc.fillRect(0, 0, sheet.width, sheet.height);
  for (let i = 0; i < postTemplates.length; i++) {
    const t = postTemplates[i],
      example = postTemplateExample(t.id),
      c = canvas();
    const result = await renderPost(
      c,
      example,
      { name: example.restaurantName, currency: "USD" },
      channel,
    );
    if (t.id === "combo")
      assert(
        result.renderedText.some((v) => v.includes("3 × Carnitas taco")),
        "Single-dish offers must retain the quantity",
      );
    if (t.textMode === "photo")
      assert.equal(
        result.renderedText.length,
        0,
        "Photo-only design must have no overlays",
      );
    const w = 280,
      h = channel === "feed" ? 350 : 498,
      x = 10 + (i % 5) * 300,
      y = 15 + Math.floor(i / 5) * (h + 60);
    sc.drawImage(c, x, y, w, h);
    sc.fillStyle = "#24362a";
    sc.font = '16px "Post Sans"';
    sc.fillText(t.name, x, y + h + 24);
    writeFileSync(
      `${root}/gallery-${t.id}-${channel}.png`,
      c.toBuffer("image/png"),
    );
  }
  writeFileSync(`${root}/gallery-${channel}.jpg`, sheet.toBuffer("image/jpeg"));
}
