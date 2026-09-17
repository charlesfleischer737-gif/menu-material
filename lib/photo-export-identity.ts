import type { Adjustments } from "./studio";

export async function photoExportEventKey(
  assetId: string,
  destination: string,
  edits?: Adjustments,
) {
  if (destination === "master") return `${assetId}:master`;
  const ordered = edits
    ? [
        edits.fit,
        edits.x,
        edits.y,
        edits.zoom,
        edits.brightness,
        edits.contrast,
        edits.warmth,
        edits.rotate,
      ]
    : [];
  const identity = JSON.stringify([
    "photo-export-v1",
    assetId,
    destination,
    ordered,
  ]);
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
