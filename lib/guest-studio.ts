import { api, type Row } from "./client";
import { styleFor, emptyAdjustments, resolvePhotoLook } from "./studio";
import { photoLookContext } from "./photo-recipe";
import { activeInspirationId } from "./studio-reference";
import { hasProFeatures } from "./upgrade";
import {
  rememberPreference,
  workspacePreferenceKey,
} from "./workspace-navigation";
export type GuestPhoto = { file: File; normalized: Blob; url: string };
// What's in a photo chosen before signup, to suggest styles. Only a small
// copy is sent (the model reads photos at 512 px), and nothing is stored.
export async function readGuestPhoto(normalized: Blob) {
  const bitmap = await createImageBitmap(normalized);
  const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const copy = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(Error("Photo could not be prepared.")),
      "image/jpeg",
      0.85,
    ),
  );
  const form = new FormData();
  form.set("file", copy, "photo.jpg");
  return api("guest-photo-analysis", form);
}
export type GuestTransfer = {
  id: string;
  revision: number;
  requestKey: string;
  dishId?: string;
  sourceId?: string;
  referenceId?: string;
  jobId?: string;
  startedAt?: number;
  restaurantId?: string;
  dishKey?: string;
  sourceRequestKey?: string;
  referenceRequestKey?: string;
};
// `create: false` hands the draft over without creating the image: after a
// guest signs in, their work continues in the workspace Photo Studio.
export async function transferGuestPhoto(
  draft: Row,
  photo: GuestPhoto | null,
  reference: GuestPhoto | null,
  state: Row,
  transfer: GuestTransfer,
  persistProgress: () => Promise<void> = async () => {},
  { create = true }: { create?: boolean } = {},
) {
  const activeReference = activeInspirationId(draft, state.restaurant);
  if ((draft.look === "reference" || activeReference) && !reference)
    throw Error(
      "Add an inspiration photo, or choose another look to continue.",
    );
  // Inspiration photos are Pro: say so before anything is saved.
  if (
    (draft.look === "reference" || activeReference) &&
    create &&
    !hasProFeatures(state)
  )
    throw Object.assign(
      Error(
        "Inspiration photos are part of Pro. Choose another look to make this image on the free plan.",
      ),
      { code: "pro_required", feature: "savedLooks" },
    );
  if (transfer.restaurantId && transfer.restaurantId !== state.restaurant.id)
    throw Error(
      "This draft was started in another restaurant account. Sign back in to that account to continue.",
    );
  transfer.restaurantId = state.restaurant.id;
  transfer.dishKey ||= crypto.randomUUID();
  transfer.sourceRequestKey ||= crypto.randomUUID();
  transfer.referenceRequestKey ||= crypto.randomUUID();
  await persistProgress();
  // Keep successful intermediate IDs for a retry. Job submission remains
  // idempotent even when the server's response is interrupted.
  if (!transfer.dishId)
    transfer.dishId = (
      await api("dishes", {
        creationId: transfer.dishKey,
        name: draft.name.trim() || "Untitled dish",
        description: draft.description || "",
        confirmed: true,
        // The sample stays a sample: out of menus, posts and publishing.
        sample: !!draft.sample,
        setting: resolvePhotoLook(draft)
          ? styleFor(draft, state.restaurant).photoStyle
          : "",
      })
    ).id;
  await persistProgress();
  for (const [asset, kind, key] of [
    [photo, "source", "sourceId"],
    [reference, "reference", "referenceId"],
  ] as const) {
    if (!asset || transfer[key]) continue;
    const form = new FormData();
    form.set("file", asset.file);
    form.set("normalized", asset.normalized, "working.jpg");
    form.set("dishId", transfer.dishId!);
    form.set("kind", kind);
    form.set(
      "requestKey",
      kind === "source"
        ? transfer.sourceRequestKey!
        : transfer.referenceRequestKey!,
    );
    transfer[key] = (await api("assets", form)).id;
    await persistProgress();
  }
  // What the photo shows, read here or said by the owner, stays with the saved
  // photo, so the workspace doesn't read it again or lose the owner's choice.
  const analyzed =
    draft.mode === "photo" &&
    !!transfer.sourceId &&
    draft.analysisSourceId === draft.sourceId &&
    ["ready", "manual", "uncertain"].includes(draft.analysisStatus);
  const saved = {
    ...draft,
    measurementOrigin: "guest",
    dishId: transfer.dishId,
    sourceId: transfer.sourceId || "",
    analysisSourceId: analyzed ? transfer.sourceId : "",
    referenceId: transfer.referenceId || "",
    photoReferenceIds:
      draft.photoReferenceIds == null
        ? draft.photoReferenceIds
        : draft.photoReferenceIds
            .map((referenceId: string) =>
              referenceId === draft.referenceId
                ? transfer.referenceId
                : referenceId,
            )
            .filter(Boolean),
    requestKey: transfer.requestKey,
    styleChosen: true,
    step: 1,
  };
  const persist = async (content: Row) => {
    const result = await api("creation-drafts", {
      id: transfer.id,
      revision: transfer.revision,
      kind: "studio",
      draft: content,
    });
    transfer.revision = result.revision;
    await persistProgress();
  };
  if (!transfer.jobId) await persist(saved);
  const workspace = workspacePreferenceKey(state.user.id, state.restaurant.id);
  rememberPreference(workspace, "studio");
  rememberPreference(workspace + ":draft:studio", transfer.id);
  if (!create) {
    await importGuestFavorites();
    history.replaceState(null, "", "/#studio");
    return;
  }
  if (!transfer.jobId)
    transfer.jobId = (
      await api("jobs", {
        studioDraftId: transfer.id,
        dishId: transfer.dishId,
        sourceId: draft.mode === "photo" ? transfer.sourceId : null,
        parentId: null,
        revision: draft.note,
        requestKey: transfer.requestKey,
        candidateCount: 1,
        style: styleFor(saved, state.restaurant),
        lookContext: photoLookContext(saved),
        editMode: "preserve",
        controls: {
          format: draft.format,
          surface: draft.surface,
          lighting: draft.lighting,
          plate: draft.plate,
          angle: draft.angle,
          composition: draft.composition,
          cropX: draft.adjustments.x,
          cropY: draft.adjustments.y,
          zoom: draft.adjustments.zoom,
        },
      })
    ).id;
  await persistProgress();
  transfer.startedAt ||= Date.now();
  await persist({
    ...saved,
    jobId: transfer.jobId,
    resultId: "",
    step: 4,
    requestKey: "",
    generationStartedAt: transfer.startedAt,
    adjustments: { ...emptyAdjustments },
  });
  await importGuestFavorites();
  history.replaceState(null, "", "/#studio");
}
async function importGuestFavorites() {
  try {
    const favorites = JSON.parse(
      localStorage.getItem("menu-material:guest-look-favorites") || "[]",
    );
    if (favorites.length) {
      await api("studio-library/import-favorites", { favorites });
      localStorage.removeItem("menu-material:guest-look-favorites");
    }
  } catch {
    /* Keep device favorites for the next safe transfer attempt. */
  }
}
