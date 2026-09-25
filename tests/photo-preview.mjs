import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
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
const fixtureUrl = new URL(
  "./fixtures/photo-render-pixels.json",
  import.meta.url,
);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

// Rendered pixels differ slightly between platforms (the canvas library's
// filters round differently on macOS and Linux), so each case is compared
// with stored reference data within a tolerance rather than by exact hash:
// the average colour of each cell of a grid laid over the render. Crops,
// rotations, zoom and offsets move whole regions and fail by a wide margin;
// a tone change of a few percent fails too. The export renderer and the
// cached preview renderer must still agree exactly with each other.
//
// After an intended change to lib/photo-export.ts, regenerate the reference
// data (it is written from drawPhoto) and review the diff:
//   node --disable-warning=ExperimentalWarning --experimental-loader \
//     ./tests/runtime-loader.mjs tests/photo-preview.mjs --update
const update = process.argv.includes("--update");
const grid = fixture.grid;
function cellMeans(data, width, height) {
  const means = new Uint8Array(grid * grid * 4);
  for (let row = 0; row < grid; row++) {
    const y0 = Math.floor((row * height) / grid),
      y1 = Math.floor(((row + 1) * height) / grid);
    for (let column = 0; column < grid; column++) {
      const x0 = Math.floor((column * width) / grid),
        x1 = Math.floor(((column + 1) * width) / grid);
      const sums = [0, 0, 0, 0];
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++)
          for (let channel = 0; channel < 4; channel++)
            sums[channel] += data[(y * width + x) * 4 + channel];
      const count = (y1 - y0) * (x1 - x0);
      for (let channel = 0; channel < 4; channel++)
        means[(row * grid + column) * 4 + channel] = Math.round(
          sums[channel] / count,
        );
    }
  }
  return means;
}
function compare(reference, actual) {
  let squares = 0,
    largest = 0;
  for (let i = 0; i < reference.length; i++) {
    const difference = Math.abs(reference[i] - actual[i]);
    squares += difference * difference;
    largest = Math.max(largest, difference);
  }
  const psnr = squares
    ? 10 * Math.log10((255 * 255) / (squares / reference.length))
    : Infinity;
  return { psnr, largest };
}
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
  const label = `${entry.source}, ${entry.width}x${entry.height}, ${JSON.stringify(entry.edits)}`;
  const [exported, previewed] = [drawPhoto, preview.draw].map((render) => {
    const canvas = createCanvas(entry.width, entry.height);
    render(canvas, image, entry.width, entry.height, entry.edits);
    return canvas.getContext("2d").getImageData(0, 0, entry.width, entry.height)
      .data;
  });
  assert(
    Buffer.from(exported).equals(Buffer.from(previewed)),
    `The cached preview matches the export exactly: ${label}`,
  );
  const means = cellMeans(exported, entry.width, entry.height);
  if (update) {
    entry.cellMeans = Buffer.from(means).toString("base64");
    continue;
  }
  const { psnr, largest } = compare(
    new Uint8Array(Buffer.from(entry.cellMeans, "base64")),
    means,
  );
  assert(
    psnr >= 40 && largest <= 16,
    `Pixels drift from the reference (${psnr.toFixed(1)} dB, largest cell difference ${largest}): ${label}`,
  );
}
if (update) {
  writeFileSync(fixtureUrl, JSON.stringify(fixture, null, 2) + "\n");
  console.log(`Updated ${fixture.cases.length} reference renders.`);
  process.exit(0);
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
  `Photo preview: ${fixture.cases.length} reference renders match within tolerance, and the cached preview matches the export exactly; bounded image-layer reuse and cleanup passed.`,
);
