import { env } from "cloudflare:workers";
import { canonicalStudioEvents } from "../studio-events";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows and drafts are loosely shaped JSON from SQL and the API
export type Row = Record<string, any>;
export function config(key: string, fallback = "") {
  return String(
    (env as Record<string, unknown>)[key] ?? process.env[key] ?? fallback,
  );
}
export function db() {
  if (!env.DB)
    throw new AppError(
      503,
      "The workspace database is unavailable. Please try again.",
    );
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET)
    throw new AppError(503, "File storage is unavailable. Please try again.");
  return env.BUCKET;
}
export const now = () => Date.now();
export const id = () => crypto.randomUUID();
export const token = () => randomBytes(32).toString("base64url");
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function hashPassword(p: string) {
  const salt = token();
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
}
export function checkPassword(p: string, hash: string) {
  const [salt, h] = hash.split(":");
  const expected = Buffer.from(h || "00".repeat(64), "hex");
  const actual = scryptSync(p, salt || "dummy", 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export class AppError extends Error {
  // Set when the image provider itself rejected the request (a 4xx).
  declare providerRejected?: boolean;
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assert(
  ok: unknown,
  status: number,
  message: string,
): asserts ok {
  if (!ok) throw new AppError(status, message);
}
export async function one(
  sql: string,
  ...args: unknown[]
): Promise<Row | null> {
  return db()
    .prepare(sql)
    .bind(...args)
    .first<Row>();
}
export async function all(sql: string, ...args: unknown[]): Promise<Row[]> {
  return (
    await db()
      .prepare(sql)
      .bind(...args)
      .all<Row>()
  ).results;
}
export async function run(sql: string, ...args: unknown[]) {
  return db()
    .prepare(sql)
    .bind(...args)
    .run();
}
export async function event(
  restaurant: string | null,
  kind: string,
  entity: string | null = null,
  details: object = {},
  dedupeKey?: string,
) {
  await run(
    "INSERT INTO events (id,restaurant_id,kind,entity_id,details,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
    dedupeKey ? digest(`${restaurant}:${kind}:${entity}:${dedupeKey}`) : id(),
    restaurant,
    kind,
    entity,
    JSON.stringify({
      ...details,
      ...(canonicalStudioEvents[kind]
        ? { canonicalEvent: canonicalStudioEvents[kind] }
        : {}),
      measurementMode:
        config("LOCAL_DEVELOPMENT") === "true" ||
        config("STUDIO_INTERNAL_QA") === "true"
          ? "internal"
          : "production",
      eventSchema: 2,
    }),
    now(),
  );
}
export function response(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
export async function body(req: Request) {
  assert(
    Number(req.headers.get("content-length") || 0) < 100000,
    413,
    "This request is too large.",
  );
  let v;
  try {
    const { limitedBytes } = await import("./safeguards");
    const text = new TextDecoder().decode(await limitedBytes(req, 99999));
    assert(text.length < 100000, 413, "This request is too large.");
    v = JSON.parse(text);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, "Please check the form and try again.");
  }
  return v;
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  assert(
    !origin || origin === new URL(req.url).origin,
    403,
    "Please submit from this site.",
  );
  assert(
    req.headers.get("sec-fetch-site") !== "cross-site",
    403,
    "Please submit from this site.",
  );
}
export async function limit(key: string, max = 20, seconds = 900) {
  const k = digest(key),
    t = now();
  const r = await one(
    "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END RETURNING count",
    k,
    t + seconds * 1000,
    t,
    t,
  );
  assert(
    r && r.count <= max,
    429,
    "Too many attempts. Please try again in a few minutes.",
  );
}
export async function viewer(req: Request) {
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("menu_material_session="))
    ?.split("=")[1];
  if (!raw) return null;
  return one(
    "SELECT u.id,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires_at>?",
    digest(raw),
    now(),
  );
}
export async function createSession(req: Request, userId: string) {
  const s = token();
  await run(
    "INSERT INTO sessions (hash,user_id,expires_at) VALUES (?,?,?)",
    digest(s),
    userId,
    now() + 7 * 86400000,
  );
  return response({ ok: true }, 200, {
    "Set-Cookie": `menu_material_session=${s}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`,
  });
}
export async function owner(req: Request) {
  const u = await viewer(req);
  assert(u, 401, "Sign in to your restaurant workspace.");
  const r = await one("SELECT * FROM restaurants WHERE user_id=?", u.id);
  assert(r, 403, "Your restaurant is not set up yet.");
  return { u, r };
}
export async function admin(req: Request) {
  const u = await viewer(req);
  assert(u?.role === "admin", 403, "Administrator access is required.");
  return u!;
}
export async function remaining(restaurantId: string) {
  const { imageEntitlement } = await import("./entitlements");
  return (await imageEntitlement(restaurantId)).remaining;
}
