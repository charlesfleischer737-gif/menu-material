import { renderDesignedMenuPdf } from "./menu-pdf-v2";
import type { DesignedMenu } from "./menu-document";

// This module is loaded only as a dedicated browser worker by Vite.
globalThis.onmessage = async (event: MessageEvent<DesignedMenu>) => {
  if (
    typeof OffscreenCanvas === "undefined" ||
    typeof createImageBitmap === "undefined"
  ) {
    globalThis.postMessage({ unsupported: true });
    return;
  }
  try {
    const result = await renderDesignedMenuPdf(event.data, { proof: true });
    globalThis.postMessage({ result });
  } catch (error) {
    globalThis.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "The menu preview could not be prepared.",
    });
  }
};
