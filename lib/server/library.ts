import { z } from "zod";
import { all, assert, body, now, one, response, run, type Row } from "./core";
import { changedDishFacts } from "../dish-library";

export async function libraryRoute(req: Request, p: string[], r: Row) {
  if (p[0] !== "library") return null;
  const did = z.string().uuid().parse(p[1]);
  const dish = await one(
    "SELECT * FROM dishes WHERE id=? AND restaurant_id=?",
    did,
    r.id,
  );
  assert(dish, 404, "Dish not found.");
  if (req.method === "GET" && p[2] === "usage") {
    const drafts = await all(
      `SELECT id,kind,name,draft FROM creation_drafts WHERE restaurant_id=? AND archived_at IS NULL AND kind IN ('post','menu') AND NOT EXISTS (SELECT 1 FROM menu_documents WHERE id=creation_drafts.id) AND (EXISTS (SELECT 1 FROM json_each(creation_drafts.draft,'$.items') j WHERE json_extract(j.value,'$.dishId')=?) OR EXISTS (SELECT 1 FROM json_each(creation_drafts.draft,'$.rows') j WHERE json_extract(j.value,'$.id')=?))`,
      r.id,
      did,
      did,
    );
    const menus = await all(
      "SELECT id,draft FROM menu_documents WHERE restaurant_id=? AND archived_at IS NULL",
      r.id,
    );
    return response({
      usage: [
        ...menus.flatMap((row) => {
          const draft = JSON.parse(row.draft);
          const items = draft.sections
            .flatMap((s: Row) => s.items)
            .filter((i: Row) => i.dishId === did);
          return items.length
            ? [
                {
                  id: row.id,
                  kind: "menu",
                  title: draft.name,
                  changed: items.some(
                    (i: Row) =>
                      i.name !== dish.name ||
                      i.description !== dish.description ||
                      (i.priceMode === "single" && i.price !== dish.price),
                  ),
                },
              ]
            : [];
        }),
        ...drafts.map((row) => {
          const draft = JSON.parse(row.draft);
          const item = (row.kind === "post" ? draft.items : draft.rows)?.find(
            (i: Row) => (i.dishId || i.id) === did,
          );
          const facts = item?.facts || item?._synced;
          return {
            id: row.id,
            kind: row.kind,
            title:
              row.name ||
              draft.title ||
              draft.name ||
              (row.kind === "post" ? "Untitled post" : "Untitled menu"),
            changed: facts
              ? changedDishFacts(facts, dish).length > 0
              : item?.name !== dish.name,
          };
        }),
      ],
    });
  }
  assert(req.method === "POST" && !p[2], 405, "Method not allowed.");
  const input = z
    .object({
      preferredPhotoId: z.string().uuid().nullable().optional(),
      archived: z.boolean().optional(),
    })
    .parse(await body(req));
  if (input.preferredPhotoId)
    assert(
      await one(
        "SELECT id FROM assets WHERE id=? AND restaurant_id=? AND dish_id=? AND approved_at IS NOT NULL AND deleted_at IS NULL AND kind IN ('source','generated','edited')",
        input.preferredPhotoId,
        r.id,
        did,
      ),
      400,
      "Choose an approved photo from this dish.",
    );
  await run(
    "UPDATE dishes SET preferred_photo_id=CASE WHEN ? THEN ? ELSE preferred_photo_id END,archived_at=CASE WHEN ? THEN ? ELSE archived_at END,updated_at=? WHERE id=? AND restaurant_id=?",
    Number(input.preferredPhotoId !== undefined),
    input.preferredPhotoId || null,
    Number(input.archived !== undefined),
    input.archived ? now() : null,
    now(),
    did,
    r.id,
  );
  return response({ ok: true });
}
