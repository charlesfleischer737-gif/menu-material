import { z } from "zod";
import { PIPELINE_VERSION, looks } from "../studio";
import { assert, event, one, run, type Row } from "./core";

const fields = z
  .object({
    mode: z.enum(["open", "pilot", "paused"]),
    pilotRestaurantIds: z.array(z.string().uuid()).max(200),
    disabledStyleIds: z
      .array(
        z
          .string()
          .max(80)
          .refine(
            (id) => looks.some((look) => look.id === id),
            "Choose an existing look.",
          ),
      )
      .max(100),
    disabledPipelines: z.array(z.string().min(1).max(100)).max(30),
  })
  .strict();
const schema = fields.extend({ revision: z.number().int().min(0) });
const defaults = {
  revision: 0,
  mode: "open" as const,
  pilotRestaurantIds: [] as string[],
  disabledStyleIds: [] as string[],
  disabledPipelines: [] as string[],
};
export async function studioReleaseControls() {
  const row = await one(
    "SELECT value FROM app_settings WHERE key='studio-release'",
  );
  return readControls(row);
}
function readControls(row: Row | null) {
  if (!row) return { ...defaults };
  try {
    const parsed = schema.safeParse(JSON.parse(row.value));
    if (parsed.success) return parsed.data;
  } catch {}
  return { ...defaults, mode: "paused" as const, configurationError: true };
}
export async function saveStudioRelease(input: unknown) {
  const next = schema.parse(input),
    stored = await one(
      "SELECT value FROM app_settings WHERE key='studio-release'",
    ),
    current = readControls(stored);
  const normalized = fields.parse({
    mode: next.mode,
    pilotRestaurantIds: [...new Set(next.pilotRestaurantIds)].sort(),
    disabledStyleIds: [...new Set(next.disabledStyleIds)].sort(),
    disabledPipelines: [...new Set(next.disabledPipelines)].sort(),
  });
  const currentFields = {
    mode: current.mode,
    pilotRestaurantIds: current.pilotRestaurantIds,
    disabledStyleIds: current.disabledStyleIds,
    disabledPipelines: current.disabledPipelines,
  };
  if (
    !("configurationError" in current) &&
    JSON.stringify(normalized) === JSON.stringify(currentFields)
  )
    return current;
  assert(
    next.revision === current.revision,
    409,
    "Photo Studio availability changed. Refresh before saving.",
  );
  for (const restaurantId of normalized.pilotRestaurantIds)
    assert(
      await one("SELECT id FROM restaurants WHERE id=?", restaurantId),
      400,
      "A selected restaurant is no longer available.",
    );
  const saved = { ...normalized, revision: current.revision + 1 };
  const result = stored
    ? await run(
        "UPDATE app_settings SET value=? WHERE key='studio-release' AND value=?",
        JSON.stringify(saved),
        stored.value,
      )
    : await run(
        "INSERT INTO app_settings (key,value) VALUES ('studio-release',?) ON CONFLICT(key) DO NOTHING",
        JSON.stringify(saved),
      );
  assert(
    result.meta.changes,
    409,
    "Photo Studio availability changed. Refresh before saving.",
  );
  await event(null, "studio_release_updated", null, {
    revision: saved.revision,
    mode: saved.mode,
    disabledStyleCount: saved.disabledStyleIds.length,
    pilotRestaurantCount: saved.pilotRestaurantIds.length,
  });
  return saved;
}
export async function studioAvailability(restaurantId?: string) {
  const controls = await studioReleaseControls();
  const creationEnabled =
    controls.mode !== "paused" &&
    (controls.mode !== "pilot" ||
      (!!restaurantId && controls.pilotRestaurantIds.includes(restaurantId))) &&
    !controls.disabledPipelines.includes(PIPELINE_VERSION);
  return {
    revision: controls.revision,
    creationEnabled,
    disabledStyleIds: controls.disabledStyleIds,
    message: creationEnabled
      ? ""
      : controls.mode === "pilot" &&
          (!restaurantId || !controls.pilotRestaurantIds.includes(restaurantId))
        ? "Photo creation is not available for this restaurant yet. Your saved photos are ready to use."
        : "Photo creation is temporarily paused. Your draft and saved photos are safe.",
  };
}
export async function checkStudioGeneration(
  restaurantId: string,
  details: Row,
) {
  const controls = await studioReleaseControls();
  assert(
    controls.mode !== "paused" &&
      (controls.mode !== "pilot" ||
        controls.pilotRestaurantIds.includes(restaurantId)),
    423,
    "Photo creation is temporarily paused for this restaurant. Your draft and saved photos are safe.",
  );
  assert(
    !controls.disabledPipelines.includes(details.pipelineVersion || "legacy"),
    423,
    "This photo creation version is paused. Your saved photos are safe. Start a new photo when creation is available.",
  );
  const styleId = details.lookContext?.presetId;
  const blocked =
    controls.disabledStyleIds.includes(styleId) ||
    controls.disabledStyleIds.some((id) => {
      const prompt = looks.find((look) => look.id === id)?.prompt;
      return (
        !!prompt &&
        [
          prompt,
          prompt.replace(
            "Straight overhead",
            "Preserve the original angle in this",
          ),
        ].includes(details.style?.photoStyle)
      );
    });
  assert(
    !blocked,
    423,
    "This look is temporarily unavailable. Choose another look; your original photo is safe.",
  );
}
