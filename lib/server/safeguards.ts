import {
  AppError,
  assert,
  config,
  all,
  bucket,
  digest,
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
// An IPv6 subscriber is usually given a whole /64, so its addresses count as
// one caller. IPv4 addresses are used as they are.
function network(address: string) {
  const ip = address.split("%")[0].toLowerCase();
  if (!ip.includes(":")) return ip;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) return mapped[1];
  const [head, tail] = ip.split("::"),
    left = head ? head.split(":") : [],
    right = tail ? tail.split(":") : [];
  // A dotted IPv4 ending fills the last two groups.
  for (const groups of [left, right])
    if (groups.at(-1)?.includes(".")) groups.splice(-1, 1, "0", "0");
  const groups =
    tail === undefined
      ? left
      : [
          ...left,
          ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"),
          ...right,
        ];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g)))
    return ip;
  return `${groups
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(":")}::/64`;
}
export function caller(req: Request) {
  // Cloudflare overwrites this header at the hosting boundary; do not trust X-Forwarded-For.
  return network(req.headers.get("cf-connecting-ip") || "unidentified");
}
// Per-network only: a shared site-wide bucket would let one attacker lock
// every visitor out.
export async function publicLimit(
  req: Request,
  purpose: string,
  max = 20,
  seconds = 900,
) {
  await limit(`${purpose}:caller:${caller(req)}`, max, seconds);
}
// After 20 sign-in attempts for one email within 15 minutes of each other,
// each further attempt waits 1 s, 2 s, 4 s … up to 5 minutes after the last.
// It slows guessing from many networks without locking the account.
const loginWindow = 900000,
  loginFreeAttempts = 20,
  loginMaxWait = 300000;
const loginKey = (email: string) => digest(`login:email:${email}`);
export async function loginLimit(req: Request, email: string) {
  // A stranger cannot exhaust an owner's allowance merely by knowing their email.
  await limit(`login:pair:${caller(req)}:${email}`, 10);
  const t = now();
  // Claim the attempt atomically, so parallel requests cannot share a slot.
  const claimed = await one(
    `INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?)
     ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END,expires_at=excluded.expires_at
     WHERE expires_at<? OR count<? OR expires_at-?+MIN(?,1000*(1<<MIN(count-?,20)))<=?
     RETURNING count`,
    loginKey(email),
    t + loginWindow,
    t,
    t,
    loginFreeAttempts,
    loginWindow,
    loginMaxWait,
    loginFreeAttempts,
    t,
  );
  if (claimed) return;
  const row = await one(
    "SELECT count,expires_at FROM rate_limits WHERE key=?",
    loginKey(email),
  );
  const wait = row
    ? row.expires_at -
      loginWindow +
      Math.min(
        loginMaxWait,
        1000 * 2 ** Math.min(row.count - loginFreeAttempts, 20),
      ) -
      t
    : 1000;
  const seconds = Math.max(1, Math.ceil(wait / 1000)),
    [amount, unit] =
      seconds < 60 ? [seconds, "second"] : [Math.ceil(seconds / 60), "minute"];
  throw new AppError(
    429,
    `Too many sign-in attempts for this account. Try again in ${amount} ${unit}${amount === 1 ? "" : "s"}.`,
  );
}
export async function loginSucceeded(email: string) {
  await run("DELETE FROM rate_limits WHERE key=?", loginKey(email));
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
