import { readFileSync } from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";

// Browser canvas adapter for exercising the worker module without a DOM.
export function installWorkerGraphics() {
  globalThis.OffscreenCanvas = class {
    constructor(width, height) {
      const canvas = createCanvas(width, height);
      canvas.toBlob = undefined;
      canvas.convertToBlob = async ({
        type = "image/png",
        quality = 0.94,
      } = {}) =>
        new Blob(
          [
            canvas.toBuffer(
              type,
              type === "image/jpeg" ? Math.round(quality * 100) : undefined,
            ),
          ],
          { type },
        );
      return canvas;
    }
  };
  globalThis.createImageBitmap = async (blob) => {
    const bitmap = await loadImage(Buffer.from(await blob.arrayBuffer()));
    bitmap.close = () => {};
    return bitmap;
  };
  globalThis.fetch = async (path) => {
    if (String(path).startsWith("/fonts/"))
      return new Response(readFileSync("public" + path));
    if (String(path).startsWith("/api/assets/"))
      return new Response(readFileSync("public/pasta.jpg"));
    throw Error("Unexpected worker request " + path);
  };
}
