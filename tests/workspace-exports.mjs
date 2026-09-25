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
import { unzipSync } from "fflate";
const { postFonts } = await import("../lib/post-fonts.ts");
for (const f of postFonts)
  assert(
    GlobalFonts.registerFromPath("public/fonts/social/" + f.file, f.family),
  );
const root = "/private/tmp/menu-workspace-export-qa";
mkdirSync(root, { recursive: true });
const jpg = readFileSync("public/burger.jpg"),
  pasta = readFileSync("public/pasta.jpg");
// A 5:1 magenta wordmark, so the drawn logo's shape can be measured.
const wordmark = createCanvas(500, 100);
wordmark.getContext("2d").fillStyle = "#ff00ff";
wordmark.getContext("2d").fillRect(0, 0, 500, 100);
const wideLogo = wordmark.toBuffer("image/png");
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
  if (
    path.startsWith("/studio/styles/") ||
    path.startsWith("/design-materials/")
  )
    return new Response(readFileSync("public" + path));
  if (path.startsWith("/fonts/"))
    return new Response(readFileSync("public" + path));
  if (path === "/api/assets/hero-burrata")
    return new Response(readFileSync("public/studio/styles/menu-stone.webp"), {
      headers: { "Content-Type": "image/webp" },
    });
  if (path.startsWith("/api/assets/deleted-"))
    return new Response("Image not found.", { status: 404 });
  if (path === "/api/assets/wide-logo")
    return new Response(wideLogo, { headers: { "Content-Type": "image/png" } });
  if (path === "/api/assets/phone-burger")
    return new Response(readFileSync("public/burger-phone-original.jpg"), {
      headers: { "Content-Type": "image/jpeg" },
    });
  if (path.startsWith("/api/assets/"))
    return new Response(path.includes("pasta") ? pasta : jpg, {
      headers: { "Content-Type": "image/jpeg" },
    });
  throw Error("Unexpected export request " + path);
};
const { renderPost, campaignZip } = await import("../lib/creation-export.ts");
const { money } = await import("../lib/client.ts");
const restaurant = {
  name: "The Orchard Kitchen",
  slug: "orchard",
  currency: "USD",
  style: { primary: "#235b48", accent: "#e7efb7" },
};
const { postTemplates, applyPostTemplate } =
  await import("../lib/post-templates.ts");
