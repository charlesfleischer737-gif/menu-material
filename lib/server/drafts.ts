import { z } from "zod";
import {
  all,
  assert,
  body,
  id,
  now,
  one,
  response,
  run,
  type Row,
} from "./core";

const kinds = ["studio", "menu", "post"];
const decode = (row: Row) => ({ ...row, draft: JSON.parse(row.draft) });
export async function manageDrafts(
  req: Request,
  p: string[],
  restaurantId: string,
) {
  if (p[0] !== "creation-drafts") return null;
  const query = new URL(req.url).searchParams;
  if (p[1]) {
    z.string().uuid().parse(p[1]);
    const row = await one(
      "SELECT * FROM creation_drafts WHERE id=? AND restaurant_id=? AND kind IN ('studio','menu','post')",
      p[1],
      restaurantId,
    );
    assert(row, 404, "That saved work is no longer available.");
    if (req.method === "GET") return response({ draft: decode(row) });
    assert(req.method === "POST", 405, "Method not allowed.");
    if (p[2] === "duplicate") {
      const copyId = id();
      const title =
        row.name ||
        JSON.parse(row.draft).name ||
        JSON.parse(row.draft).title ||
        `Untitled ${row.kind === "studio" ? "photo" : row.kind}`;
      await run(
        "INSERT INTO creation_drafts (id,restaurant_id,kind,draft,name,updated_at) VALUES (?,?,?,?,?,?)",
        copyId,
        restaurantId,
        row.kind,
        row.draft,
        `${title} (copy)`.slice(0, 100),
        now(),
      );
      return response({ id: copyId }, 201);
    }
    assert(p[2] === "metadata", 404, "Not found.");
    const b = z
      .object({
        name: z.string().trim().min(1).max(100).optional(),
        favorite: z.boolean().optional(),
        archived: z.boolean().optional(),
      })
      .parse(await body(req));
    await run(
      "UPDATE creation_drafts SET name=CASE WHEN ? THEN ? ELSE name END,favorite=CASE WHEN ? THEN ? ELSE favorite END,archived_at=CASE WHEN ? THEN ? ELSE archived_at END WHERE id=? AND restaurant_id=?",
      Number(b.name !== undefined),
      b.name ?? "",
      Number(b.favorite !== undefined),
      Number(b.favorite || false),
      Number(b.archived !== undefined),
      b.archived ? now() : null,
      row.id,
      restaurantId,
    );
    return response({ ok: true });
  }
  if (req.method !== "GET") return null;
  const kind = query.get("kind");
  assert(
    !kind || kinds.includes(kind),
    400,
    "Choose a valid type of saved work.",
  );
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .parse(query.get("offset") || 0);
  const pageSize = 30;
  const search = (query.get("search") || "")
    .trim()
    .slice(0, 100)
    .replace(/[\\%_]/g, "\\$&");
  const clauses = [
    "restaurant_id=?",
    "kind IN ('studio','menu','post')",
    query.get("archived") === "true"
      ? "archived_at IS NOT NULL"
      : "archived_at IS NULL",
  ];
  const args: (string | number)[] = [restaurantId];
  if (kind) {
    clauses.push("kind=?");
    args.push(kind);
  }
  if (query.get("favorites") === "true") clauses.push("favorite=1");
  if (search) {
    clauses.push(
      "(name LIKE ? ESCAPE '\\' OR COALESCE(json_extract(draft,'$.name'),'') LIKE ? ESCAPE '\\' OR COALESCE(json_extract(draft,'$.title'),'') LIKE ? ESCAPE '\\')",
    );
    args.push(...Array(3).fill(`%${search}%`));
  }
  const rows = await all(
    `SELECT * FROM creation_drafts WHERE ${clauses.join(" AND ")} ORDER BY favorite DESC,updated_at DESC,id DESC LIMIT ? OFFSET ?`,
    ...args,
    pageSize + 1,
    offset,
  );
  return response({
    drafts: rows.slice(0, pageSize).map(decode),
    nextOffset: rows.length > pageSize ? offset + pageSize : null,
  });
}
