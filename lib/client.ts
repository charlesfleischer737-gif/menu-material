export type Row = Record<string, any>;
export async function api(path: string, body?: unknown, method?: string) {
  const res = await fetch("/api/" + path, {
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
  const data = (await res.json()) as Row;
  if (!res.ok) throw Error(data.error || "Please try again.");
  return data;
}
export async function normalizePhoto(file: File): Promise<Blob> {
  if (file.size > 20 * 1024 * 1024)
    throw Error("Please choose a photo smaller than 20 MB.");
  let source: Blob = file;
  if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/.test(file.type)) {
    const { default: heic2any } = await import("heic2any");
    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });
    source = Array.isArray(result) ? result[0] : result;
  }
  const bitmap = await createImageBitmap(source);
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
export async function exportImage(asset: Row, format: string, ratio: string) {
  const res = await fetch(`/api/assets/${asset.id}?download=1`);
  if (!res.ok) throw Error("Approve this image before downloading.");
  const bitmap = await createImageBitmap(await res.blob());
  const aspect = ratio === "portrait" ? 4 / 5 : ratio === "story" ? 9 / 16 : 1;
  const sw = Math.min(bitmap.width, bitmap.height * aspect),
    sh = sw / aspect;
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = Math.round(1080 / aspect);
  c.getContext("2d")!.drawImage(
    bitmap,
    (bitmap.width - sw) / 2,
    (bitmap.height - sh) / 2,
    sw,
    sh,
    0,
    0,
    c.width,
    c.height,
  );
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Export failed."))),
      "image/" + format,
      0.94,
    ),
  );
  downloadBlob(blob, `sidedish-${ratio}.${format === "jpeg" ? "jpg" : "png"}`);
  await api("events", { kind: "image_downloaded", entityId: asset.id });
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function money(price: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(price / 100);
}
