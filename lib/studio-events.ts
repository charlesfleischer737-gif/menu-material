import { z } from "zod";
import { looks, styleCategories } from "./studio";

// Historical event names remain readable. Reporting uses this mapping once,
// rather than adding old and new names as separate successes.
export const canonicalStudioEvents: Record<string, string> = {
  studio_opened: "studio_opened",
  studio_source_ready: "source_ready",
  style_selected: "look_selected",
  look_selected: "look_selected",
  style_search_used: "style_search_used",
  customization_applied: "customization_applied",
  generation_requested: "generation_requested",
  generation_reused: "generation_reused",
  generation_completed: "generation_completed",
  generation_failed: "generation_failed",
  generation_recovered: "generation_recovered",
  image_approved: "result_approved",
  food_error_reported: "fidelity_reported",
  export_prepared: "export_prepared",
  export_download_started: "download_started",
  native_share_complete: "share_completed",
  native_share_cancelled: "share_cancelled",
  look_saved: "look_saved",
  look_reused: "look_reused",
  handoff_started: "handoff_started",
  studio_timing: "studio_timing",
};

const identifier = z.string().uuid();
const destination = z.enum([
  "toast",
  "menu",
  "feed",
  "story",
  "door",
  "doordash",
  "uber",
  "print",
  "master",
  "social",
  "delivery",
  "post",
  "photo-set",
  "pdf",
  "pack",
]);
const number = z.number().int().min(0).max(100000);
const style = z
  .string()
  .refine((value) => looks.some((look) => look.id === value));
const category = z
  .string()
  .refine((value) =>
    [
      "all",
      "saved",
      "reference",
      "keep",
      "restaurant",
      ...styleCategories.map((item) => item.id),
    ].includes(value),
  );
const fields = {
  draftId: identifier,
  sourceId: identifier,
  dishId: identifier,
  jobId: identifier,
  lookId: identifier,
  look: style,
  category,
  destination,
  format: destination,
  guest: z.boolean(),
  version: z.number().int().min(1).max(100000),
  origin: z.enum([
    "default",
    "suggestion",
    "catalog",
    "search",
    "favorite",
    "saved",
    "occasion",
    "reference",
    "recent",
    "restored",
  ]),
  device: z.enum(["phone", "tablet", "desktop", "unknown"]),
  intent: z.enum(["occasion", "setting", "mood", "subject", "other"]),
  scope: z.enum(["all", "occasions", "saved"]),
  mood: z.enum(["All", "Bright", "Warm", "Dark", "Colorful"]),
  resultCount: number,
  selectedRank: number,
  width: number,
  height: number,
  count: number,
  tool: z.enum(["studio", "post", "menu"]),
  channel: z.enum([
    "instagram",
    "facebook",
    "story",
    "square",
    "portrait",
    "feed",
    "post",
  ]),
  method: z.enum(["share", "download"]),
  controls: z
    .string()
    .refine((value) =>
      value
        .split(",")
        .every((part) =>
          [
            "",
            "surface",
            "lighting",
            "plate",
            "angle",
            "composition",
            "note",
            "crop",
          ].includes(part),
        ),
    ),
  phase: z.enum([
    "decision",
    "upload",
    "signup",
    "queue",
    "generation",
    "export",
  ]),
  milliseconds: z.number().int().min(1).max(60000),
  exportKey: z.string().regex(/^(?:[a-f0-9]{64}|[a-f0-9-]{36}:master)$/),
} as const;
const common = ["draftId", "sourceId", "guest", "device"];
const allowed: Record<string, string[]> = {
  upload_complete: [],
  style_selected: ["look", "category", "origin", "selectedRank"],
  look_selected: ["look", "lookId", "version", "origin", "selectedRank"],
  generation_submission: ["format", "look"],
  destination_selected: ["destination"],
  export_complete: [
    "format",
    "dishId",
    "width",
    "height",
    "tool",
    "channel",
    "method",
  ],
  export_prepared: ["destination", "width", "height", "count", "exportKey"],
  export_download_started: ["destination", "count", "exportKey"],
  native_share_complete: ["destination", "exportKey"],
  native_share_cancelled: ["destination", "exportKey"],
  food_issue: [],
  step_view: [],
  quick_adjustment: [],
  post_saved: [],
  photo_reused: ["dishId", "destination"],
  studio_opened: [],
  style_search_used: [
    "intent",
    "scope",
    "resultCount",
    "category",
    "mood",
    "selectedRank",
  ],
  customization_applied: ["controls"],
  handoff_started: ["destination"],
  studio_timing: ["phase", "milliseconds"],
};
export const creationEventKinds = Object.keys(allowed) as [string, ...string[]];
export function parseCreationEventDetails(kind: string, details: unknown) {
  const keys = [...common, ...(allowed[kind] || [])];
  const schema = Object.fromEntries(
    keys.map((key) => [key, fields[key as keyof typeof fields].optional()]),
  );
  if (kind === "studio_timing") {
    schema.draftId = fields.draftId as any;
    schema.phase = fields.phase as any;
    schema.milliseconds = fields.milliseconds as any;
  }
  return z.object(schema).strict().parse(details);
}
