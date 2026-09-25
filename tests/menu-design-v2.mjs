import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  createCanvas,
  DOMMatrix,
  Path2D,
  ImageData,
  loadImage,
  GlobalFonts,
} from "@napi-rs/canvas";
import { PDFDocument, PDFName } from "pdf-lib";
import {
  newMenuDocument,
  newMenuEntry,
  menuContentIssues,
} from "../lib/menu-document.ts";
import { menuDesignCollection } from "../lib/menu-design-system.ts";
import { renderDesignedMenuPdf } from "../lib/menu-pdf-v2.ts";
const root = (await import("node:os")).tmpdir() + "/menu-design-v2";
mkdirSync(root, { recursive: true });
GlobalFonts.registerFromPath("public/fonts/MenuSans-Regular.ttf", "Menu QA");
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData });
globalThis.document = {
  createElement: (tag) => {
    assert.equal(tag, "canvas");
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
  },
};
globalThis.createImageBitmap = async (blob) => {
  const im = await loadImage(Buffer.from(await blob.arrayBuffer()));
  im.close = () => {};
  return im;
};
globalThis.fetch = async (path) => {
  const p = String(path);
  if (p.startsWith("/fonts/")) return new Response(readFileSync("public" + p));
  if (p.startsWith("/api/assets/"))
    return new Response(readFileSync("public/pasta.jpg"));
  throw Error("Unexpected request " + p);
};
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
function checkTextCollisions(result) {
  for (const page of result.layout.pages) {
    const text = page.elements.filter((e) => e.kind === "text");
    for (let a = 0; a < text.length; a++)
      for (let b = a + 1; b < text.length; b++) {
        const one = text[a],
          two = text[b];
        const overlapX =
          Math.min(one.x + one.width, two.x + two.width) -
          Math.max(one.x, two.x);
        const overlapY =
          Math.min(one.y + one.height, two.y + two.height) -
          Math.max(one.y, two.y);
        assert(
          overlapX < 0.2 || overlapY < 0.2,
          `Text collision: ${one.role} “${one.text}” and ${two.role} “${two.text}”`,
        );
      }
  }
}
const fixtures = [
  ["To begin", "Marinated olives", "Citrus peel, rosemary, bay leaf", 700],
  ["To begin", "Sourdough & cultured butter", "Baked here, served warm", 850],
  ["To begin", "Whipped ricotta", "Roasted grapes, honey, grilled bread", 1200],
  [
    "Seasonal plates",
    "Burrata",
    "Heirloom tomatoes, basil, aged balsamic",
    1700,
  ],
  [
    "Seasonal plates",
    "Wood-roasted carrots",
    "Labneh, pistachio, green harissa",
    1500,
  ],
  [
    "Seasonal plates",
    "Little gem salad",
    "Green goddess, pickled shallot, sourdough crumb",
    1400,
  ],
  [
    "From the kitchen",
    "Market fish",
    "White beans, fennel, preserved lemon",
    3200,
  ],
  [
    "From the kitchen",
    "Roast chicken",
    "Charred leeks, potato purée, chicken jus",
    2800,
  ],
  [
    "From the kitchen",
    "Braised short rib",
    "Celery root, glazed shallots, red wine",
    3400,
  ],
  [
    "From the kitchen",
    "Wild mushroom risotto",
    "Arborio rice, aged Parmesan, thyme",
    2600,
  ],
  ["Something sweet", "Olive oil cake", "Poached pear, vanilla cream", 1100],
  [
    "Something sweet",
    "Chocolate crémeux",
    "Sea salt, toasted hazelnut, crème fraîche",
    1200,
  ],
];
function content(count) {
  const sections = [];
  for (let n = 0; n < count; n++) {
    const [category, name, description, price] = fixtures[n % fixtures.length],
      group = category + (n >= 12 ? ` · ${Math.floor(n / 12) + 1}` : "");
    let section = sections.find((s) => s.name === group);
    if (!section) {
      section = {
        id: crypto.randomUUID(),
        name: group,
        description: "",
        pageBreakBefore: false,
        items: [],
      };
      sections.push(section);
    }
    section.items.push(newMenuEntry({ name, description, price }));
  }
  return sections;
}
const restaurant = {
  name: "Cedar & Salt",
  currency: "USD",
  style: { primary: "#314e42" },
};
const collection = createCanvas(
    1800,
    Math.ceil(menuDesignCollection.length / 3) * 855,
  ),
  context = collection.getContext("2d");
