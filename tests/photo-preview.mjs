import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { drawPhoto, createPhotoPreviewRenderer } from "../lib/photo-export.ts";

const created = [];
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, "canvas");
    const canvas = createCanvas(1, 1);
    created.push(canvas);
    return canvas;
  },
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/photo-render-pixels.json", import.meta.url),
    "utf8",
  ),
);
const images = new Map();
const preview = createPhotoPreviewRenderer();
for (const entry of fixture.cases) {
  const bytes = readFileSync(entry.source);
  assert.equal(
    hash(bytes),
    entry.sourceSha256,
    `Source fixture changed: ${entry.source}`,
  );
  if (!images.has(entry.source))
    images.set(entry.source, await loadImage(bytes));
  const image = images.get(entry.source);
  for (const render of [drawPhoto, preview.draw]) {
    const canvas = createCanvas(entry.width, entry.height);
    render(canvas, image, entry.width, entry.height, entry.edits);
    assert.equal(
      hash(
        canvas.getContext("2d").getImageData(0, 0, entry.width, entry.height)
          .data,
      ),
      entry.pixelSha256,
      `Pre-change pixels: ${entry.source}, ${entry.width}x${entry.height}, ${JSON.stringify(entry.edits)}`,
    );
  }
}
preview.clear();

const cache = createPhotoPreviewRenderer();
const target = createCanvas(200, 200);
const source = images.get("public/pasta.jpg");
const start = created.length;
for (let i = 0; i < 20; i++)
  cache.draw(target, source, 200, 200, {
    brightness: 100 + i,
    x: i,
    zoom: 1 + i / 100,
    rotate: 90,
  });
assert.equal(
  created.length - start,
  1,
  "Twenty adjustments reuse one full-size image layer",
);
const firstLayer = created.at(-1);
cache.draw(target, source, 300, 200, { rotate: 450, contrast: 92 });
assert.equal(
  created.length - start,
  1,
  "Output size and equivalent rotation do not copy the source again",
);
cache.draw(target, source, 200, 200, { rotate: 180 });
assert.equal(created.length - start, 2);
assert.equal(
  firstLayer.width * firstLayer.height,
  1,
  "Previous rotation releases its full-size pixel buffer",
);
const secondLayer = created.at(-1);
cache.draw(target, images.get("public/burger.jpg"), 200, 200, { rotate: 180 });
assert.equal(created.length - start, 3);
assert.equal(
  secondLayer.width * secondLayer.height,
  1,
  "Replacing a source releases the old full-size layer",
);
const finalLayer = created.at(-1);
cache.clear();
cache.clear();
assert.equal(
  finalLayer.width * finalLayer.height,
  1,
  "Cleanup is idempotent and releases the retained full-size layer",
);

console.log(
  `Photo preview: ${fixture.cases.length} pre-change pixel cases match in both export and cached preview; bounded image-layer reuse and cleanup passed.`,
);
