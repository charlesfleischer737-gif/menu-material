import { renderPost } from "./post-render";
import { postSlideCount } from "./post-composition";
import { type Row } from "./client";
import { canvasBlob } from "./photo-export";
export {
  imageBitmap,
  drawPhoto,
  canvasBlob,
  photoExport,
  masterPhotoExport,
} from "./photo-export";
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
  if (menu.version === 2)
    return (await import("./menu-proof-client")).exportDesignedMenuPdf(
      menu as import("./menu-document").DesignedMenu,
    );
  return (await import("./menu-print")).renderMenuPdf(menu);
}