context.fillStyle = "#e5e7de";
context.fillRect(0, 0, collection.width, collection.height);
let checks = 0;
const timings = [],
  summary = [];
for (const spec of menuDesignCollection)
  for (const count of [12, 30, 60])
    for (const paper of ["letter", "a4"]) {
      const menu = {
        ...newMenuDocument({
          title: "Dinner",
          colorMode: "signature",
          design: spec.id,
          paper,
          sections: content(count),
          footer:
            "Please tell your server about any allergies. Seasonal ingredients, thoughtfully prepared.",
        }),
        restaurant,
      };
      const start = performance.now(),
        result = await renderDesignedMenuPdf(menu);
      timings.push(performance.now() - start);
      checkTextCollisions(result);
      const allItems = menu.sections.flatMap((s) => s.items),
        placed = result.layout.pages.flatMap((p) =>
          p.hits.map((h) => h.entryId),
        );
      assert.equal(
        placed.length,
        allItems.length,
        `${spec.id}/${count}/${paper}: every dish placed once`,
      );
      assert.equal(new Set(placed).size, allItems.length);
      for (const page of result.layout.pages) {
        const texts = page.elements.filter((e) => e.kind === "text");
        for (const text of texts) {
          assert(
            text.x >= 30 &&
              text.x + text.width <= result.layout.width - 30 + 0.1,
            `Text outside horizontal safety: ${spec.id} ${text.text}`,
          );
          assert(
            text.y >= 20 && text.y + text.height < result.layout.height - 20,
            `Text clipped vertically: ${spec.id} ${text.text}`,
          );
          if (
            ["item", "description", "price", "price-option"].includes(text.role)
          )
            assert(text.size >= 11, `${spec.id}: readable type floor`);
        }
        for (const heading of texts.filter((e) => e.role === "section"))
          assert(
            texts.some(
              (e) =>
                e.role === "item" &&
                e.y > heading.y &&
                Math.abs(e.x - heading.x) < 1,
            ),
            `${spec.id}: section heading has a following item in its column`,
          );
        for (const hit of page.hits)
          assert(
            hit.y + hit.height <= result.layout.height - 70,
            `${spec.id}: item does not collide with footer`,
          );
      }
      checks++;
      if (count === 12 && paper === "letter") {
        const bytes = new Uint8Array(await result.blob.arrayBuffer());
        writeFileSync(`${root}/${spec.id}.pdf`, bytes);
        const task = pdfjs.getDocument({ data: bytes }),
          pdf = await task.promise;
        let contentText = "";
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n),
            text = await page.getTextContent();
          contentText += text.items.map((t) => t.str).join(" ");
          const viewport = page.getViewport({ scale: 1.5 }),
            canvas = createCanvas(
              Math.ceil(viewport.width),
              Math.ceil(viewport.height),
            );
          await page.render({
            canvas,
            canvasContext: canvas.getContext("2d"),
            viewport,
          }).promise;
          writeFileSync(
            `${root}/${spec.id}-${n}.png`,
            canvas.toBuffer("image/png"),
          );
          if (n === 1) {
            const idx = menuDesignCollection.indexOf(spec),
              x = (idx % 3) * 600 + 25,
              y = Math.floor(idx / 3) * 855 + 23;
            context.drawImage(canvas, x, y, 550, 712);
            context.fillStyle = "#35462e";
            context.font = '22px "Menu QA"';
            context.fillText(
              `${spec.name} · ${result.pages} page${result.pages === 1 ? "" : "s"}`,
              x,
              y + 758,
            );
          }
        }
        assert.match(contentText, /Chocolate crémeux/);
        assert.match(contentText, /850|8\.50/);
        await task.destroy();
        summary.push({
          design: spec.id,
          pages: result.pages,
          timeMs: timings.at(-1),
        });
      }
    }
