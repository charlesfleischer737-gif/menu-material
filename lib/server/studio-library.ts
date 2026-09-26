import { z } from "zod";
import {
  studioLibrarySchema,
  emptyStudioLibrary,
  recipeFromDraft,
} from "../studio-library";
import {
  all,
  assert,
  body,
  event,
  id,
  now,
  one,
  response,
  type Row,
} from "./core";
import { requirePro } from "./entitlements";
import { looks, photoBrief } from "../studio";
import { restaurantPhotoDefaults } from "../restaurant-look";

async function presentLibrary(
  restaurantId: string,
  content: Row,
  revision: number,
) {
  const known = new Set(looks.map((look) => look.id));
  const uses = await all(
    "SELECT preset_id,MAX(used_at) AS last_used FROM studio_look_uses WHERE restaurant_id=? AND preset_id!='' GROUP BY preset_id ORDER BY last_used DESC,preset_id ASC",
    restaurantId,
  );
  return response({
    ...emptyStudioLibrary(),
    ...content,
    recent: uses
      .filter((use) => known.has(use.preset_id))
      .slice(0, 12)
      .map((use) => use.preset_id),
    revision,
  });
}

export async function studioLibraryRoute(
  req: Request,
  p: string[],
  restaurant: Row,
) {
  if (p[0] !== "studio-library") return null;
  if (p[1] === "import-favorites" && req.method === "POST") {
    const input = studioLibrarySchema.parse({
      favorites: (await body(req)).favorites,
    });
    const content = JSON.stringify({
      ...emptyStudioLibrary(),
      favorites: [...new Set(input.favorites)],
    });
    await one(
      `INSERT INTO studio_libraries (restaurant_id,content,revision,updated_at) VALUES (?,?,1,?)
      ON CONFLICT(restaurant_id) DO UPDATE SET content=json_set(studio_libraries.content,'$.favorites',json((
        SELECT json_group_array(value) FROM (SELECT value FROM json_each(studio_libraries.content,'$.favorites') UNION SELECT value FROM json_each(excluded.content,'$.favorites') LIMIT 100)
      ))),revision=studio_libraries.revision+1,updated_at=excluded.updated_at RETURNING revision`,
      restaurant.id,
      content,
      now(),
    );
    return response({ ok: true });
  }
  if (p.length !== 1) return null;
  let row = await one(
    "SELECT * FROM studio_libraries WHERE restaurant_id=?",
    restaurant.id,
  );
  if (req.method === "GET") {
    const current = studioLibrarySchema.parse({
      ...JSON.parse(row?.content || "{}"),
      recent: [],
    });
    const style =
      typeof restaurant.style === "string"
        ? JSON.parse(restaurant.style || "{}")
        : restaurant.style || {};
    if (
      !current.legacyMigrated &&
      (style.photoPreset || style.referenceIds?.length) &&
      current.looks.length < 100
    ) {
      const restaurantLook = {
        ...restaurant,
        style: { ...style, autoApply: true },
      };
      const recipe = recipeFromDraft(
        { ...photoBrief(), ...restaurantPhotoDefaults(restaurantLook) },
        restaurantLook,
      );
      const look = {
        id: id(),
        name: "Original restaurant look",
        recipe,
        previewAssetId: null,
        archived: false,
        version: 1,
        compatibleSubjects:
          recipe.plate === "keep" ? ["food", "drinks"] : ["food"],
      };
      const next = studioLibrarySchema.parse({
        ...current,
        legacyMigrated: true,
        looks: [...current.looks, look],
        defaultLookId:
          current.defaultLookId || (style.autoApply === true ? look.id : null),
      });
      await one(
        "INSERT INTO studio_libraries (restaurant_id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(restaurant_id) DO UPDATE SET content=excluded.content,revision=studio_libraries.revision+1,updated_at=excluded.updated_at WHERE studio_libraries.revision=? RETURNING revision",
        restaurant.id,
        JSON.stringify(next),
        now(),
        row?.revision || 0,
      );
      row = await one(
        "SELECT * FROM studio_libraries WHERE restaurant_id=?",
        restaurant.id,
      );
    }
    return presentLibrary(
      restaurant.id,
      JSON.parse(row?.content || "{}"),
      row?.revision || 0,
    );
  }
  assert(req.method === "PUT", 405, "This action is unavailable.");
  const input = z
    .object({
      revision: z.number().int().min(0),
      library: z.preprocess(
        (value) =>
          value && typeof value === "object" && !Array.isArray(value)
            ? { ...value, recent: [] }
            : value,
        studioLibrarySchema,
      ),
    })
    .parse(await body(req));
  input.library.favorites = [...new Set(input.library.favorites)];
  // Recency belongs to accepted jobs, never editable library or selection data.
  input.library.recent = [];
  input.library.legacyMigrated ||= !!JSON.parse(row?.content || "{}")
    .legacyMigrated;
  const previous = JSON.parse(row?.content || "{}").looks || [];
  // Saving a new look is Pro. Looks already saved can be renamed or archived.
  if (
    input.library.looks.some(
      (look) => !previous.some((entry: Row) => entry.id === look.id),
    )
  )
    await requirePro(restaurant.id, "savedLooks");
  for (const look of input.library.looks) {
    const saved = previous.find((entry: Row) => entry.id === look.id);
    look.version = saved
      ? (saved.version || 1) +
        (JSON.stringify(saved.recipe) === JSON.stringify(look.recipe) ? 0 : 1)
      : 1;
    // Keep old recipes usable in history even if a reference was later removed.
    // New or changed reference context must always pass current ownership checks.
    const unchangedReferences =
      saved &&
      JSON.stringify(saved.recipe.photoReferenceIds) ===
        JSON.stringify(look.recipe.photoReferenceIds);
    for (const assetId of look.recipe.photoReferenceIds) {
      if (unchangedReferences) continue;
      assert(
        await one(
          "SELECT id FROM assets WHERE id=? AND restaurant_id=? AND (kind='reference' OR (kind IN ('generated','edited') AND approved_at IS NOT NULL AND needs_correction=0)) AND deleted_at IS NULL",
          assetId,
          restaurant.id,
        ),
        400,
        "An inspiration photo is unavailable. Add it again before saving this look.",
      );
    }
    if (look.previewAssetId && look.previewAssetId !== saved?.previewAssetId)
      assert(
        await one(
          "SELECT id FROM assets WHERE id=? AND restaurant_id=? AND approved_at IS NOT NULL AND needs_correction=0 AND deleted_at IS NULL",
          look.previewAssetId,
          restaurant.id,
        ),
        400,
        "The saved look preview is unavailable.",
      );
  }
  const content = JSON.stringify(input.library);
  assert(
    content.length <= 99000,
    400,
    "Your saved look collection is full. You can still use or update your existing looks.",
  );
  if (row?.content === content)
    return presentLibrary(restaurant.id, input.library, row.revision);
  const result =
    (await one(
      "INSERT INTO studio_libraries (restaurant_id,content,revision,updated_at) SELECT ?,?,1,? WHERE ?=0 ON CONFLICT(restaurant_id) DO NOTHING RETURNING revision",
      restaurant.id,
      content,
      now(),
      input.revision,
    )) ||
    (await one(
      "UPDATE studio_libraries SET content=?,revision=revision+1,updated_at=? WHERE restaurant_id=? AND revision=? RETURNING revision",
      content,
      now(),
      restaurant.id,
      input.revision,
    ));
  assert(
    result,
    409,
    "Your saved looks changed in another window. Reload saved looks and try again.",
  );
  for (const look of input.library.looks) {
    const before = previous.find((item: Row) => item.id === look.id);
    if (!before || before.version !== look.version)
      await event(
        restaurant.id,
        "look_saved",
        null,
        { lookId: look.id, version: look.version },
        `${look.id}:${look.version}`,
      ).catch(() => {});
  }
  return presentLibrary(restaurant.id, input.library, result.revision);
}
