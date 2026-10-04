import { z } from "zod";
import {
  all,
  assert,
  body,
  event,
  limit,
  one,
  response,
  run,
  type Row,
} from "./core";
import { menuDocumentSchema } from "../menu-document";
import { normalizeDietary } from "../dietary";
import { menuDocumentsRoute } from "./menu-documents";

export const nativeProfileSchema = z.object({
  version: z.literal(1).default(1),
  completed: z.boolean().default(false),
  firstName: z.string().trim().max(80).default(""),
  role: z
    .enum(["Owner", "Manager", "Chef", "Marketing", "Team member"])
    .default("Owner"),
  goals: z
    .array(
      z.enum([
        "Better food photos",
        "Social posts",
        "Digital menus",
        "Delivery listings",
      ]),
    )
    .max(4)
    .default([]),
  firstAction: z.enum(["photo", "explore", "menu"]).default("photo"),
  favoriteLooks: z.array(z.string().max(100)).max(200).default([]),
  recentLooks: z.array(z.string().max(100)).max(8).default([]),
  defaultLook: z.string().max(100).default("keep"),
});
export function nativeProfile(raw: unknown) {
  try {
    return nativeProfileSchema.parse(
      typeof raw === "string" ? JSON.parse(raw) : (raw ?? {}),
    );
  } catch {
    return nativeProfileSchema.parse({});
  }
}

/** Narrow mobile edits go through the same menu validation and revision checks
 * as the web. Existing design, sections, variants and unlinked entries survive. */
export async function nativeWorkspaceRoute(req: Request, p: string[], r: Row) {
  if (p[0] !== "native" || req.method !== "POST") return null;
  if (p[1] === "metrics") {
    await limit("native-metrics:" + r.id, 120, 3600);
    const b = z
      .object({
        name: z.enum(["startup", "upload", "result", "export", "recovery"]),
        durationMs: z.number().int().min(0).max(3600000),
        outcome: z.enum(["success", "failure"]),
        version: z.string().max(20),
      })
      .parse(await body(req));
    await event(r.id, `native_${b.name}`, null, b);
    return response({ ok: true });
  }
  if (p[1] === "profile") {
    const b = z
      .object({
        profile: nativeProfileSchema,
        restaurantName: z.string().trim().min(2).max(100).optional(),
        cuisine: z.string().trim().max(100).optional(),
      })
      .parse(await body(req));
    await run(
      "UPDATE restaurants SET native_profile=?,name=?,cuisine=? WHERE id=?",
      JSON.stringify(b.profile),
      b.restaurantName ?? r.name,
      b.cuisine ?? r.cuisine,
      r.id,
    );
    if (b.profile.completed && !nativeProfile(r.native_profile).completed) {
      await event(r.id, "native_onboarding_completed", null, {
        goals: b.profile.goals,
        firstAction: b.profile.firstAction,
      });
    }
    return response({ ok: true });
  }
  if (p[1] !== "menus") return null;
  const b = z
    .object({
      id: z.string().uuid(),
      revision: z.number().int().min(1).optional(),
      name: z.string().trim().min(1).max(120),
      dishIds: z.array(z.string().uuid()).max(150),
      refreshPhotoDishIds: z.array(z.string().uuid()).max(150).default([]),
    })
    .parse(await body(req));
  const existing = await one(
    "SELECT * FROM menu_documents WHERE id=? AND restaurant_id=? AND archived_at IS NULL",
    b.id,
    r.id,
  );
  assert(!b.revision || existing, 404, "This menu is no longer available.");
  if (existing && !b.revision)
    return menuDocumentsRoute(
      new Request(req.url, { method: "GET", headers: req.headers }),
      ["menus", b.id],
      r,
    );
  const draft = existing
    ? menuDocumentSchema.parse(JSON.parse(existing.draft))
    : menuDocumentSchema.parse({ name: b.name, title: b.name, sections: [] });
  draft.name = b.name;
  const dishes = await all(
    "SELECT * FROM dishes WHERE restaurant_id=? AND archived_at IS NULL AND sample=0",
    r.id,
  );
  const selected = new Set(b.dishIds);
  assert(
    b.dishIds.every((id) => dishes.some((d) => d.id === id)),
    400,
    "Choose active dishes from your restaurant.",
  );
  // Only explicit photo refreshes modify existing entries. Removing a selection
  // removes its linked entries; unlinked imported menu entries stay untouched.
  for (const section of draft.sections) {
    section.items = section.items.filter(
      (item) => !item.dishId || selected.has(item.dishId),
    );
    for (const item of section.items) {
      if (item.dishId && b.refreshPhotoDishIds.includes(item.dishId)) {
        const dish = dishes.find((d) => d.id === item.dishId);
        item.photoId = dish?.preferred_photo_id || null;
      }
    }
  }
  const present = new Set(
    draft.sections.flatMap((s) => s.items.map((i) => i.dishId)),
  );
  for (const dishId of b.dishIds) {
    if (present.has(dishId)) continue;
    const dish = dishes.find((d) => d.id === dishId)!;
    const name = dish.category || "Dishes";
    let section = draft.sections.find((s) => s.name === name);
    if (!section) {
      section = {
        id: `native-${dishId}`,
        name,
        description: "",
        pageBreakBefore: false,
        items: [],
      };
      draft.sections.push(section);
    }
    section.items.push(
      menuDocumentSchema.parse({
        sections: [
          {
            id: "section",
            name,
            items: [
              {
                id: `dish-${dishId}`,
                dishId,
                name: dish.name,
                description: dish.description,
                price: dish.price || null,
                available: !!dish.available,
                photoId: dish.preferred_photo_id || null,
                dietary: normalizeDietary(dish.dietary),
                sourceReviewed: true,
              },
            ],
          },
        ],
      }).sections[0].items[0],
    );
  }
  const payload = existing
    ? { revision: b.revision, draft }
    : { id: b.id, draft };
  const forwarded = new Request(req.url, {
    method: existing ? "PUT" : "POST",
    headers: req.headers,
    body: JSON.stringify(payload),
  });
  return menuDocumentsRoute(
    forwarded,
    existing ? ["menus", b.id] : ["menus"],
    r,
  );
}
