import { z } from "zod";
import {
  all,
  assert,
  body,
  bucket,
  db,
  digest,
  event,
  id,
  now,
  one,
  response,
  run,
  type Row,
} from "./core";
import { defaultStyle, localToInstant, promotionStatus } from "../promotions";

export const styleSchema = z.object({
  primary: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default(defaultStyle.primary),
  accent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default(defaultStyle.accent),
  tone: z.string().max(150).default(defaultStyle.tone),
  photoStyle: z.string().max(300).default(defaultStyle.photoStyle),
  referenceIds: z.array(z.string().uuid()).max(3).default([]),
});
export async function validateStyle(
  r: Row,
  style: z.infer<typeof styleSchema>,
) {
  for (const aid of style.referenceIds)
    assert(
      await one(
        "SELECT id FROM assets WHERE id=? AND restaurant_id=? AND kind='reference' AND deleted_at IS NULL",
        aid,
        r.id,
      ),
      400,
      "Choose style references from your restaurant.",
    );
}
const offerSchema = z.object({
  type: z
    .enum(["special", "lunch", "family", "catering", "happy_hour"])
    .default("special"),
  title: z.string().trim().max(90).default(""),
  description: z.string().max(500).default(""),
  price: z.number().int().min(0).max(100000000).default(0),
  caption: z.string().max(2200).default(""),
  startsLocal: z.string().max(16).default(""),
  endsLocal: z.string().max(16).default(""),
  occurrence: z.enum(["earlier", "later"]).default("earlier"),
  items: z
    .array(
      z.object({
        dishId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100),
        photoId: z.string().uuid().nullable(),
      }),
    )
    .max(6)
    .default([]),
  style: styleSchema,
  useDefaults: z.boolean().default(true),
  template: z.enum(["classic", "bold"]).default("classic"),
  editMode: z.enum(["preserve", "style"]).default("preserve"),
  cropX: z.number().min(0).max(100).default(50),
  cropY: z.number().min(0).max(100).default(50),
  activeMs: z.number().int().min(0).max(86400000).default(0),
  revision: z.number().int().min(1).optional(),
});
export function offerRow(p: Row) {
  return {
    ...p,
    draft: JSON.parse(p.draft),
    published: p.published ? JSON.parse(p.published) : null,
    status: promotionStatus(p),
  };
}
export function offerHash(d: Row) {
  const { activeMs: _a, revision: _r, ...design } = d;
  return digest(JSON.stringify(design));
}
async function offerContent(r: Row, draft: Row, ready = false) {
  const items = [];
  const seen = new Set<string>();
  for (const item of draft.items) {
    assert(
      !seen.has(item.dishId),
      400,
      "Select each dish once and set its quantity.",
    );
    seen.add(item.dishId);
    const dish = await one(
      "SELECT * FROM dishes WHERE id=? AND restaurant_id=?",
      item.dishId,
      r.id,
    );
    assert(dish, 404, "Dish not found.");
    const asset = item.photoId
      ? await one(
          "SELECT * FROM assets WHERE id=? AND restaurant_id=? AND dish_id=? AND kind IN ('source','generated','edited') AND deleted_at IS NULL",
          item.photoId,
          r.id,
          item.dishId,
        )
      : null;
    assert(!item.photoId || asset, 404, "Photo not found.");
    if (ready) {
      assert(
        dish.available,
        400,
        `${dish.name} is unavailable. Update the dish or choose another.`,
      );
      assert(
        asset?.approved_at,
        400,
        `Approve an accurate photo of ${dish.name} first.`,
      );
    }
    items.push({ ...item, name: dish.name });
  }
  await validateStyle(r, draft.style);
  return items;
}
async function copyPublic(r: Row, aid: string) {
  const a = await one(
    "SELECT * FROM assets WHERE id=? AND restaurant_id=? AND deleted_at IS NULL",
    aid,
    r.id,
  );
  assert(a, 400, "A selected image is unavailable.");
  const obj = await bucket().get(a.working_key || a.key);
  assert(obj, 400, "A selected image is unavailable.");
  await bucket().put(`public/${r.id}/${a.id}`, await obj.arrayBuffer(), {
    httpMetadata: { contentType: a.working_key ? "image/jpeg" : a.mime },
  });
}
export async function publicMenu(r: Row, t = now()) {
  if (!r.published) return null;
  const menu = JSON.parse(r.published);
  const live = await all(
    "SELECT * FROM promotions WHERE restaurant_id=? AND published IS NOT NULL AND starts_at<=? AND ends_at>? AND sold_out=0",
    r.id,
    t,
    t,
  );
  const specials = [];
  for (const p of live) {
    const content = JSON.parse(p.published);
    let available = true;
    for (const item of content.items) {
      if (
        !(await one(
          "SELECT id FROM dishes WHERE id=? AND restaurant_id=? AND available=1",
          item.dishId,
          r.id,
        ))
      )
        available = false;
      if (
        !(await one(
          "SELECT id FROM assets WHERE id=? AND restaurant_id=? AND approved_at IS NOT NULL AND deleted_at IS NULL",
          item.photoId,
          r.id,
        ))
      )
        available = false;
    }
    if (available)
      specials.push({
        ...content,
        id: p.id,
        startsAt: p.starts_at,
        endsAt: p.ends_at,
      });
  }
  return { ...menu, specials, serverNow: t };
}
export async function promotionRoute(req: Request, p: string[], r: Row) {
  if (p[0] !== "promotions") return null;
  if (req.method === "GET" && !p[1])
    return response({
      promotions: (
        await all(
          "SELECT * FROM promotions WHERE restaurant_id=? ORDER BY updated_at DESC",
          r.id,
        )
      ).map(offerRow),
    });
  const existing = p[1]
    ? await one(
        "SELECT * FROM promotions WHERE id=? AND restaurant_id=?",
        p[1],
        r.id,
      )
    : null;
  assert(!p[1] || existing, 404, "Promotion not found.");
  if (req.method === "GET") return response({ promotion: offerRow(existing!) });
  assert(req.method === "POST", 405, "Method not allowed.");
  const b = await body(req);
  if (p[2]) {
    const saved = existing!,
      draft = JSON.parse(saved.draft);
    if (p[2] === "unpublish" || p[2] === "sold-out") {
      await run(
        p[2] === "unpublish"
          ? "UPDATE promotions SET published=NULL,updated_at=? WHERE id=?"
          : "UPDATE promotions SET sold_out=1,updated_at=? WHERE id=?",
        now(),
        saved.id,
      );
      await event(
        r.id,
        p[2] === "unpublish" ? "promotion_unpublished" : "promotion_sold_out",
        saved.id,
      );
      return response({ ok: true });
    }
    assert(
      b.revision === saved.revision,
      409,
      "This promotion changed in another window. Reload it before continuing.",
    );
    if (p[2] === "export" || p[2] === "copy-caption") {
      assert(
        saved.approved_hash === offerHash(draft),
        400,
        "Approve the current version first.",
      );
      const format =
        p[2] === "copy-caption"
          ? "caption"
          : z
              .enum(["feed", "story", "sign", "clean", "landscape", "doordash"])
              .parse(b.format);
      await event(
        r.id,
        p[2] === "export" ? "promotion_exported" : "caption_copied",
        saved.id,
        { format, revision: saved.revision },
      );
      return response({ ok: true });
    }
    const items = await offerContent(r, draft, true);
    assert(
      draft.title.trim() && items.length,
      400,
      "Add a title and at least one dish.",
    );
    let startsAt: number, endsAt: number;
    try {
      startsAt = localToInstant(
        draft.startsLocal,
        r.timezone,
        draft.occurrence,
      );
      endsAt = localToInstant(draft.endsLocal, r.timezone, draft.occurrence);
    } catch (e) {
      assert(false, 400, (e as Error).message);
    }
    assert(
      endsAt > startsAt && endsAt > now(),
      400,
      "Choose an end time after the start and in the future.",
    );
    const hash = offerHash(draft);
    if (p[2] === "approve") {
      assert(
        b.accurate === true,
        400,
        "Confirm the photos, quantities, price and times.",
      );
      const result = await run(
        "UPDATE promotions SET approved_hash=?,approved_at=? WHERE id=? AND revision=?",
        hash,
        now(),
        saved.id,
        saved.revision,
      );
      assert(
        result.meta.changes,
        409,
        "This promotion changed. Review it again.",
      );
      if (saved.approved_hash !== hash)
        await event(r.id, "promotion_approved", saved.id, {
          activeMs: draft.activeMs,
          revision: saved.revision,
        });
      return response({ ok: true });
    }
    if (p[2] === "publish") {
      assert(
        saved.approved_hash === hash,
        400,
        "Approve the current version before publishing.",
      );
      for (const item of items) await copyPublic(r, item.photoId);
      if (r.logo_id) await copyPublic(r, r.logo_id);
      const restaurant = {
        name: r.name,
        cuisine: r.cuisine,
        currency: r.currency,
        logoId: r.logo_id,
        orderingUrl: r.ordering_url,
        timezone: r.timezone,
        hours: JSON.parse(r.hours),
      };
      const published = { ...draft, items, restaurant, timezone: r.timezone };
      await db().batch([
        db()
          .prepare(
            "UPDATE promotions SET published=?,starts_at=?,ends_at=?,sold_out=0,updated_at=? WHERE id=? AND revision=? AND approved_hash=?",
          )
          .bind(
            JSON.stringify(published),
            startsAt,
            endsAt,
            now(),
            saved.id,
            saved.revision,
            hash,
          ),
        db()
          .prepare(
            "UPDATE restaurants SET published=?,published_at=? WHERE id=? AND published IS NULL AND EXISTS(SELECT 1 FROM promotions WHERE id=? AND revision=? AND published=?)",
          )
          .bind(
            JSON.stringify({ restaurant, sections: [] }),
            now(),
            r.id,
            saved.id,
            saved.revision,
            JSON.stringify(published),
          ),
      ]);
      const after = await one(
        "SELECT revision,published FROM promotions WHERE id=?",
        saved.id,
      );
      assert(
        after?.revision === saved.revision &&
          after?.published === JSON.stringify(published),
        409,
        "This promotion changed. Review and publish it again.",
      );
      await event(r.id, "promotion_published", saved.id, {
        revision: saved.revision,
      });
      return response({ ok: true, path: "/m/" + r.slug });
    }
    assert(false, 404, "Not found.");
  }
  const draft = offerSchema.parse(b);
  await offerContent(r, draft);
  const pid = existing?.id || id(),
    revision = (existing?.revision || 0) + 1;
  if (existing) {
    assert(
      draft.revision === existing.revision,
      409,
      "This promotion changed in another window. Reload it before saving.",
    );
    const result = await run(
      "UPDATE promotions SET draft=?,revision=?,approved_hash=CASE WHEN approved_hash=? THEN approved_hash ELSE NULL END,approved_at=CASE WHEN approved_hash=? THEN approved_at ELSE NULL END,updated_at=? WHERE id=? AND revision=?",
      JSON.stringify(draft),
      revision,
      offerHash(draft),
      offerHash(draft),
      now(),
      pid,
      existing.revision,
    );
    assert(
      result.meta.changes,
      409,
      "This promotion changed in another window. Reload it before saving.",
    );
  } else {
    await run(
      "INSERT INTO promotions (id,restaurant_id,draft,created_at,updated_at) VALUES (?,?,?,?,?)",
      pid,
      r.id,
      JSON.stringify(draft),
      now(),
      now(),
    );
    await event(r.id, "promotion_started", pid);
  }
  return response({
    promotion: offerRow(
      (await one("SELECT * FROM promotions WHERE id=?", pid))!,
    ),
  });
}
