import { publishWorkerHealth } from "./worker-health";
import { syncServerClock } from "./server-clock";
export type Row = Record<string, any>;
export async function api(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
) {
  const res = await fetch("/api/" + path, {
    signal,
    keepalive: path === "creation-events",
    method: method || (body === undefined ? "GET" : "POST"),
    headers:
      body instanceof FormData
        ? {}
        : body === undefined
          ? {}
          : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as Row | null;
  if (!res.ok)
    throw Object.assign(
      new Error(
        data?.error ||
          // The host refuses an oversized upload before the app sees it.
          (res.status === 413 && body instanceof FormData
            ? "This photo is too large to upload. Choose one under 20 MB."
            : "The service couldn’t complete that action. Please try again."),
      ),
      {
        status: res.status,
      },
    );
  if (!data)
    throw Error(
      "The service returned an incomplete response. Please try again.",
    );
  if (path === "state") {
    publishWorkerHealth(data.workerHealthy === true);
    syncServerClock(data.serverTime);
  }
  return data;
}
export async function normalizePhoto(file: File): Promise<Blob> {
  // Refuse a file the upload won't accept before anything (a dish, a draft)
  // is made for it; browsers can open more formats than the server keeps.
  const problem = await photoFileError(file);
  if (problem) throw Error(problem);
  let bitmap: ImageBitmap;
  try {
    // Let devices with native HEIC support keep orientation and avoid conversion.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if ((await filePhotoFormat(file)) === "heic") {
      try {
        const { default: heic2any } = await import("heic2any");
        const result = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        });
        bitmap = await createImageBitmap(
          Array.isArray(result) ? result[0] : result,
          { imageOrientation: "from-image" },
        );
      } catch {
        throw Error(
          "This HEIC photo couldn’t be opened. Choose a JPEG version instead.",
        );
      }
    } else
      throw Error(
        `This photo couldn’t be opened. It may be damaged. ${choosePhoto}`,
      );
  }
  if (bitmap.width * bitmap.height > 80_000_000) {
    bitmap.close();
    throw Error(
      "This photo is too large to process. Please export a smaller version.",
    );
  }
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Photo could not be prepared."))),
      "image/jpeg",
      0.9,
    ),
  );
}
/** File pickers for photos: the formats photo uploads accept. */
export const photoAccept =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const choosePhoto = "Choose a JPEG, PNG, HEIC or WebP photo.";
type PhotoFileType = "jpeg" | "png" | "webp" | "heic" | "gif" | "avif";
/**
 * The format a file's first bytes declare (its name and reported type can be
 * wrong), or null when they aren't a known photo format.
 */
export function photoFormat(bytes: Uint8Array): PhotoFileType | null {
  const text = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "jpeg";
  if (text(0, 8) === "\x89PNG\r\n\x1a\n") return "png";
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "webp";
  if (text(0, 6) === "GIF87a" || text(0, 6) === "GIF89a") return "gif";
  if (bytes.length >= 12 && text(4, 8) === "ftyp") {
    // HEIC and AVIF share one container; its brands (the major brand, then
    // compatible ones) say which. AVIF often lists HEIF's "mif1" too.
    const end = Math.min(
      bytes.length,
      new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0),
    );
    const brands = [text(8, 12)];
    for (let at = 16; at + 4 <= end; at += 4) brands.push(text(at, at + 4));
    if (brands.some((brand) => brand === "avif" || brand === "avis"))
      return "avif";
    if (brands.some((brand) => /^(heic|heix|hevc|mif1|msf1)$/.test(brand)))
      return "heic";
  }
  return null;
}
async function filePhotoFormat(file: Blob) {
  return photoFormat(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
}
/** Why a file can't be uploaded as a photo, or "" when it can. */
export async function photoFileError(file: File) {
  if (!file.size) return "This photo is empty. Please choose another photo.";
  if (file.size > 20 * 1024 * 1024)
    return "Please choose a photo smaller than 20 MB.";
  const format = await filePhotoFormat(file);
  if (format === "gif" || format === "avif")
    return `${format.toUpperCase()} files can’t be uploaded. ${choosePhoto}`;
  return format ? "" : `This file type can’t be uploaded. ${choosePhoto}`;
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Mobile save sheets may continue reading after the click handler finishes.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function money(price: number, currency = "USD") {
  // The narrow symbol reads as local guests expect: "$18.50", not "CA$18.50".
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(price / 100);
}

export function dishCount(count: number) {
  return `${count} ${count === 1 ? "dish" : "dishes"}`;
}