const { postSlideCount } = await import("../lib/post-composition.ts");
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
        // Clear of the profile row, the reply bar and the screen edges.
        assert(box.y >= 270, `${t.id}: Story text below the profile row`);
        assert(
          box.y + box.height <= 1540,
          `${t.id}: Story text above the reply bar`,
        );
        assert(
          box.x >= 64 && box.x + box.width <= 1080 - 64,
          `${t.id}: Story side margin ${JSON.stringify(box)}`,
        );
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
// The taller 3:4 post keeps text inside the grid crop.
for (const t of postTemplates) {
  const c = canvas(),
    result = await renderPost(
      c,
      { ...base, ...applyPostTemplate(base, t.id), feedShape: "3:4" },
      restaurant,
      "feed",
    );
  assert.equal(c.height, 1440);
  assert.equal(result.height, 1440);
  for (const box of result.textBoxes)
    assert(box.y >= 60 && box.y + box.height <= 1440 - 60, `${t.id}: 3:4 text`);
  writeFileSync(`${root}/post-${t.id}-tall.png`, c.toBuffer("image/png"));
  checks++;
}
// Older drafts render at 4:5 only, so they never claim to be 3:4.
const { postSize } = await import("../lib/post-composition.ts");
const { postFormatDetail } = await import("../lib/sharing.ts");
const olderTall = { ...base, compositionVersion: 1, feedShape: "3:4" };
assert.equal(postSize(olderTall, "feed").height, 1350);
assert.equal(postFormatDetail(olderTall, "feed"), "1080 × 1350 · 4:5");
assert.equal((await renderPost(canvas(), olderTall, restaurant)).height, 1350);
checks++;
// A dish word decides the design before the restaurant's cuisine does.
const { recommendedDesigns } = await import("../lib/post-composition.ts");
assert.equal(
  recommendedDesigns(
    { occasion: "showcase", items: [{ name: "The house burger" }] },
    { cuisine: "Seasonal neighborhood cooking" },
  )[0],
  "launch",
);
checks++;
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
// The nightcap never shades the dish by more than 60%: each dish row is
// compared with the photo as drawn, before any shade or words.
const { PostKit } = await import("../lib/post-kit.ts");
const drawPhoto = PostKit.prototype.photo;
let photoPixels = null;
PostKit.prototype.photo = function (...args) {
  const placed = drawPhoto.apply(this, args);
  photoPixels = this.ctx.getImageData(
    0,
    0,
    this.canvas.width,
    this.canvas.height,
  ).data;
  return placed;
};
for (const [photoId, channel, feedShape] of [
  ["hero-burrata", "feed", "4:5"],
  ["hero-burrata", "feed", "3:4"],
  ["hero-burrata", "story", "4:5"],
  ["pasta", "feed", "4:5"],
  ["burger", "feed", "4:5"],
]) {
  const c = canvas(),
    draft = {
      ...base,
      ...applyPostTemplate(base, "afterdark"),
      feedShape,
      items: [{ ...base.items[0], photoId }],
    };
  photoPixels = null;
  const result = await renderPost(c, draft, restaurant, channel);
  const final = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let shade = 0;
  for (const box of result.dishBoxes)
    for (let y = Math.ceil(box.y); y < box.y + box.h; y += 4) {
      let before = 0,
        after = 0,
        n = 0;
      for (
        let x = Math.ceil(box.x + box.w / 4);
        x < box.x + box.w * 0.75;
        x++
      ) {
        const i = (y * c.width + x) * 4;
        before += photoPixels[i] + photoPixels[i + 1] + photoPixels[i + 2];
        after += final[i] + final[i + 1] + final[i + 2];
        n += 3;
      }
      [before, after] = [before / n, after / n];
      if (before < 40 || before > 235) continue;
      // How much of a dark (or pale) shade turns the photo's row into the post's.
      shade = Math.max(
        shade,
        after < before
          ? (before - after) / (before - 11)
          : (after - before) / (248 - before),
      );
    }
  assert(
    shade <= 0.62,
    `Nightcap ${photoId} ${channel} ${feedShape}: ${shade.toFixed(2)} shade over the dish`,
  );
  checks++;
}
PostKit.prototype.photo = drawPhoto;
// Chinese, Japanese and Thai headlines break between words at a readable size,
// measured here with every letter one em wide and marks on top of them, so
// no font is needed.
const measuring = {
  font: "",
  setTransform() {},
  measureText(s) {
    const px = Number(/([\d.]+)px/.exec(this.font)?.[1] || 10);
    return {
      width: s.replace(/\p{M}/gu, "").length * px,
      actualBoundingBoxAscent: px * 0.8,
      actualBoundingBoxDescent: px * 0.2,
    };
  },
};
const words = new Intl.Segmenter(undefined, { granularity: "word" });
const kit = new PostKit({ getContext: () => measuring }, 1080, 1350, 1, {
  top: 76,
  bottom: 1274,
  left: 72,
  right: 1008,
});
for (const headline of [
  "东坡肉配米饭和时令蔬菜还有自家制作的甜品",
  "季節の野菜たっぷりの特製カレーライスと自家製デザート",
  "ข้าวผัดกระเพราหมูสับไข่ดาวและต้มยำกุ้งน้ำข้น",
]) {
  const t = kit.layout(headline, 936, {
    family: "Post Sans",
    size: 150,
    min: 66,
    maxLines: 3,
  });
  const breaks = new Set([0]);
  let at = 0;
  for (const { segment } of words.segment(headline))
    breaks.add((at += segment.length));
  let end = 0;
  for (const line of t.lines)
    assert(
      breaks.has((end += line.length)),
      `${headline} breaks between words: ${t.lines.join(" / ")}`,
    );
  assert.equal(t.lines.join(""), headline);
  assert(t.size > 66, `${headline} is set larger than the smallest size`);
  checks++;
}
// A busy phone photo shown whole on a Story keeps its dish clear of the bars.
for (const template of ["editorial", "afterdark"])
  for (const textMode of ["minimal", "photo"]) {
    const draft = {
      ...base,
      ...applyPostTemplate(base, template),
      textMode,
      items: [{ ...base.items[0], photoId: "phone-burger" }],
    };
    const result = await renderPost(canvas(), draft, restaurant, "story");
    assert(result.dishBoxes.length);
    for (const box of result.dishBoxes)
      assert(
        box.y >= 269 && box.y + box.h <= 1541,
        `${template}/${textMode}: the dish sits between Instagram's bars ${JSON.stringify(box)}`,
      );
    checks++;
  }
