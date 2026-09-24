import {
  formats,
  catalogProfiles,
  emptyAdjustments,
  type Adjustments,
  type PhotoFormat,
} from "./studio";
export async function imageBitmap(src: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const res = await fetch(src, signal ? { signal } : undefined);
  signal?.throwIfAborted();
  if (!res.ok) throw Error("This photo could not be opened. Please try again.");
  const blob = await res.blob();
  signal?.throwIfAborted();
  const bitmap = await createImageBitmap(blob);
  // Bitmap decoding itself is not cancellable in every browser. Release a late
  // result before rejecting so it cannot become a replacement photo's preview.
  if (signal?.aborted) {
    bitmap.close();
    signal.throwIfAborted();
  }
  return bitmap;
}
const photoTurn = (rotation: number) => ((rotation % 360) + 360) % 360;
export type PhotoCanvas = HTMLCanvasElement | OffscreenCanvas;
export function createPhotoCanvas(): PhotoCanvas {
  return typeof document === "undefined"
    ? new OffscreenCanvas(1, 1)
    : document.createElement("canvas");
}
function rotatedPhoto(im: ImageBitmap, turn: number) {
  const rotated = createPhotoCanvas();
  rotated.width = turn % 180 ? im.height : im.width;
  rotated.height = turn % 180 ? im.width : im.height;
  const rc = rotated.getContext("2d") as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  rc.translate(rotated.width / 2, rotated.height / 2);
  rc.rotate((turn * Math.PI) / 180);
  rc.drawImage(im, -im.width / 2, -im.height / 2);
  return rotated;
}
function paintPhoto(
  canvas: PhotoCanvas,
  rotated: PhotoCanvas,
  width: number,
  height: number,
  e: Adjustments,
  background: string,
) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d") as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
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
export function drawPhoto(
  canvas: PhotoCanvas,
  im: ImageBitmap,
  width: number,
  height: number,
  edits: Partial<Adjustments> = {},
  background = "#f4f1ea",
) {
  const e = { ...emptyAdjustments, ...edits };
  const rotated = rotatedPhoto(im, photoTurn(e.rotate));
  try {
    paintPhoto(canvas, rotated, width, height, e, background);
  } finally {
    rotated.width = 1;
    rotated.height = 1;
  }
}
export function createPhotoPreviewRenderer() {
  let source: ImageBitmap | null = null;
  let rotated: PhotoCanvas | null = null;
  let turn = 0;
  function clear() {
    if (rotated) {
      rotated.width = 1;
      rotated.height = 1;
    }
    rotated = null;
    source = null;
  }
  return {
    clear,
    draw(
      canvas: HTMLCanvasElement,
      im: ImageBitmap,
      width: number,
      height: number,
      edits: Partial<Adjustments> = {},
      background = "#f4f1ea",
    ) {
      const e = { ...emptyAdjustments, ...edits };
      const nextTurn = photoTurn(e.rotate);
      if (!rotated || source !== im || turn !== nextTurn) {
        clear();
        rotated = rotatedPhoto(im, nextTurn);
        source = im;
        turn = nextTurn;
      }
      paintPhoto(canvas, rotated, width, height, e, background);
    },
  };
}
export function canvasBlob(
  canvas: PhotoCanvas,
  mime = "image/jpeg",
  quality = 0.94,
) {
  if (!("toBlob" in canvas) || typeof canvas.toBlob !== "function")
    return (canvas as OffscreenCanvas).convertToBlob({ type: mime, quality });
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
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/**
 * The export size for a target shape, cropped from a source of this size.
 * Output keeps the target's exact ratio (e.g. 5:4 is always 5k × 4k, so
 * rounding can't step outside a platform's allowed range) and never exceeds
 * the target or what the source supports: enlarging adds no detail.
 * `fit` keeps the whole photo inside the frame; otherwise the frame is filled.
 */
export function exportDimensions(
  target: { width: number; height: number },
  source: { width: number; height: number },
  edits: { fit?: boolean; zoom?: number } = {},
) {
  const unit = gcd(target.width, target.height);
  const rw = target.width / unit,
    rh = target.height / unit,
    ratio = target.width / target.height;
  const zoom = edits.zoom || 1;
  const cropWidth = Math.min(source.width, source.height * ratio) / zoom,
    cropHeight = cropWidth / ratio;
  const availableWidth = edits.fit ? source.width : cropWidth,
    availableHeight = edits.fit ? source.height : cropHeight;
  const k = Math.max(
    1,
    Math.min(
      unit,
      Math.floor(Math.min(availableWidth / rw, availableHeight / rh) + 1e-9),
    ),
  );
  return { width: rw * k, height: rh * k, cropWidth, cropHeight };
}
/** Width and height after a quarter-turn rotation, if any. */
export function rotatedSize(
  image: { width: number; height: number },
  rotate = 0,
) {
  return photoTurn(rotate) % 180
    ? { width: image.height, height: image.width }
    : { width: image.width, height: image.height };
}
/** The saved original, decoded once for one or many exports. Close it after. */
export async function openOriginalPhoto(aid: string) {
  const original = await fetch(`/api/assets/${aid}?original=1&download=1`);
  if (!original.ok)
    throw Error("This photo could not be opened. Please try again.");
  const originalBlob = await original.blob();
  // HEIC/HEIF originals stay available unchanged; browsers use their normalized JPEG for crops.
  return ["image/heic", "image/heif"].includes(originalBlob.type)
    ? await imageBitmap(`/api/assets/${aid}?download=1`)
    : await createImageBitmap(originalBlob);
}
/** Draws and encodes a JPEG, easing quality only as far as needed to fit. */
export async function encodePhoto(
  im: ImageBitmap,
  width: number,
  height: number,
  edits: Adjustments,
  maxBytes = Infinity,
  qualities = [0.96, 0.95, 0.94],
) {
  const canvas = document.createElement("canvas");
  try {
    drawPhoto(canvas, im, width, height, edits);
    let blob = await canvasBlob(canvas, "image/jpeg", qualities[0]);
    for (const quality of qualities.slice(1)) {
      if (blob.size <= maxBytes) break;
      blob = await canvasBlob(canvas, "image/jpeg", quality);
    }
    if (blob.size > maxBytes)
      throw Error(
        "This file exceeds the destination’s size limit at full quality. Try a different crop or download the full-quality image.",
      );
    return { blob, width, height };
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
export async function photoExport(
  aid: string,
  format: PhotoFormat,
  edits: Partial<Adjustments> = {},
) {
  const im = await openOriginalPhoto(aid);
  try {
    const profile = formats[format];
    const delivery = format in catalogProfiles;
    const spec = catalogProfiles[format as keyof typeof catalogProfiles];
    const e = {
      ...emptyAdjustments,
      ...edits,
      ...(delivery ? { fit: false } : {}),
    };
    const { width, height } = exportDimensions(
      profile,
      rotatedSize(im, e.rotate),
      e,
    );
    if (delivery && (width < spec.minWidth || height < spec.minHeight))
      throw Error(
        `This crop is too small for ${profile.label}. Use a wider, higher-resolution photo; enlarging it will not add detail.`,
      );
    return await encodePhoto(
      im,
      width,
      height,
      e,
      delivery ? spec.maxBytes : Infinity,
    );
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