const mixed = {
  ...newMenuDocument({ sections: content(12), design: "cafe" }),
  restaurant,
};
mixed.sections[0].items[0].priceMode = "variants";
mixed.sections[0].items[0].variants = [
  { id: "glass", label: "Glass", price: 950 },
  { id: "bottle", label: "Bottle", price: 3600 },
];
mixed.sections[0].items[1].priceMode = "label";
mixed.sections[0].items[1].priceLabel = "Market price";
mixed.sections[1].items[0].additions = [
  { id: "avocado", label: "Avocado", price: 350 },
];
mixed.sections[1].items[0].dietary = ["Contains nuts"];
mixed.sections[1].items[1].available = false;
mixed.sections[1].items[2].visible = false;
mixed.sections[2].pageBreakBefore = true;
let result = await renderDesignedMenuPdf(mixed),
  texts = result.layout.pages
    .flatMap((p) =>
      p.elements.filter((e) => e.kind === "text").map((e) => e.text),
    )
    .join(" ");
assert.match(texts, /Glass.*9\.50/);
assert.match(texts, /Bottle.*36\.00/);
assert.match(texts, /Market price/);
assert.match(texts, /Avocado.*3\.50/);
assert.match(texts, /Contains nuts/);
assert.match(texts, /Currently unavailable/);
assert(!texts.includes("Little gem salad"));
assert(result.pages >= 2);
const truckRows = [
  ["Tacos", "Carne asada", "Grilled steak, onion, cilantro, salsa verde", 450],
  ["Tacos", "Adobo chicken", "Adobo chicken, pickled onion, lime crema", 400],
  [
    "Tacos",
    "Mushroom al pastor",
    "Seared mushrooms, pineapple, salsa roja",
    400,
  ],
  [
    "Make it a meal",
    "Two-taco combo",
    "Two tacos, chips & salsa, canned soda",
    1200,
  ],
  [
    "Make it a meal",
    "Quesadilla combo",
    "Chicken quesadilla, chips & salsa, canned soda",
    1350,
  ],
  [
    "On the side",
    "Chips & salsa",
    "Crisp tortilla chips, house salsa roja",
    400,
  ],
  [
    "On the side",
    "Street corn",
    "Grilled corn, lime crema, cotija, chile",
    550,
  ],
  ["Cold drinks", "Agua fresca", "Ask about today's flavor", 400],
  ["Cold drinks", "Mexican cola", "Cold glass bottle", 350],
];
const truckSections = [];
for (const [group, name, description, price] of truckRows) {
  let s = truckSections.find((s) => s.name === group);
  if (!s) {
    s = {
      id: crypto.randomUUID(),
      name: group,
      description: "",
      pageBreakBefore: false,
      items: [],
    };
    truckSections.push(s);
  }
  s.items.push(newMenuEntry({ name, description, price }));
}
truckSections[1].items[0].additions = [
  { id: "guac", label: "Guacamole", price: 200 },
];
const truck = {
  ...newMenuDocument({
    design: "truck",
    purpose: "food_truck",
    colorMode: "signature",
    title: "Tacos · Quesadillas · Good times",
    subtitle: "Fresh off the griddle. Made to order.",
    priceFormat: "whole",
    sections: truckSections,
    footer:
      "Order at the window · Please tell us about any allergies before ordering.",
  }),
  restaurant: { name: "Taco Local", currency: "USD" },
};
result = await renderDesignedMenuPdf(truck);
assert.equal(
  result.pages,
  1,
  "short counter-service menu fits on one legible page",
);
const truckBytes = new Uint8Array(await result.blob.arrayBuffer());
writeFileSync(`${root}/food-truck.pdf`, truckBytes);
const truckTask = pdfjs.getDocument({ data: truckBytes }),
  truckPdf = await truckTask.promise,
  truckPage = await truckPdf.getPage(1),
  truckViewport = truckPage.getViewport({ scale: 1.7 }),
  truckCanvas = createCanvas(
    Math.ceil(truckViewport.width),
    Math.ceil(truckViewport.height),
  );
