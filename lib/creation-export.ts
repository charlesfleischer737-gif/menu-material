import { renderPost } from "./post-render";
import { postSlideCount } from "./post-composition";
import {
  formats,
  catalogProfiles,
  emptyAdjustments,
  type Adjustments,
  type PhotoFormat,
} from "./studio";
import { type Row } from "./client";
export async function imageBitmap(src: string) {
  const res = await fetch(src);
  if (!res.ok) throw Error("This photo could not be opened. Please try again.");
  return createImageBitmap(await res.blob());
}
export function drawPhoto(
  canvas: HTMLCanvasElement,
  im: ImageBitmap,
  width: number,
  height: number,
  edits: Partial<Adjustments> = {},
  background = "#f4f1ea",
) {
  const e = { ...emptyAdjustments, ...edits };
  const rotated = document.createElement("canvas");
  const turn = ((e.rotate % 360) + 360) % 360;
  rotated.width = turn % 180 ? im.height : im.width;
  rotated.height = turn % 180 ? im.width : im.height;
  const rc = rotated.getContext("2d")!;
  rc.translate(rotated.width / 2, rotated.height / 2);
  rc.rotate((turn * Math.PI) / 180);
  rc.drawImage(im, -im.width / 2, -im.height / 2);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const scale =
    (e.fit
      ? Math.min(width / rotated.width, height / rotated.height)
      : Math.max(width / rotated.width, height / rotated.height)) * e.zoom;
  const w = rotated.width * scale,
    h = rotated.height * scale;
  const x = ((width - w) * e.x) / 100,
    y = ((height - h) * e.y) / 100;
  ctx.save();
  ctx.filter = `brightness(${e.brightness}%) contrast(${e.contrast}%)`;
  ctx.drawImage(rotated, x, y, w, h);
  ctx.restore();
  if (e.warmth) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle =
      e.warmth > 0
        ? `rgba(255,145,30,${e.warmth / 300})`
        : `rgba(50,135,255,${-e.warmth / 300})`;
    ctx.fillRect(
      Math.max(0, x),
      Math.max(0, y),
      Math.min(width, w),
      Math.min(height, h),
    );
    ctx.restore();
  }
}
export function canvasBlob(
  canvas: HTMLCanvasElement,
  mime = "image/jpeg",
  quality = 0.94,
) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(Error("The image could not be saved. Please try again.")),
      mime,
      quality,
    ),
  );
}
export async function photoExport(
  aid: string,
  format: PhotoFormat,
  edits: Partial<Adjustments> = {},
) {
  const original = await fetch(`/api/assets/${aid}?original=1&download=1`);
  if (!original.ok)
    throw Error("This photo could not be opened. Please try again.");
  const originalBlob = await original.blob();
  // HEIC/HEIF originals stay available unchanged; browsers use their normalized JPEG for crops.
  const im = ["image/heic", "image/heif"].includes(originalBlob.type)
    ? await imageBitmap(`/api/assets/${aid}?download=1`)
    : await createImageBitmap(originalBlob);
  try {
    const profile = formats[format];
    const delivery = format in catalogProfiles;
    const spec = catalogProfiles[format as keyof typeof catalogProfiles];
    const e = {
      ...emptyAdjustments,
      ...edits,
      ...(delivery ? { fit: false } : {}),
    };
    const rw = e.rotate % 180 ? im.height : im.width,
      rh = e.rotate % 180 ? im.width : im.height;
    const cropW = Math.min(rw, rh * profile.ratio) / e.zoom,
      cropH = cropW / profile.ratio;
    let width: number = profile.width,
      height: number = profile.height;
    if (delivery) {
      if (cropW < spec.minWidth || cropH < spec.minHeight)
        throw Error(
          `This crop is too small for ${profile.label}. Use a wider, higher-resolution photo; enlarging it will not add detail.`,
        );
      const scale = Math.min(1, cropW / width, cropH / height);
      width = Math.floor(width * scale);
      height = Math.round(width / profile.ratio);
    } else {
      const scale = Math.min(
        1,
        (e.fit ? rw : cropW) / width,
        (e.fit ? rh : cropH) / height,
      );
      width = Math.max(1, Math.floor(width * scale));
      height = Math.max(1, Math.round(width / profile.ratio));
    }
    const canvas = document.createElement("canvas");
    drawPhoto(canvas, im, width, height, e);
    let blob = await canvasBlob(canvas, "image/jpeg", 0.96);
    const max = delivery ? spec.maxBytes : Infinity;
    for (const quality of [0.95, 0.94]) {
      if (blob.size <= max) break;
      blob = await canvasBlob(canvas, "image/jpeg", quality);
    }
    if (blob.size > max)
      throw Error(
        "This file exceeds the destination’s size limit at full quality. Try a different crop or download the full-quality image.",
      );
    return { blob, width, height };
  } finally {
    im.close();
  }
}
export async function masterPhotoExport(aid: string) {
  const res = await fetch(`/api/assets/${aid}?original=1&download=1`);
  if (!res.ok)
    throw Error("This photo could not be downloaded. Please try again.");
  const blob = await res.blob();
  const extension = (
    {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
    } as Record<string, string>
  )[blob.type];
  if (!extension) throw Error("This file is not a supported image.");
  return { blob, extension };
}
export { renderPost } from "./post-render";
export async function campaignZip(draft: Row, restaurant: Row) {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  for (const channel of draft.channels) {
    const n = postSlideCount(draft, channel);
    for (let i = 0; i < n; i++) {
      const canvas = document.createElement("canvas");
      await renderPost(canvas, draft, restaurant, channel, i);
      files[`${channel}${n > 1 ? "-" + (i + 1) : ""}.png`] = new Uint8Array(
        await (await canvasBlob(canvas, "image/png")).arrayBuffer(),
      );
    }
  }
  files["caption.txt"] = strToU8(draft.caption || "");
  return new Blob([zipSync(files, { level: 1 }) as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}
export async function menuPdf(menu: Row) {
  return (await import("./menu-print")).renderMenuPdf(menu);
}
