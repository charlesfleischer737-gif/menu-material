// Export regressions plus a representative art-direction proof, using the real renderers.
import "./workspace-exports.mjs";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { renderPost, menuPdf } from "../lib/creation-export.ts";
import { postTemplates, postTemplateExample } from "../lib/post-templates.ts";
import { menuDesigns } from "../lib/menu-design.ts";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
const root = "/private/tmp/menu-template-art-direction";
mkdirSync(root, { recursive: true });
const sheet = createCanvas(1500, 880),
  sc = sheet.getContext("2d");
sc.fillStyle = "#e8e7e0";
sc.fillRect(0, 0, 1500, 880);
for (const [n, t] of postTemplates.entries()) {
  const draft = { ...postTemplateExample(t.id), compositionVersion: 2 };
  for (const channel of ["feed", "story"]) {
    const c = createCanvas(1, 1);
    const result = await renderPost(
      c,
      draft,
      { name: draft.restaurantName, currency: "USD" },
      channel,
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
          overlapX < 2 || overlapY < 2,
          `${t.id}/${channel}: text regions must not collide`,
        );
      }
    writeFileSync(
      `${root}/post-${t.id}-${channel}.png`,
      c.toBuffer("image/png"),
    );
    if (channel === "feed") {
      const x = (n % 5) * 300 + 10,
        y = Math.floor(n / 5) * 440 + 10;
      sc.drawImage(c, x, y, 280, 350);
      sc.fillStyle = "#28342b";
      sc.font = '16px "Post Sans"';
      sc.fillText(t.name, x, y + 377);
    }
  }
}
writeFileSync(`${root}/post-collection.jpg`, sheet.toBuffer("image/jpeg"));
const dishes = [
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
const sections = [];
for (const [category, name, description, price] of dishes) {
  let s = sections.find((s) => s.name === category);
  if (!s) {
    s = { id: String(sections.length), name: category, items: [] };
    sections.push(s);
  }
  s.items.push({
    id: String(s.items.length),
    name,
    description,
    price,
    available: true,
  });
}
const restaurant = {
  name: "Cedar & Salt",
  currency: "USD",
  style: { primary: "#643026", accent: "#edddbd" },
};
const overview = createCanvas(4 * 450, 640),
  oc = overview.getContext("2d");
oc.fillStyle = "#deddd5";
oc.fillRect(0, 0, overview.width, overview.height);
let checks = 0;
for (const [n, d] of menuDesigns.entries()) {
  const menu = {
    restaurant,
    sections,
    title: "Dinner",
    design: d.id,
    layout: "classic",
    paper: "letter",
    density: "comfortable",
  };
  const result = await menuPdf(menu),
    bytes = new Uint8Array(await result.blob.arrayBuffer());
  writeFileSync(`${root}/menu-${d.id}.pdf`, bytes);
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const pdf = await task.promise;
  let all = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p),
      text = (await page.getTextContent()).items;
    all += text.map((t) => t.str).join(" ");
    const viewport = page.getViewport({ scale: 1.5 }),
      c = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({
      canvas: c,
      canvasContext: c.getContext("2d"),
      viewport,
    }).promise;
    writeFileSync(`${root}/menu-${d.id}-${p}.png`, c.toBuffer("image/png"));
    if (p === 1) {
      oc.drawImage(c, n * 450 + 10, 10, 430, 557);
      oc.fillStyle = "#25362b";
      oc.font = '19px "Post Sans"';
      oc.fillText(
        `${d.name} · ${pdf.numPages} ${pdf.numPages === 1 ? "page" : "pages"}`,
        n * 450 + 10,
        602,
      );
    }
  }
  for (const [, name] of dishes)
    assert(all.includes(name), `${d.id} preserves ${name}`);
  await task.destroy();
  checks++;
  // Each architecture must also paginate a long menu without losing or stranding items.
  const longSections = Array.from({ length: 6 }, (_, s) => ({
    id: String(s),
    name: `Course ${s + 1}`,
    items: Array.from({ length: 10 }, (_, i) => ({
      name: `Plate ${s + 1}-${i + 1}`,
      description:
        "Roasted seasonal vegetables, herbs, cultured butter and sourdough",
      price: 1800 + i * 100,
      available: i !== 3,
    })),
  }));
  const long = await menuPdf({ ...menu, sections: longSections, paper: "a4" });
  const job = pdfjs.getDocument({
    data: new Uint8Array(await long.blob.arrayBuffer()),
    useSystemFonts: true,
  });
  const pdfLong = await job.promise;
  let total = "";
  for (let p = 1; p <= pdfLong.numPages; p++) {
    const page = await pdfLong.getPage(p),
      items = (await page.getTextContent()).items,
      body = items.map((i) => i.str).join(" ");
    total += body;
    for (const s of longSections)
      if (body.toLowerCase().includes(s.name.toLowerCase()))
        assert(
          s.items.some((i) => body.includes(i.name)),
          `${d.id} orphan course heading`,
        );
    for (const i of items)
      if (i.str.trim())
        assert(
          i.transform[4] >= 22 &&
            i.transform[4] + i.width <= 595.28 - 22 &&
            i.transform[5] >= 22 &&
            i.transform[5] < 841.89 - 20,
          `${d.id} print text bounds: ${i.str}`,
        );
  }
  for (const s of longSections)
    for (const i of s.items)
      assert(total.includes(i.name), `${d.id} lost ${i.name}`);
  await job.destroy();
  checks++;
}
writeFileSync(`${root}/menu-collection.jpg`, overview.toBuffer("image/jpeg"));
console.log(
  `PASS: 20 representative post proofs and ${checks} menu proofs, text collision checks, all four pagination strategies. Artifacts: ${root}`,
);

