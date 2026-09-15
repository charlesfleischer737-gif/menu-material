import { money, type Row } from "./client";
import { defaultStyle, localToInstant, scheduleLabel } from "./promotions";
export const exportFormats = {
  feed: { label: "Instagram feed", width: 1080, height: 1350 },
  story: { label: "Instagram Story", width: 1080, height: 1920 },
  sign: { label: "Counter sign · 8.5 × 11 in", width: 1700, height: 2200 },
  clean: { label: "Clean menu image · square", width: 1080, height: 1080 },
  landscape: { label: "Clean landscape · 16:9", width: 1424, height: 801 },
  doordash: { label: "DoorDash item photo · 16:9", width: 1424, height: 801 },
};
export type ExportFormat = keyof typeof exportFormats;
const cache = new Map<string, Promise<ImageBitmap>>();
async function loadImage(aid: string) {
  if (!cache.has(aid)) {
    const promise = fetch("/api/assets/" + aid)
      .then(async (r) => {
        if (!r.ok) throw Error("A photo could not be loaded. Try again.");
        return createImageBitmap(await r.blob());
      })
      .catch((e) => {
        cache.delete(aid);
        throw e;
      });
    cache.set(aid, promise);
    if (cache.size > 24) {
      const key = cache.keys().next().value!;
      const old = cache.get(key);
      cache.delete(key);
      void old?.then((b) => b.close()).catch(() => {});
    }
  }
  return cache.get(aid)!;
}
export function clearExportImages() {
  for (const p of cache.values()) void p.then((b) => b.close()).catch(() => {});
  cache.clear();
}
function crop(
  ctx: CanvasRenderingContext2D,
  im: ImageBitmap,
  x: number,
  y: number,
  w: number,
  h: number,
  cx = 50,
  cy = 50,
) {
  const sw = Math.min(im.width, (im.height * w) / h),
    sh = (sw * h) / w;
  ctx.drawImage(
    im,
    ((im.width - sw) * cx) / 100,
    ((im.height - sh) * cy) / 100,
    sw,
    sh,
    x,
    y,
    w,
    h,
  );
}
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const result: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (ctx.measureText((line ? line + " " : "") + word).width <= width) {
      line += (line ? " " : "") + word;
      continue;
    }
    if (line) result.push(line);
    line = "";
    for (const ch of word) {
      if (ctx.measureText(line + ch).width > width && line) {
        result.push(line);
        line = "";
      }
      line += ch;
    }
  }
  if (line) result.push(line);
  return result;
}
function textBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  weight = 400,
) {
  let rows: string[] = [];
  for (; size >= 10; size -= 1) {
    ctx.font = `${weight} ${size}px Arial`;
    rows = lines(ctx, text, w);
    if (rows.length * size * 1.2 <= h) break;
  }
  rows.forEach((row, i) => ctx.fillText(row, x, y + i * size * 1.2));
}
function contrast(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 150
    ? "#172018"
    : "#ffffff";
}
export async function renderOffer(
  canvas: HTMLCanvasElement,
  draft: Row,
  restaurant: Row,
  dishes: Row[],
  format: ExportFormat,
) {
  const spec = exportFormats[format],
    clean = ["clean", "landscape", "doordash"].includes(format);
  const items = draft.items.map((i: Row) => ({
    ...i,
    name:
      dishes.find((d) => d.id === i.dishId)?.name || i.name || "Choose a dish",
  }));
  const images = await Promise.all(
    items.map((i: Row) => (i.photoId ? loadImage(i.photoId) : null)),
  );
  const style = { ...defaultStyle, ...draft.style };
  let w = spec.width,
    h = spec.height;
  if (clean) {
    const im = images[0];
    if (!im) throw Error("Choose a dish photo first.");
    const sw = Math.min(im.width, (im.height * w) / h),
      sh = (sw * h) / w;
    if (format === "doordash" && (sw < 1424 || sh < 801))
      throw Error(
        "This photo is too small for the DoorDash crop. Upload a larger original; a 1424 × 801 crop is needed without enlarging it.",
      );
    if (format !== "doordash") {
      const scale = Math.min(1, sw / w, sh / h);
      w = Math.floor(w * scale);
      h = Math.floor(h * scale);
    }
    canvas.width = w;
    canvas.height = h;
    crop(canvas.getContext("2d")!, im, 0, 0, w, h, draft.cropX, draft.cropY);
    return;
  }
  const logo = restaurant.logo_id || restaurant.logoId;
  const logoImage = logo ? await loadImage(logo) : null;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "top";
  const pad = w * 0.06;
  ctx.fillStyle = style.primary;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = contrast(style.primary);
  const head = h * 0.105;
  if (logoImage) {
    const size = head * 0.65,
      scale = Math.min(size / logoImage.width, size / logoImage.height);
    ctx.drawImage(
      logoImage,
      pad,
      head * 0.17,
      logoImage.width * scale,
      logoImage.height * scale,
    );
  }
  textBlock(
    ctx,
    restaurant.name || "Your restaurant",
    pad + (logoImage ? head * 0.8 : 0),
    head * 0.33,
    w - pad * 2 - (logoImage ? head * 0.8 : 0),
    head * 0.55,
    w * 0.031,
    600,
  );
  const photoTop = head,
    photoH = h * (format === "story" ? 0.48 : 0.43),
    cols = items.length > 1 ? 2 : 1,
    rows = Math.max(1, Math.ceil(items.length / cols)),
    gap = w * 0.008;
  if (!items.length) {
    ctx.fillStyle = "#e8e8e0";
    ctx.fillRect(0, photoTop, w, photoH);
    ctx.fillStyle = "#555a50";
    textBlock(
      ctx,
      "Select a dish to preview your special",
      pad,
      photoTop + photoH * 0.4,
      w - pad * 2,
      photoH * 0.4,
      w * 0.055,
    );
  }
  images.forEach((im: ImageBitmap | null, i: number) => {
    const cellW = (w - gap * (cols - 1)) / cols,
      cellH = (photoH - gap * (rows - 1)) / rows,
      x = (i % cols) * (cellW + gap),
      y = photoTop + Math.floor(i / cols) * (cellH + gap);
    ctx.fillStyle = "#e8e8e0";
    ctx.fillRect(x, y, cellW, cellH);
    if (im) crop(ctx, im, x, y, cellW, cellH, draft.cropX, draft.cropY);
    if (items.length > 1) {
      ctx.fillStyle = "rgba(0,0,0,.78)";
      ctx.fillRect(x, y + cellH * 0.74, cellW, cellH * 0.26);
      ctx.fillStyle = "white";
      textBlock(
        ctx,
        `${items[i].quantity} × ${items[i].name}`,
        x + 20,
        y + cellH * 0.77,
        cellW - 40,
        cellH * 0.2,
        w * 0.025,
        600,
      );
    }
  });
  const bottom = photoTop + photoH;
  ctx.fillStyle = draft.template === "bold" ? style.accent : "#ffffff";
  ctx.fillRect(0, bottom, w, h - bottom);
  ctx.fillStyle =
    draft.template === "bold" ? contrast(style.accent) : "#202820";
  const remaining = h - bottom;
  textBlock(
    ctx,
    draft.title || "Tonight’s special",
    pad,
    bottom + remaining * 0.07,
    w - pad * 2,
    remaining * 0.22,
    w * 0.065,
    700,
  );
  textBlock(
    ctx,
    money(draft.price, restaurant.currency),
    pad,
    bottom + remaining * 0.29,
    w - pad * 2,
    remaining * 0.14,
    w * 0.062,
    700,
  );
  const quantities = items
    .map((i: Row) => `${i.quantity} × ${i.name}`)
    .join(" · ");
  textBlock(
    ctx,
    quantities,
    pad,
    bottom + remaining * 0.46,
    w - pad * 2,
    remaining * 0.14,
    w * 0.03,
    600,
  );
  textBlock(
    ctx,
    draft.description || "",
    pad,
    bottom + remaining * 0.62,
    w - pad * 2,
    remaining * 0.16,
    w * 0.028,
  );
  let time = "Set availability before publishing";
  try {
    time = scheduleLabel(
      localToInstant(draft.startsLocal, restaurant.timezone, draft.occurrence),
      localToInstant(draft.endsLocal, restaurant.timezone, draft.occurrence),
      restaurant.timezone,
    );
  } catch {}
  textBlock(
    ctx,
    time,
    pad,
    bottom + remaining * 0.85,
    w - pad * 2,
    remaining * 0.12,
    w * 0.021,
  );
}
export async function offerBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
) {
  const jpeg = ["clean", "landscape", "doordash"].includes(format);
  const make = (quality: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("Export failed. Try again."))),
        jpeg ? "image/jpeg" : "image/png",
        quality,
      ),
    );
  let blob = await make(0.94);
  if (format === "doordash") {
    for (const q of [0.85, 0.75, 0.65]) {
      if (blob.size <= 2 * 1024 * 1024) break;
      blob = await make(q);
    }
    if (blob.size > 2 * 1024 * 1024)
      throw Error(
        "This export exceeds DoorDash’s file size guidance. Choose a simpler crop.",
      );
  }
  if (format === "sign") blob = await printResolution(blob);
  return blob;
}
// Canvas defaults to 96 dpi. Tag the letter-size sign at 200 dpi without
// changing any rendered pixels, so printing at actual size is 8.5 × 11 inches.
async function printResolution(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunk = new Uint8Array(21),
    view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4);
  view.setUint32(8, 7874);
  view.setUint32(12, 7874);
  chunk[16] = 1;
  let crc = 0xffffffff;
  for (const b of chunk.slice(4, 17)) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const parts: BlobPart[] = [bytes.slice(0, 8), chunk];
  for (let offset = 8; offset < bytes.length;) {
    const length = new DataView(bytes.buffer, offset, 4).getUint32(0),
      end = offset + 12 + length;
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    if (type !== "pHYs") parts.push(bytes.slice(offset, end));
    offset = end;
  }
  // The IHDR chunk must remain first, before ancillary metadata.
  const header = parts.splice(2, 1)[0];
  parts.splice(1, 0, header);
  return new Blob(parts, { type: "image/png" });
}
