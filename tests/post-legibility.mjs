import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const project = fileURLToPath(new URL("..", import.meta.url)).replace(
  /\/$/,
  "",
);
const require = createRequire(project + "/package.json");
const { createCanvas, GlobalFonts, loadImage } = require("@napi-rs/canvas");
const { postFonts } = await import(project + "/lib/post-fonts.ts");
const { postTemplates, applyPostTemplate } = await import(
  project + "/lib/post-templates.ts"
);
const { renderPost } = await import(project + "/lib/post-render.ts");
for (const font of postFonts)
  GlobalFonts.registerFromPath(
    project + "/public/fonts/social/" + font.file,
    font.family,
  );
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.createImageBitmap = async (blob) => {
  const im = await loadImage(Buffer.from(await blob.arrayBuffer()));
  im.close = () => {};
  return im;
};
globalThis.fetch = async (path) =>
  new Response(readFileSync(project + "/public" + path));
const root = (await import("node:os")).tmpdir() + "/post-legibility-acceptance";
mkdirSync(root, { recursive: true });
const linear = Array.from({ length: 256 }, (_, v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});
const lum = (p, i) =>
  0.2126 * linear[p[i]] + 0.7152 * linear[p[i + 1]] + 0.0722 * linear[p[i + 2]];
const cases = [];
const photos = {
  bright: "/pasta.jpg",
  dark: "/studio/styles/bar-velvet.webp",
  busy: "/studio/styles/menu-overhead.webp",
};
for (const compositionVersion of [1, 2])
  for (const [fixture, photoUrl] of Object.entries(photos))
    for (const { channel, slide } of [
      { channel: "feed", slide: 0 },
      { channel: "story", slide: 0 },
      { channel: "carousel", slide: 0 },
      ...(compositionVersion === 2
        ? [
            { channel: "carousel", slide: 1 },
            { channel: "carousel", slide: 2 },
          ]
        : []),
    ])
      for (const t of postTemplates) {
        const c = createCanvas(1080, channel === "story" ? 1920 : 1350),
          ctx = c.getContext("2d");
        const original = ctx.fillText.bind(ctx),
          contrast = [];
        ctx.fillText = function (value, x, y, ...rest) {
          const fs = Number(this.font.match(/([0-9.]+)px/)[1]),
            measure = this.measureText(value);
          const left =
            x -
            (this.textAlign === "center"
              ? measure.width / 2
              : this.textAlign === "right"
                ? measure.width
                : 0);
          const x0 = Math.max(0, Math.floor(left - 4)),
            y0 = Math.max(0, Math.floor(y - 4)),
            w = Math.min(c.width - x0, Math.ceil(measure.width) + 12),
            h = Math.min(c.height - y0, Math.ceil(fs * 1.8) + 12);
          if (w > 0 && h > 0) {
            const mask = createCanvas(w, h),
              mc = mask.getContext("2d");
            mc.font = this.font;
            mc.textBaseline = this.textBaseline;
            mc.fillStyle = "#fff";
            mc.fillText(value, left - x0, y - y0);
            const paint = createCanvas(w, h),
              pc = paint.getContext("2d");
            pc.translate(-x0, -y0);
            pc.fillStyle = this.fillStyle;
            pc.fillRect(x0, y0, w, h);
            const bg = this.getImageData(x0, y0, w, h).data,
              fg = pc.getImageData(0, 0, w, h).data,
              maskPixels = mc.getImageData(0, 0, w, h).data;
            let min = Infinity,
              count = 0,
              below = 0;
            // Use a 320px-wide phone display when deciding whether text is large. Sample actual glyph locations, excluding antialiased edges.
            const required = (fs * 320) / 1080 >= 24 ? 3 : 4.5;
            for (let i = 0; i < bg.length; i += 4)
              if (maskPixels[i + 3] >= 250) {
                const a = lum(bg, i),
                  b = lum(fg, i),
                  ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
                min = Math.min(min, ratio);
                count++;
                if (ratio < required) below++;
              }
            contrast.push({
              text: value,
              fontSize: fs,
              minimum: +min.toFixed(3),
              required,
              pixels: count,
              below,
            });
            assert(
              count > 0,
              `Contrast sampling must cover actual glyphs: ${value}`,
            );
          }
          return original(value, x, y, ...rest);
        };
        const base = {
          compositionVersion,
          title: "Tomato basil pappardelle",
          description: "Made fresh in our kitchen.",
          items: [{ name: "Tomato basil pappardelle", photoUrl, quantity: 1 }],
          showPrice: true,
          price: "18.50",
          validity: "Tonight, 5–9 pm",
          layouts: {},
          channels: [channel],
          carouselCover: true,
          carouselClosing: "Join us tonight",
        };
        const draft = { ...base, ...applyPostTemplate(base, t.id) };
        const result = await renderPost(
          c,
          draft,
          { name: "Juniper Kitchen", currency: "USD" },
          channel,
          slide,
        );
        writeFileSync(
          `${root}/v${compositionVersion}-${fixture}-${t.id}-${channel}${channel === "carousel" ? `-${slide}` : ""}.png`,
          c.toBuffer("image/png"),
        );
        cases.push({
          compositionVersion,
          fixture,
          channel,
          slide,
          template: t.id,
          contrast,
          textBoxes: result.textBoxes,
          warnings: result.warnings,
        });
      }
const headline =
  "Slow-roasted chicken, garden vegetables and golden potatoes with our signature herb butter";
assert.equal(headline.length, 90);
for (const t of postTemplates) {
  for (const channel of ["feed", "story"]) {
    const base = {
      compositionVersion: 2,
      title: headline,
      items: [{ name: "Roast chicken", photoUrl: photos.bright, quantity: 1 }],
      layouts: {},
    };
    const canvas = createCanvas(1, 1);
    const result = await renderPost(
      canvas,
      { ...base, ...applyPostTemplate(base, t.id) },
      { name: "Juniper Kitchen", currency: "USD" },
      channel,
    );
    for (const box of result.textBoxes)
      assert(
        box.y >= 0 &&
          box.y + box.height <= canvas.height &&
          box.x >= 0 &&
          box.x + box.width <= canvas.width + 1,
        `${t.id}/${channel}: a maximum-length headline stays inside the artwork`,
      );
    writeFileSync(
      `${root}/long-${t.id}-${channel}.png`,
      canvas.toBuffer("image/png"),
    );
  }
}
writeFileSync(root + "/contrast.json", JSON.stringify(cases, null, 2));
const failures = cases.filter((c) => c.contrast.some((t) => t.below));
console.log(
  JSON.stringify(
    {
      cases: cases.length,
      failures: failures.map((c) => ({
        compositionVersion: c.compositionVersion,
        fixture: c.fixture,
        template: c.template,
        channel: c.channel,
        failures: c.contrast
          .filter((t) => t.below)
          .map((t) => ({
            text: t.text,
            minimum: t.minimum,
            required: t.required,
          })),
      })),
      root,
    },
    null,
    2,
  ),
);

assert.equal(
  failures.length,
  0,
  "All text regions must meet contrast at the actual glyph locations",
);
