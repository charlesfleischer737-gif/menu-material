/** Keep the Photos flow specific to iPhone; desktop and other devices retain their exports. */
export function isIPhone(userAgent: string) {
  return /\biPhone\b/i.test(userAgent);
}

export function canShareImages(files: File[]) {
  try {
    return (
      files.length > 0 &&
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      !!navigator.canShare?.({ files })
    );
  } catch {
    return false;
  }
}

export type ImageSaveResult = "shared" | "cancelled" | "downloaded";
