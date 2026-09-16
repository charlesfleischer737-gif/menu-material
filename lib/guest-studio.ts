import { api, type Row } from "./client";
import { styleFor, emptyAdjustments } from "./studio";
import {
  rememberPreference,
  workspacePreferenceKey,
} from "./workspace-navigation";
export type GuestPhoto = { file: File; normalized: Blob; url: string };
export type GuestTransfer = {
  id: string;
  revision: number;
  requestKey: string;
  dishId?: string;
  sourceId?: string;
  referenceId?: string;
  jobId?: string;
  startedAt?: number;
};
export async function transferGuestPhoto(
  draft: Row,
  photo: GuestPhoto | null,
  reference: GuestPhoto | null,
  state: Row,
  transfer: GuestTransfer,
) {
  // Keep successful intermediate IDs for a retry. Job submission remains
  // idempotent even when the server's response is interrupted.
  if (!transfer.dishId)
    transfer.dishId = (
      await api("dishes", {
        name: draft.name.trim() || "Untitled dish",
        description: draft.description || "",
        confirmed: true,
        setting: styleFor(draft, state.restaurant).photoStyle,
      })
    ).id;
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
    transfer[key] = (await api("assets", form)).id;
  }
  const saved = {
    ...draft,
    dishId: transfer.dishId,
    sourceId: transfer.sourceId || "",
    referenceId: transfer.referenceId || "",
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
  };
  if (!transfer.jobId) await persist(saved);
  const workspace = workspacePreferenceKey(state.user.id, state.restaurant.id);
  rememberPreference(workspace, "studio");
  rememberPreference(workspace + ":draft:studio", transfer.id);
  if (!transfer.jobId)
    transfer.jobId = (
      await api("jobs", {
        dishId: transfer.dishId,
        sourceId: draft.mode === "photo" ? transfer.sourceId : null,
        parentId: null,
        revision: draft.note,
        requestKey: transfer.requestKey,
        candidateCount: 1,
        style: styleFor(saved, state.restaurant),
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
  history.replaceState(null, "", "/#studio");
}