// Photograph-led versions use the same real, approved dish in all four architectures.
const photoSections = sections.map((s) => ({
  ...s,
  items: s.items.map((i) => ({
    ...i,
    ...(i.name === "Burrata"
      ? {
          photoId: "hero-burrata",
          featured: true,
          crop: { fit: false, x: 50, y: 50, zoom: 1 },
        }
      : {}),
  })),
}));
const photographic = createCanvas(1800, 660),
  pc = photographic.getContext("2d");
pc.fillStyle = "#e5e2d9";
pc.fillRect(0, 0, 1800, 660);
for (const [index, d] of menuDesigns.entries()) {
  const result = await menuPdf({
    restaurant,
    sections: photoSections,
    title: "Dinner",
    design: d.id,
    appearance: d.appearance,
    layout: "featured",
    paper: "letter",
    density: "comfortable",
  });
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  writeFileSync(`${root}/menu-${d.id}-photographic.pdf`, bytes);
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true }),
    pdf = await task.promise,
    page = await pdf.getPage(1),
    v = page.getViewport({ scale: 1.5 }),
    c = createCanvas(Math.ceil(v.width), Math.ceil(v.height));
  assert(
    pdf.numPages <= (d.id === "fine" ? 2 : 1),
    `${d.name}: a short photographic dinner menu should not create a sparse extra page`,
  );
  await page.render({
    canvas: c,
    canvasContext: c.getContext("2d"),
    viewport: v,
  }).promise;
  writeFileSync(
    `${root}/menu-${d.id}-photographic.png`,
    c.toBuffer("image/png"),
  );
  pc.drawImage(c, index * 450 + 10, 10, 430, 557);
  pc.font = '19px "Post Sans"';
  pc.fillStyle = "#26382d";
  pc.fillText(
    `${d.name} · ${pdf.numPages} ${pdf.numPages === 1 ? "page" : "pages"}`,
    index * 450 + 10,
    602,
  );
  await task.destroy();
}
writeFileSync(
  `${root}/menu-photographic-collection.jpg`,
  photographic.toBuffer("image/jpeg"),
);
console.log(
  "PASS: four photograph-led menu proofs and real template default appearances",
);

const ordinaryTitle = "Wood-roasted chicken with preserved lemon";
for (const id of ["special", "brunch", "event"]) {
  for (const channel of ["feed", "story"]) {
    const draft = {
      ...postTemplateExample(id),
      title: ordinaryTitle,
      compositionVersion: 2,
    };
    const c = createCanvas(1, 1),
      result = await renderPost(
        c,
        draft,
        { name: "The Neighborhood Kitchen", currency: "USD" },
        channel,
      );
    assert(result.renderedText.includes(ordinaryTitle));
    assert(
      result.photoBoxes[0].height >= 400,
      "Ordinary names must leave a substantial photograph",
    );
    writeFileSync(
      `${root}/ordinary-${id}-${channel}.png`,
      c.toBuffer("image/png"),
    );
  }
}
console.log(
  "PASS: ordinary 40-character customer headlines retain generous photography in Post and Story formats",
);
