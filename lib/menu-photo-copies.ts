import { api } from "./client";
import { canvasBlob, imageBitmap, type PhotoCanvas } from "./photo-export";

/**
 * After a menu is published, make the smaller copies of its photos that
 * guests' phones download (lib/server/photo-variants.ts). It runs in the
 * background, one photo at a time to spare phones' memory, and is best
 * effort: a photo without copies is served at full size.
 */
export async function preparePhotoCopies(photoIds: string[]) {
  const ids = [...new Set(photoIds.filter(Boolean))];
  if (!ids.length || typeof createImageBitmap !== "function") return;
  const { needed } = (await api("assets/variants", { ids })) as {
    needed: Record<string, number[]>;
  };
  for (const [id, widths] of Object.entries(needed)) {
    try {
      const bitmap = await imageBitmap(`/api/assets/${id}`);
      try {
        const form = new FormData(),
          skip: number[] = [];
        for (const width of widths) {
          // A photo already this small needs no copy at this width.
          if (width >= bitmap.width) {
            skip.push(width);
            continue;
          }
          const height = Math.max(
            1,
            Math.round((bitmap.height * width) / bitmap.width),
          );
          const canvas: PhotoCanvas =
            typeof OffscreenCanvas === "function"
              ? new OffscreenCanvas(width, height)
              : Object.assign(document.createElement("canvas"), {
                  width,
                  height,
                });
          const context = canvas.getContext("2d") as
            | CanvasRenderingContext2D
            | OffscreenCanvasRenderingContext2D
            | null;
          if (!context) throw Error("Canvas unavailable.");
          context.imageSmoothingQuality = "high";
          context.drawImage(bitmap, 0, 0, width, height);
          form.set(
            `w${width}`,
            await canvasBlob(canvas, "image/jpeg", 0.82),
            `w${width}.jpg`,
          );
          // Release the pixels now; iPhones keep few canvases alive.
          canvas.width = 1;
          canvas.height = 1;
        }
        if (skip.length) form.set("skip", skip.join(","));
        await api(`assets/${id}/variants`, form);
      } finally {
        bitmap.close();
      }
    } catch {
      // Guests are served the full photo instead.
    }
  }
}
/** The photos a menu shows guests. */
export const menuPhotoIds = (menu: {
  sections: { items: { photoId?: string | null; visible?: boolean }[] }[];
}) =>
  menu.sections.flatMap((s) =>
    s.items.flatMap((i) => (i.photoId && i.visible !== false ? [i.photoId] : [])),
  );