await truckPage.render({
  canvas: truckCanvas,
  canvasContext: truckCanvas.getContext("2d"),
  viewport: truckViewport,
}).promise;
writeFileSync(`${root}/food-truck.png`, truckCanvas.toBuffer("image/png"));
await truckTask.destroy();
const brief = {
  ...newMenuDocument({
    sections: content(3),
    design: "special",
    title: "This evening",
    fixedPrice: 7500,
    subtitle: "A little something from our kitchen",
    colorMode: "signature",
    footer: "Three courses · Available this evening",
  }),
  restaurant,
};
result = await renderDesignedMenuPdf(brief);
writeFileSync(
  `${root}/seasonal-short.pdf`,
  new Uint8Array(await result.blob.arrayBuffer()),
);
assert.equal(result.pages, 1);
const press = {
  ...mixed,
  printProfile: "press",
  appearance: "dark",
  layout: "featured",
};
press.sections[0].items[0].photoId = crypto.randomUUID();
press.sections[0].items[0].featured = true;
result = await renderDesignedMenuPdf(press);
const bytes = new Uint8Array(await result.blob.arrayBuffer());
writeFileSync(`${root}/press.pdf`, bytes);
const pdf = await PDFDocument.load(bytes),
  page = pdf.getPages()[0];
assert.equal(page.getTrimBox().width, 612);
assert.equal(page.getBleedBox().width, 630);
assert.equal(page.getWidth(), 660);
assert(result.warnings.some((w) => /RGB/.test(w)));
const crowded = {
  ...newMenuDocument({ sections: content(60), pageTarget: 1 }),
  restaurant,
};
result = await renderDesignedMenuPdf(crowded);
assert(result.pages > 1);
assert(result.warnings.some((w) => /readable size/.test(w)));
for (const spec of menuDesignCollection) {
  const long = {
    ...newMenuDocument({
      design: spec.id,
      sections: content(30),
      title: "Lunch and early evening service",
      fixedPrice: 5500,
      fixedPriceLabel:
        "per person with a choice of three seasonal courses and coffee",
      footer:
        "Please tell your server about allergies before ordering. Service charge applies to parties of six or more.",
    }),
    restaurant: { ...restaurant, name: "The Neighborhood Kitchen & Garden" },
  };
  long.sections[1].name =
    "Seasonal vegetables, salads & small plates from the kitchen";
  long.sections[2].items[0].name =
    "Pan-roasted seasonal market fish with preserved lemon";
  const proof = await renderDesignedMenuPdf(long);
  checkTextCollisions(proof);
  assert.equal(proof.layout.pages.flatMap((p) => p.hits).length, 30);
}
// Resolution is evaluated after crop and the final rasterization, not source size alone.
const originalFetch = globalThis.fetch;
const sample = createCanvas(400, 400),
  sampleContext = sample.getContext("2d");
sampleContext.fillStyle = "#cb642f";
sampleContext.fillRect(0, 0, 400, 400);
const logoSample = createCanvas(120, 120),
  logoContext = logoSample.getContext("2d");
