import { copyFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Trace the approved logo, including its exact lettering, into scalable assets.
// The source presentation is retained as the brand reference.
const reference = "docs/brand/menu-material-approved.png";
await mkdir("docs/brand", { recursive: true });
await mkdir("public/brand", { recursive: true });
if (process.argv[2]) await copyFile(process.argv[2], reference);
const { data, info } = await sharp(reference)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

function simplify(points, tolerance = 0.6) {
  if (points.length <= 2) return points;
  const [sx, sy] = points[0];
  const [ex, ey] = points.at(-1);
  const vx = ex - sx, vy = ey - sy, length = vx * vx + vy * vy;
  let maxDistance = 0, index = 0;
  points.forEach(([x, y], i) => {
    const t = length ? Math.max(0, Math.min(1, ((x - sx) * vx + (y - sy) * vy) / length)) : 0;
    const distance = Math.hypot(x - sx - t * vx, y - sy - t * vy);
    if (distance > maxDistance) { maxDistance = distance; index = i; }
  });
  if (maxDistance <= tolerance) return [points[0], points.at(-1)];
  return [...simplify(points.slice(0, index + 1)).slice(0, -1), ...simplify(points.slice(index))];
}

function trace([left, top, right, bottom], color) {
  const width = right - left, height = bottom - top;
  const filled = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = ((y + top) * info.width + x + left) * info.channels;
    filled[y * width + x] = Math.max(data[i], data[i + 1], data[i + 2]) < 190 ? 1 : 0;
  }
  const on = (x, y) => x >= 0 && x < width && y >= 0 && y < height && filled[y * width + x];
  const edges = new Map();
  const vertex = (x, y) => y * (width + 1) + x;
  function add(x1, y1, x2, y2) {
    const start = vertex(x1, y1);
    if (!edges.has(start)) edges.set(start, []);
    edges.get(start).push(vertex(x2, y2));
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (on(x, y)) {
    if (!on(x, y - 1)) add(x, y, x + 1, y);
    if (!on(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!on(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!on(x - 1, y)) add(x, y + 1, x, y);
  }
  const paths = [];
  while (edges.size) {
    const start = edges.keys().next().value;
    let cursor = start;
    const points = [];
    do {
      points.push([cursor % (width + 1) + left - 140, Math.floor(cursor / (width + 1)) + top - 170]);
      const next = edges.get(cursor);
      if (!next?.length) throw new Error("Open logo contour");
      const end = next.pop();
      if (!next.length) edges.delete(cursor);
      cursor = end;
    } while (cursor !== start);
    if (points.length < 12) continue;
    points.push(points[0]);
    paths.push("M" + simplify(points).map(([x, y]) => `${x},${y}`).join(" L") + " Z");
  }
  return `<path fill="${color}" fill-rule="evenodd" d="${paths.join(" ")}"/>`;
}

if (info.width !== 1536 || info.height !== 1024) throw new Error("Unexpected approved logo dimensions");
const mark = trace([130, 160, 425, 420], "#b65336");
const lettering = trace([440, 220, 1410, 365], "#292524");
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1264 240"><title>Menu Material</title>${mark}${lettering}</svg>\n`;
const emblem = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 240"><title>Menu Material — a dish framed for its close-up</title>${mark}</svg>\n`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><rect width="320" height="320" rx="64" fill="#292524"/><g transform="translate(20 40)">${mark.replaceAll("#b65336", "#ffffff")}</g></svg>\n`;
await Promise.all([
  writeFile("public/brand/menu-material-logo.svg", logo),
  writeFile("public/brand/menu-material-mark.svg", emblem),
  writeFile("public/favicon.svg", favicon),
]);
console.log(`Prepared approved logo (${logo.length} bytes), emblem and favicon.`);
