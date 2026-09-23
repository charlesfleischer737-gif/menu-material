import { photoStyles } from "./studio";
import type { Row } from "./client";
export function capturedPhotoRecipe(context: Row): Row {
  const details = context.details || {},
    c = details.controls || {},
    look = details.lookContext || {};
  if (!context.jobId)
    return {
      sourceId: context.sourceId || "",
      look: "keep",
      mode: "photo",
      photoStyleSnapshot: null,
      photoReferenceIds: [],
      referenceId: "",
      savedLookId: "",
      savedLookName: "",
      savedLookVersion: null,
      occasionId: "",
      surface: "As shown",
      lighting: "As shown",
      plate: "keep",
      angle: "keep",
      composition: "Full dish",
      studioOverrides: [],
    };
  return {
    look:
      look.presetId ||
      photoStyles.find((style) => style.prompt === details.style?.photoStyle)
        ?.id ||
      "keep",
    photoStyleSnapshot: details.style?.photoStyle ?? details.setting ?? null,
    photoReferenceIds: details.style?.referenceIds || [],
    referenceId: details.style?.referenceIds?.[0] || "",
    sourceId: context.sourceId || "",
    mode: context.inputMethod === "description" ? "description" : "photo",
    surface: c.surface || "As shown",
    lighting: c.lighting || "As shown",
    plate: c.plate || "keep",
    angle: c.angle || "keep",
    composition: c.composition || "Full dish",
    format: c.format || "menu",
    savedLookId: look.savedLookId || "",
    savedLookVersion: look.version || null,
    savedLookName: look.name || "Saved photo look",
    occasionId: look.occasionId || "",
    studioOverrides: look.overrides || [],
    styleChosen: true,
    styleIntent: true,
    studioDefaultResolved: true,
  };
}
export function photoLookContext(draft: Row) {
  return {
    presetId: draft.look,
    savedLookId: draft.savedLookId || undefined,
    version: draft.savedLookVersion || undefined,
    name: draft.savedLookName || undefined,
    occasionId: draft.occasionId || "",
    overrides: draft.studioOverrides || [],
  };
}
