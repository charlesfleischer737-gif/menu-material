import { renderPost } from "./post-render";
import { postSlideCount } from "./post-composition";
import { postFileName } from "./sharing";
import { release } from "./post-kit";
import { type Row } from "./client";
import { canvasBlob } from "./photo-export";
export { canvasBlob, photoExport, masterPhotoExport } from "./photo-export";
export { renderPost } from "./post-render";
export async function campaignZip(draft: Row, restaurant: Row) {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  // One full-size canvas serves every image, and is freed at the end.
  const canvas = document.createElement("canvas");
  try {
    for (const channel of draft.channels) {
      const n = postSlideCount(draft, channel);
      for (let i = 0; i < n; i++) {
        await renderPost(canvas, draft, restaurant, channel, i);
        files[`${postFileName(channel)}${n > 1 ? "-" + (i + 1) : ""}.png`] =
          new Uint8Array(
            await (await canvasBlob(canvas, "image/png")).arrayBuffer(),
          );
      }
    }
  } finally {
    release(canvas);
  }
  files["caption.txt"] = strToU8(draft.caption || "");
  return new Blob([zipSync(files, { level: 1 }) as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}