logoContext.fillStyle = "#315848";
logoContext.fillRect(30, 30, 60, 60);
globalThis.fetch = async (path) =>
  String(path).startsWith("/api/assets/")
    ? new Response(
        String(path).endsWith("logo")
          ? logoSample.toBuffer("image/png")
          : sample.toBuffer("image/png"),
      )
    : originalFetch(path);
const photoMenu = {
  ...newMenuDocument({
    design: "casual",
    printProfile: "press",
    sections: content(6),
    layout: "featured",
  }),
  restaurant: { ...restaurant, logoId: "logo" },
};
photoMenu.sections[0].items[0].photoId = crypto.randomUUID();
photoMenu.sections[0].items[0].featured = true;
photoMenu.sections[0].items[0].crop = { fit: false, x: 50, y: 50, zoom: 2 };
const photoProof = await renderDesignedMenuPdf(photoMenu);
assert(
  photoProof.warnings.some((w) => /101 PPI/.test(w)),
  "crop-aware low resolution warning before download",
);
const photoBytes = new Uint8Array(await photoProof.blob.arrayBuffer());
writeFileSync(`${root}/photo-print-shop.pdf`, photoBytes);
const photoDoc = await PDFDocument.load(photoBytes);
const images = photoDoc.context
  .enumerateIndirectObjects()
  .filter(
    ([, o]) => o.dict?.get(PDFName.of("Subtype"))?.toString() === "/Image",
  )
  .map(([, o]) => o.dict);
assert(
  images.some((i) => i.get(PDFName.of("SMask"))),
  "transparent logos keep an alpha mask",
);
assert(
  images.some(
    (i) =>
      i.get(PDFName.of("Width"))?.asNumber() >= Math.ceil((142 * 300) / 72),
  ),
  "exported photo uses 300-PPI raster dimensions",
);
const photoTask = pdfjs.getDocument({ data: photoBytes }),
  photoPdf = await photoTask.promise,
  photoPage = await photoPdf.getPage(1),
  photoViewport = photoPage.getViewport({ scale: 1 });
const photoCanvas = createCanvas(photoViewport.width, photoViewport.height),
  photoContext = photoCanvas.getContext("2d");
await photoPage.render({
  canvas: photoCanvas,
  canvasContext: photoContext,
  viewport: photoViewport,
}).promise;
assert.deepEqual(
  [...photoContext.getImageData(18, 60, 1, 1).data],
  [...photoContext.getImageData(30, 60, 1, 1).data],
  "masthead artwork extends continuously through bleed",
);
writeFileSync(
  `${root}/photo-print-shop.png`,
  photoCanvas.toBuffer("image/png"),
);
await photoTask.destroy();
globalThis.fetch = originalFetch;
const missing = { ...newMenuDocument({ sections: content(3) }), restaurant };
missing.sections[0].items[0].sourceReviewed = false;
assert(menuContentIssues(missing).some((i) => i.entryId));
await assert.rejects(() => renderDesignedMenuPdf(missing), /original/);
const unsupported = {
  ...newMenuDocument({ sections: content(3) }),
  restaurant: { ...restaurant, name: "料理" },
};
await assert.rejects(
  () => renderDesignedMenuPdf(unsupported),
  /cannot display/,
);
writeFileSync(`${root}/collection.jpg`, collection.toBuffer("image/jpeg"));
writeFileSync(
  `${root}/report.json`,
  JSON.stringify(
    {
      cases: checks,
      longContentCases: menuDesignCollection.length,
      photoChecks: [
        "effective crop resolution",
        "300-PPI raster dimensions",
        "transparent logo alpha",
        "continuous masthead bleed",
      ],
      summary,
      maxMs: Math.max(...timings),
      averageMs: timings.reduce((a, b) => a + b, 0) / timings.length,
    },
    null,
    2,
  ),
);
console.log(
  `${checks} measured menu compositions passed, plus price variants, visibility, page breaks, print dimensions, review gating, and unsupported glyph diagnostics. Proofs: ${root}`,
);
