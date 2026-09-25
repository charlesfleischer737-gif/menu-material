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
  type Row,
} from "./core";
import { imageEntitlement } from "./entitlements";

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
// A numeric setting, or its fallback when unset, blank or invalid.
function setting(key: string, fallback: number) {
  const raw = config(key).trim();
  const value = raw ? Number(raw) : fallback;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
// The schema default for restaurants.daily_budget_cents ($20).
const DEFAULT_RESTAURANT_BUDGET_CENTS = 2000;
// What a new reservation must satisfy, checked atomically when it is inserted
// and ahead of time before an image is claimed. Daily budgets count finished
// calls at their settled cost. Free plans also have a daily cap on calls other
// than images. On an active paid plan the default restaurant budget never
// holds images below what the plan's allowance could use in a day; an
// administrator's own restaurant budget and the site-wide budget still apply.
async function reservationTerms(charge: AiCharge, restaurant: Row) {
  const rid = charge.restaurantId;
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
  const plan = await imageEntitlement(rid);
  const paid = plan.plan !== "free";
  const floor =
    paid &&
    charge.kind === "image" &&
    Number(restaurant.daily_budget_cents) === DEFAULT_RESTAURANT_BUDGET_CENTS
      ? plan.allowance * cents
      : 0;
  const cap =
    !paid && charge.kind !== "image"
      ? Math.floor(setting("AI_FREE_DAILY_TEXT_CALLS", 40))
      : null;
  const day = budgetDay();
  return {
    cents,
    cap,
    day,
    sql: `EXISTS(SELECT 1 FROM restaurants WHERE id=? AND paused=0)
     AND COALESCE((SELECT json_extract(value,'$.paused') FROM app_settings WHERE key='ai-controls'),0)=0
     AND COALESCE((SELECT SUM(reserved_cents) FROM ai_spend WHERE budget_day=? AND status!='rejected'),0)+?<=COALESCE((SELECT json_extract(value,'$.dailyBudgetCents') FROM app_settings WHERE key='ai-controls'),10000)
     AND COALESCE((SELECT SUM(reserved_cents) FROM ai_spend WHERE budget_day=? AND restaurant_id=? AND status!='rejected'),0)+?<=MAX((SELECT daily_budget_cents FROM restaurants WHERE id=?),?)
     AND (? IS NULL OR (SELECT COUNT(*) FROM ai_spend WHERE budget_day=? AND restaurant_id=? AND kind!='image' AND status!='rejected')<?)`,
    args: [rid, day, cents, day, rid, cents, rid, floor, cap, day, rid, cap],
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
  const terms = await reservationTerms(charge, r);
  assert(
    Number.isSafeInteger(terms.cents),
    503,
    "AI budget settings need attention.",
  );
  const key = charge.key || id();
  const inserted = await run(
    `INSERT OR IGNORE INTO ai_spend (id,restaurant_id,kind,budget_day,reserved_cents,created_at)
     SELECT ?,?,?,?,?,? WHERE ${terms.sql}`,
    key,
    rid,
    charge.kind,
    terms.day,
    terms.cents,
    now(),
    ...terms.args,
  );
  if (!inserted.meta.changes && terms.cap !== null) {
    const used = await one(
      "SELECT COUNT(*) AS n FROM ai_spend WHERE budget_day=? AND restaurant_id=? AND kind!='image' AND status!='rejected'",
      terms.day,
      rid,
    );
    assert(
      Number(used?.n) < terms.cap,
      429,
      `The free plan's ${terms.cap} AI requests for today (captions, photo checks and menu reading) are used up. They reset at 00:00 UTC. Your work is saved, and you can still write and edit yourself.`,
    );
  }
  assert(
    inserted.meta.changes,
    429,
    "Today's AI budget has been reached. It resets at 00:00 UTC; try again then or contact support. Your work is saved.",
  );
  return key;
}
// Whether a call of this kind could reserve now. Checked before an image is
// claimed, so a spent budget holds queued images instead of cycling them.
export async function aiBudgetRoom(
  restaurantId: string,
  kind: AiCharge["kind"],
) {
  const r = await one(
    "SELECT paused,daily_budget_cents FROM restaurants WHERE id=?",
    restaurantId,
  );
  if (!r) return false;
  const terms = await reservationTerms({ restaurantId, kind }, r);
  if (!Number.isSafeInteger(terms.cents)) return false;
  return !!(await one(`SELECT 1 AS ok WHERE ${terms.sql}`, ...terms.args));
}
// What a finished call counts against the daily budgets, in cents to a
// hundredth of a cent, rounded up: text calls at their measured token cost,
// images at IMAGE_COST_ESTIMATE_USD when that is set. null keeps the
// reservation, for example when usage was not reported.
export function settledCents(kind: string, usage: unknown) {
  let usd: number;
  if (kind === "image") {
    const estimate = config("IMAGE_COST_ESTIMATE_USD").trim();
    usd = estimate ? Number(estimate) : NaN;
  } else {
    const tokens = (usage || {}) as Row;
    const input = Number(tokens.input_tokens ?? tokens.prompt_tokens);
    const output = Number(tokens.output_tokens ?? tokens.completion_tokens);
    usd =
      input >= 0 && output >= 0
        ? (input * setting("AI_TEXT_INPUT_USD_PER_MILLION_TOKENS", 0.4) +
            output * setting("AI_TEXT_OUTPUT_USD_PER_MILLION_TOKENS", 1.6)) /
          1e6
        : NaN;
  }
  if (!Number.isFinite(usd) || usd < 0) return null;
  // Whole micro-dollars first, so float noise never rounds up a cent fraction.
  return Math.ceil(Math.round(usd * 1e6) / 100) / 100;
}
export async function finishAi(
  key: string,
  status: string,
  usage: unknown = null,
) {
  // A finished call is settled at its measured cost, never above its
  // reservation. Rejected calls stop counting; uncertain ones keep it all.
  const settled = status === "submitted";
  await run(
    "UPDATE ai_spend SET status=?,usage=?,reserved_cents=MIN(reserved_cents,COALESCE(CASE kind WHEN 'image' THEN ? ELSE ? END,reserved_cents)) WHERE id=?",
    status,
    usage ? JSON.stringify(usage) : null,
    settled ? settledCents("image", usage) : null,
    settled ? settledCents("text", usage) : null,
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
