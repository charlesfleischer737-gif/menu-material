import type { Row } from "./client";
import { emptyAdjustments, resolvePhotoLook, styleFor } from "./studio";
import { lookControls, studioLookPatch } from "./studio-discovery";

export type InspirationPhoto = { id: string; url: string };
export type InspirationSelection =
  | { kind: "existing"; photo: InspirationPhoto }
  | { kind: "file"; file: File; normalized: Blob; requestKey: string };
export type InspirationStatus = "ready" | "checking" | "unavailable" | "error";

export function inspirationStatusMessage(status: InspirationStatus): string {
  return status === "checking"
    ? "Checking your inspiration…"
    : status === "unavailable"
      ? "An inspiration photo is unavailable. Replace it or choose another look."
      : status === "error"
        ? "Your inspiration couldn’t be checked. Try again or choose another look."
        : "";
}

export function activeInspirationIds(
  draft: Row,
  restaurant: Row = {},
): string[] {
  if (!resolvePhotoLook(draft)) return [];
  return [...new Set<string>(styleFor(draft, restaurant).referenceIds || [])];
}

export function activeInspirationId(draft: Row, restaurant: Row = {}): string {
  return activeInspirationIds(draft, restaurant)[0] || "";
}

// Return only look controls and reference identity: a reference can never
// replace the dish source, output, or its historical lineage.
export function inspirationPatch(
  base: Row,
  referenceId: string | null,
  keepLook = false,
): Row {
  const controls = {
    ...Object.fromEntries(lookControls.map((key) => [key, base[key]])),
    studioOverrides: [...(base.studioOverrides || [])],
    note: base.note || "",
    adjustments: { ...emptyAdjustments, ...base.adjustments },
  };
  return {
    ...controls,
    ...(referenceId && !keepLook ? studioLookPatch(base, "reference") : {}),
    ...(!keepLook
      ? {
          referenceId: referenceId || "",
          photoReferenceIds: referenceId ? [referenceId] : [],
        }
      : {}),
    ...(!keepLook && (referenceId || base.look === "reference")
      ? { photoStyleSnapshot: null }
      : {}),
    ...(!keepLook
      ? { savedLookId: "", savedLookName: "", savedLookVersion: null }
      : {}),
    requestKey: "",
    styleChosen: true,
    styleIntent: true,
    selectionOrigin: "reference",
  };
}
