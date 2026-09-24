// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows and drafts are loosely shaped JSON from SQL and the API
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
          "The service couldn’t complete that action. Please try again.",
      ),
      {
        status: res.status,
      },
    );
  if (!data)
    throw Error(
      "The service returned an incomplete response. Please try again.",
    );
  return data;
}
export async function normalizePhoto(file: File): Promise<Blob> {
  if (!file.size)
    throw Error("This photo is empty. Please choose another photo.");
  if (file.size > 20 * 1024 * 1024)
    throw Error("Please choose a photo smaller than 20 MB.");
  let bitmap: ImageBitmap;
  try {
    // Let devices with native HEIC support keep orientation and avoid conversion.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)) {
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
          "This HEIC photo couldn’t be opened. Choose a JPEG version, or use Take a photo.",
        );
      }
    } else
      throw Error(
        "This photo couldn’t be opened. Choose a JPG, PNG or HEIC photo and try again.",
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
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(price / 100);
}

export function dishCount(count: number) {
  return `${count} ${count === 1 ? "dish" : "dishes"}`;
}