// Ordinary prices never block the Daily special: a long one leaves the seal.
assert.equal(money(1850, "CAD"), "$18.50", "A narrow symbol, not CA$");
for (const [currency, price] of [
  ["CHF", "24.50"],
  ["MXN", "185"],
  ["IDR", "125000"],
  ["USD", "1250"],
  ["CAD", "18.50"],
])
  for (const channel of ["feed", "story"]) {
    const result = await renderPost(
      canvas(),
      { ...base, template: "special", textMode: "minimal", price },
      { ...restaurant, currency },
      channel,
    );
    assert(
      result.renderedText.some((t) =>
        t.includes(money(Math.round(Number(price) * 100), currency)),
      ),
      `${currency} ${price}: the price is shown`,
    );
    checks++;
  }
// A deleted photo names its dish; a logo that can't be opened is left out.
await assert.rejects(
  () =>
    renderPost(
      canvas(),
      { ...base, items: [{ ...base.items[0], photoId: "deleted-pasta" }] },
      restaurant,
    ),
  /The photo of Tomato basil pappardelle is no longer available/,
);
const noLogo = await renderPost(
  canvas(),
  { ...base, template: "chef", showBrand: true, textMode: "minimal" },
  { ...restaurant, logo_id: "deleted-logo" },
);
assert(noLogo.renderedText.includes(restaurant.name));
checks += 2;
// A wide wordmark keeps its 5:1 shape instead of being squashed.
const branded = canvas();
await renderPost(
  branded,
  { ...base, template: "chef", showBrand: true, textMode: "minimal" },
  { ...restaurant, logo_id: "wide-logo" },
);
const pixels = branded
  .getContext("2d")
  .getImageData(0, 0, branded.width, branded.height).data;
let [left, right, top, bottom] = [Infinity, -1, Infinity, -1];
for (let i = 0; i < pixels.length; i += 4)
  if (pixels[i] > 200 && pixels[i + 1] < 60 && pixels[i + 2] > 200) {
    const x = (i / 4) % branded.width,
      y = Math.floor(i / 4 / branded.width);
    [left, right, top, bottom] = [
      Math.min(left, x),
      Math.max(right, x),
      Math.min(top, y),
      Math.max(bottom, y),
    ];
  }
const logoShape = (right - left + 1) / (bottom - top + 1);
assert(
  logoShape > 4.6 && logoShape < 5.4,
  `A wide logo keeps its shape (drawn at ${logoShape.toFixed(2)}:1)`,
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
// Framing the cover leaves the first dish's own slide alone.
const coverFramed = structuredClone(carousel);
coverFramed.items[0].layouts = {
  cover: { fit: true, x: 50, y: 50, zoom: 1, autoFrame: false },
};
for (const n of [0, 1]) {
  const a = canvas(),
    b = canvas();
  await renderPost(a, carousel, restaurant, "carousel", n);
  await renderPost(b, coverFramed, restaurant, "carousel", n);
  assert.equal(
    a.toBuffer("image/png").equals(b.toBuffer("image/png")),
    n === 1,
    n ? "The dish slide keeps its framing" : "The cover takes its own framing",
  );
  checks++;
}
// Without a cover, the first slide carries the price, date and call to action.
const uncovered = {
  ...carousel,
  carouselCover: false,
  carouselClosing: "",
  cta: "Book a table",
};
assert.equal(postSlideCount(uncovered, "carousel"), 2);
const [opening, next] = [
  await renderPost(canvas(), uncovered, restaurant, "carousel", 0),
  await renderPost(canvas(), uncovered, restaurant, "carousel", 1),
];
assert(
  opening.renderedText.some(
    (t) =>
      t.includes("$18.50") &&
      t.includes(base.validity) &&
      t.includes("Book a table"),
  ),
  "The first slide shows the offer when there is no cover",
);
assert(!next.renderedText.some((t) => t.includes("$18.50")));
checks += 2;
console.log(
  `PASS: ${checks} new composition/export cases, phone-size type and Story safety, independent carousel framing. Artifacts: ${root}`,
);
