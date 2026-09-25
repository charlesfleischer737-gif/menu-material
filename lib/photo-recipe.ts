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
export function jobDetails(job?: Row): Row {
  try {
    return JSON.parse(job?.details || "{}") || {};
  } catch {
    return {};
  }
}
/** A complimentary food correction, which is never a paid request. */
export const isCorrection = (job?: Row) =>
  !!job &&
  (!!jobDetails(job).correctionFor ||
    String(job.credit_period || "").startsWith("complimentary:"));
/**
 * The request that sends a failed image again exactly as it was made: its
 * photo, requested change, style and controls, whatever the draft has moved
 * on to since. A food correction is never sent again this way, as a paid
 * image: it has none.
 */
export function failedImageRequest(job: Row): Row | null {
  if (isCorrection(job)) return null;
  const details = jobDetails(job);
  return {
    dishId: job.dish_id,
    sourceId: job.source_id || null,
    parentId: job.parent_id || null,
    revision: job.prompt || "",
    candidateCount: details.candidateCount || 1,
    style: details.style,
    lookContext: details.lookContext || null,
    editMode: details.editMode || "preserve",
    controls: details.controls || {},
  };
}
