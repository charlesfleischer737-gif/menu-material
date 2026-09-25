import {
  AppError,
  assert,
  config,
  all,
  bucket,
  id,
  limit,
  now,
  one,
  run,
} from "./core";

export type AiCharge = {
  restaurantId: string;
  kind: "image" | "caption" | "analysis" | "import";
  key?: string;
};
const budgetDay = () => new Date(now()).toISOString().slice(0, 10);
export async function aiControls() {
  const row = await one(
    "SELECT value FROM app_settings WHERE key='ai-controls'",
  );
  return {
    paused: false,
    dailyBudgetCents: 10000,
    ...(row ? JSON.parse(row.value) : {}),
  };
}
export async function reserveAi(charge: AiCharge) {
  const controls = await aiControls();
  assert(
    !controls.paused,
    423,
    "AI creation is temporarily paused. Your saved work is safe.",
  );
  const rid = charge.restaurantId;
  const r = await one(
    "SELECT paused,daily_budget_cents FROM restaurants WHERE id=?",
    rid,
  );
  assert(
    r && !r.paused,
    423,
    "AI creation is paused for this restaurant. Your queued work is saved.",
  );
  const cents = Math.max(
    1,
    Math.round(
      Number(
        config(
          `AI_${charge.kind.toUpperCase()}_RESERVE_USD`,
          charge.kind === "image"
            ? "2"
            : charge.kind === "import"
              ? "0.50"
              : "0.10",
        ),
      ) * 100,
    ),
  );
  assert(
    Number.isSafeInteger(cents),
    503,
    "AI budget settings need attention.",
  );
  const key = charge.key || id();
  const inserted = await run(
    `INSERT OR IGNORE INTO ai_spend (id,restaurant_id,kind,budget_day,reserved_cents,created_at)
     SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM restaurants WHERE id=? AND paused=0)
     AND COALESCE((SELECT json_extract(value,'$.paused') FROM app_settings WHERE key='ai-controls'),0)=0
     AND COALESCE((SELECT SUM(reserved_cents) FROM ai_spend WHERE budget_day=? AND status!='rejected'),0)+?<=COALESCE((SELECT json_extract(value,'$.dailyBudgetCents') FROM app_settings WHERE key='ai-controls'),10000)
     AND COALESCE((SELECT SUM(reserved_cents) FROM ai_spend WHERE budget_day=? AND restaurant_id=? AND status!='rejected'),0)+?<=(SELECT daily_budget_cents FROM restaurants WHERE id=?)`,
    key,
    rid,
    charge.kind,
    budgetDay(),
    cents,
    now(),
    rid,
    budgetDay(),
    cents,
    budgetDay(),
    rid,
    cents,
    rid,
  );
  assert(
    inserted.meta.changes,
    429,
    "Today's AI budget has been reached. Try again tomorrow or contact support. Your work is saved.",
  );
  return key;
}
export async function finishAi(
  key: string,
  status: string,
  usage: unknown = null,
) {
  await run(
    "UPDATE ai_spend SET status=?,usage=? WHERE id=?",
    status,
    usage ? JSON.stringify(usage) : null,
    key,
  );
}
export function caller(req: Request) {
  // Cloudflare overwrites this header at the hosting boundary; do not trust X-Forwarded-For.
  return req.headers.get("cf-connecting-ip") || "unidentified";
}
export async function publicLimit(
  req: Request,
  purpose: string,
  max = 20,
  seconds = 900,
) {
  await limit(`${purpose}:caller:${caller(req)}`, max, seconds);
  await limit(`${purpose}:global`, Math.max(500, max * 50), seconds);
}
export async function loginLimit(req: Request, email: string) {
  await publicLimit(req, "login", 30);
  // A stranger cannot exhaust an owner's allowance merely by knowing their email.
  await limit(`login:pair:${caller(req)}:${email}`, 10);
}
async function accountForExistingStorage(restaurantId: string) {
  const existing = await all(
    `SELECT id,key,working_key,2 AS copies FROM assets WHERE restaurant_id=? AND deleted_at IS NULL AND id NOT IN (SELECT id FROM storage_reservations)
    UNION ALL SELECT id,key,NULL AS working_key,1 AS copies FROM menu_imports WHERE restaurant_id=? AND key IS NOT NULL AND id NOT IN (SELECT id FROM storage_reservations)`,
    restaurantId,
    restaurantId,
  );
  // Backfill metadata only. Do not download or rewrite historical original files.
  for (const row of existing) {
    let bytes = 0;
    for (const objectKey of [row.key, row.working_key].filter(Boolean)) {
      const object = await bucket().head(objectKey);
      bytes += object?.size || 0;
    }
    await run(
      "INSERT OR IGNORE INTO storage_reservations (id,restaurant_id,bytes,created_at) VALUES (?,?,?,?)",
      row.id,
      restaurantId,
      bytes * row.copies,
      now(),
    );
  }
}
export async function reserveStorage(
  restaurantId: string,
  key: string,
  bytes: number,
) {
  await accountForExistingStorage(restaurantId);
  const quota = Number(config("WORKSPACE_STORAGE_MB", "2048")) * 1024 * 1024;
  assert(
    bytes > 0 && Number.isSafeInteger(bytes) && Number.isFinite(quota),
    400,
    "Invalid file size.",
  );
  const result = await run(
    "INSERT OR IGNORE INTO storage_reservations (id,restaurant_id,bytes,created_at) SELECT ?,?,?,? WHERE COALESCE((SELECT SUM(bytes) FROM storage_reservations WHERE restaurant_id=?),0)+?<=?",
    key,
    restaurantId,
    bytes,
    now(),
    restaurantId,
    bytes,
    quota,
  );
  assert(
    result.meta.changes,
    413,
    "Your workspace storage is full. Remove unneeded photos or contact support.",
  );
}
export async function releaseStorage(key: string) {
  await run("DELETE FROM storage_reservations WHERE id=?", key);
}
export async function limitedBytes(req: Request, max: number) {
  assert(
    Number(req.headers.get("content-length") || 0) <= max,
    413,
    "This upload is too large.",
  );
  const reader = req.body?.getReader();
  assert(reader, 400, "No request content was received.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new AppError(413, "This upload is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
export async function limitedForm(req: Request, max: number) {
  const bytes = await limitedBytes(req, max);
  try {
    return await new Response(bytes, {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
  } catch {
    throw new AppError(
      400,
      "The upload could not be read. Please choose the file again.",
    );
  }
}
export async function housekeeping() {
  await run(
    "INSERT INTO app_settings (key,value) VALUES ('worker-heartbeat',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(app_settings.value AS INTEGER)<?",
    String(now()),
    now() - 30000,
  );
  const claim = await run(
    "INSERT INTO app_settings (key,value) VALUES ('cleanup-last-run',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(app_settings.value AS INTEGER)<?",
    String(now()),
    now() - 3600000,
  );
  if (!claim.meta.changes) return;
  await run("DELETE FROM rate_limits WHERE expires_at<?", now());
  await run("DELETE FROM sessions WHERE expires_at<?", now());
  await run(
    "DELETE FROM invites WHERE expires_at<? AND role='reset'",
    now() - 86400000,
  );
  // Guest activity on menus is reported for recent weeks; keep 90 days.
  await run(
    "DELETE FROM events WHERE kind IN ('menu_visit','dish_view','ordering_click','call_click','directions_click','reserve_click') AND created_at<?",
    now() - 90 * 86400000,
  );
  const abandoned = await all(
    "SELECT * FROM storage_reservations WHERE created_at<? AND id NOT IN (SELECT id FROM assets WHERE deleted_at IS NULL) AND id NOT IN (SELECT id FROM menu_imports) AND id NOT IN (SELECT id FROM outputs WHERE status NOT IN ('completed','failed')) LIMIT 50",
    now() - 3600000,
  );
  for (const row of abandoned) {
    await bucket().delete([
      `private/${row.restaurant_id}/source/${row.id}`,
      `private/${row.restaurant_id}/working/${row.id}.jpg`,
      `private/${row.restaurant_id}/generated/${row.id}.jpg`,
      `private/${row.restaurant_id}/generated/${row.id}.png`,
      `private/${row.restaurant_id}/edits/${row.id}.jpg`,
      `private/${row.restaurant_id}/imports/${row.id}`,
      `public/${row.restaurant_id}/${row.id}`,
    ]);
    await releaseStorage(row.id);
  }
}
