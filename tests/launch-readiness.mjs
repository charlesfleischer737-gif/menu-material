import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "plateworthy-launch-"));
process.env.DISHLIGHT_DATA_DIR = root;
process.env.OPENAI_API_KEY = "fixture-only";
process.env.JOB_RUNNER_SECRET = "fixture-runner-secret";
const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;
const { handle } = await import("../lib/server/api.ts");
const { all, one, run, bucket, id } = await import("../lib/server/core.ts");
const { reserveAi, reserveStorage, limitedBytes } =
  await import("../lib/server/safeguards.ts");
const { tick, provider } = await import("../lib/server/generation.ts");
const { env } = await import("../lib/local-runtime.ts");
const { validateImageDimensions } =
  await import("../lib/server/image-validation.ts");
let cookie = "",
  checks = 0,
  submitted = 0,
  retrieved = 0;
const responses = new Map();
const image = readFileSync("public/pasta.jpg");
let rejectNext = false;
globalThis.fetch = async (url, init = {}) => {
  assert(String(url).startsWith("https://api.openai.com/v1/"));
  if (init.method === "POST") {
    if (rejectNext) {
      rejectNext = false;
      return Response.json({}, { status: 400 });
    }
    const body = JSON.parse(init.body);
    if (!body.tools)
      return Response.json({
        output: [
          { content: [{ type: "output_text", text: "Fixture caption" }] },
        ],
      });
    submitted++;
    assert.equal(body.tools[0].quality, "high");
    assert.equal(body.tools[0].output_compression, 95);
    const responseId = "launch-response-" + submitted;
    responses.set(responseId, false);
    return Response.json({ id: responseId, status: "queued" });
  }
  retrieved++;
  const responseId = String(url).split("/").at(-1);
  return Response.json(
    responses.get(responseId)
      ? {
          id: responseId,
          status: "completed",
          output: [
            { type: "image_generation_call", result: image.toString("base64") },
          ],
          usage: { output_tokens: 1 },
        }
      : { id: responseId, status: "in_progress" },
  );
};
async function call(path, data, expected = 200, options = {}) {
  const headers = { cookie, ...options.headers };
  if (data !== undefined && !(data instanceof FormData))
    headers["Content-Type"] = "application/json";
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method: options.method || (data === undefined ? "GET" : "POST"),
      headers,
      body:
        data === undefined
          ? undefined
          : data instanceof FormData
            ? data
            : JSON.stringify(data),
    }),
  );
  const body = await res.json();
  assert.equal(res.status, expected, `${path}: ${JSON.stringify(body)}`);
  checks++;
  if (res.headers.get("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return body;
}
async function restaurant(name) {
  const userId = id(),
    rid = id(),
    dishId = id();
  await run(
    "INSERT INTO users (id,email,password,created_at) VALUES (?,?,?,?)",
    userId,
    `${name}@example.test`,
    "not-used",
    Date.now(),
  );
  await run(
    "INSERT INTO restaurants (id,user_id,name,slug,allowance,created_at) VALUES (?,?,?,?,100,?)",
    rid,
    userId,
    name,
    name,
    Date.now(),
  );
  await run(
    "INSERT INTO dishes (id,restaurant_id,name,description,confirmed_at,created_at) VALUES (?,?,?,?,?,?)",
    dishId,
    rid,
    name,
    "Fixture dish",
    Date.now(),
    Date.now(),
  );
  return {
    rid,
    dishId,
    r: await one("SELECT * FROM restaurants WHERE id=?", rid),
  };
}
async function enqueue(fixture, suffix) {
  const { enqueue } = await import("../lib/server/generation.ts");
  return enqueue(fixture.r, {
    dishId: fixture.dishId,
    requestKey: id(),
    revision: suffix,
  });
}
try {
  for (let n = 0; n < 5; n++)
    await call(
      "access-requests",
      { email: "visitor@example.test", restaurant: "Launch kitchen" },
      202,
      { headers: { "cf-connecting-ip": "192.0.2.1" } },
    );
  assert.equal((await one("SELECT COUNT(*) AS n FROM launch_requests")).n, 1);
  checks++;
  await call(
    "access-requests",
    { email: "visitor@example.test", restaurant: "Launch kitchen" },
    429,
    { headers: { "cf-connecting-ip": "192.0.2.1" } },
  );
  await call(
    "access-requests",
    { email: "bot@example.test", restaurant: "Bot kitchen", website: "spam" },
    202,
    { headers: { "cf-connecting-ip": "192.0.2.2" } },
  );
  assert.equal((await one("SELECT COUNT(*) AS n FROM launch_requests")).n, 1);
  checks++;
  await call("auth/dev", {});
  const state = await call("state"),
    adminCookie = cookie,
    rid = state.restaurant.id;
  const admin = await call("admin");
  assert.equal(admin.requests.length, 1);
  checks++;
  await call("admin/access-request", {
    id: admin.requests[0].id,
    status: "reviewed",
  });
  const draftIds = [];
  for (let n = 0; n < 105; n++) {
    const did = id();
    draftIds.push(did);
    await run(
      "INSERT INTO creation_drafts (id,restaurant_id,kind,draft,revision,updated_at) VALUES (?,?,'menu',?,1,?)",
      did,
      rid,
      JSON.stringify({ name: `Menu ${n}`, rows: [] }),
      Date.now() + n,
    );
  }
  const seen = new Set();
  let next = 0;
  do {
    const data = await call(`creation-drafts?kind=menu&offset=${next}`);
    data.drafts.forEach((row) => seen.add(row.id));
    next = data.nextOffset;
  } while (next !== null);
  assert.equal(seen.size, 105);
  checks++;
  const original = (await call(`creation-drafts/${draftIds[0]}`)).draft;
  await call(`creation-drafts/${original.id}/metadata`, {
    name: "Autumn 100% menu",
    favorite: true,
  });
  let matches = await call("creation-drafts?kind=menu&search=100%25");
  assert.equal(matches.drafts.length, 1);
  checks++;
  assert.equal(matches.drafts[0].revision, 1);
  checks++;
  await call(`creation-drafts/${original.id}/metadata`, { archived: true });
  await call(
    "creation-drafts",
    {
      id: original.id,
      kind: "menu",
      revision: 1,
      draft: { name: "Stale edit" },
    },
    409,
  );
  assert.equal(
    (await call("creation-drafts?kind=menu&archived=true")).drafts.length,
    1,
  );
  checks++;
  await call(`creation-drafts/${original.id}/metadata`, { archived: false });
  const copy = await call(`creation-drafts/${original.id}/duplicate`, {}, 201);
  assert.notEqual(copy.id, original.id);
  checks++;
  await call("creation-drafts", {
    id: original.id,
    kind: "menu",
    revision: 1,
    draft: { name: "Window one" },
  });
  await call(
    "creation-drafts",
    {
      id: original.id,
      kind: "menu",
      revision: 1,
      draft: { name: "Window two" },
    },
    409,
  );
  // A lost response can retry its identical content without a conflict.
  await call("creation-drafts", {
    id: original.id,
    kind: "menu",
    revision: 1,
    draft: { name: "Window one" },
  });
  const a = await restaurant("queue-a"),
    b = await restaurant("queue-b"),
    c = await restaurant("queue-c");
  const a1 = await enqueue(a, "a1"),
    a2 = await enqueue(a, "a2");
  await Promise.all([tick(), tick(), tick()]);
  assert.equal(submitted, 2);
  checks++;
  const b1 = await enqueue(b, "b1"),
    c1 = await enqueue(c, "c1");
  // The oldest two remain in progress; another restaurant can start immediately.
  offset += 6000;
  await tick();
  assert.equal(submitted, 4);
  checks++;
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", c1.id)).status,
    "processing",
  );
  checks++;
  const before = retrieved;
  await tick();
  assert.equal(retrieved, before);
  checks++;
  const a3 = await enqueue(a, "a3");
  await run("UPDATE restaurants SET paused=1 WHERE id=?", a.rid);
  for (const row of await all(
    "SELECT response_id FROM outputs WHERE restaurant_id=? AND response_id IS NOT NULL",
    a.rid,
  ))
    responses.set(row.response_id, true);
  offset += 31000;
  await tick();
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", a1.id)).status,
    "completed",
  );
  checks++;
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", a2.id)).status,
    "completed",
  );
  checks++;
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", a3.id)).status,
    "queued",
  );
  checks++;
  assert.equal(submitted, 4);
  checks++;
  await call("admin/ai-controls", { paused: true, dailyBudgetCents: 10000 });
  await assert.rejects(
    () =>
      provider(
        "responses",
        "POST",
        {},
        { restaurantId: b.rid, kind: "caption" },
      ),
    (e) => e.status === 423,
  );
  checks++;
  await call("admin/ai-controls", { paused: false, dailyBudgetCents: 10000 });
  // No-session worker invocation progresses and records a heartbeat.
  cookie = "";
  await call("internal/tick", {}, 403);
  offset += 31000;
  await call("internal/tick", {}, 200, {
    headers: { authorization: "Bearer fixture-runner-secret" },
  });
  assert(
    Number(
      (await one("SELECT value FROM app_settings WHERE key='worker-heartbeat'"))
        .value,
    ) > 0,
  );
  checks++;
  cookie = adminCookie;
  const ownerDish = id();
  await run(
    "INSERT INTO dishes (id,restaurant_id,name,description,confirmed_at,created_at) VALUES (?,?,'Cancel me','Fixture',?,?)",
    ownerDish,
    rid,
    Date.now(),
    Date.now(),
  );
  const cancelJob = await call(
    "jobs",
    { dishId: ownerDish, requestKey: id() },
    202,
  );
  await call(`jobs/${cancelJob.id}/cancel`, {});
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", cancelJob.id)).status,
    "failed",
  );
  checks++;
  await call(`jobs/${a3.id}/cancel`, {}, 404);
  // Known response IDs have a deadline and restore the parent job status too.
  await run(
    "UPDATE outputs SET submitted_at=?,next_poll_at=0,lease_until=0 WHERE job_id=?",
    Date.now() - 61 * 60000,
    b1.id,
  );
  await tick();
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", b1.id)).status,
    "failed",
  );
  checks++;
  // Atomic daily reservations: two simultaneous callers cannot both take the last budget slot.
  await run("DELETE FROM ai_spend");
  await run(
    "UPDATE restaurants SET daily_budget_cents=200,paused=0 WHERE id=?",
    a.rid,
  );
  const race = await Promise.allSettled([
    reserveAi({ restaurantId: a.rid, kind: "image" }),
    reserveAi({ restaurantId: a.rid, kind: "image" }),
  ]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  checks++;
  await run("DELETE FROM ai_spend");
  await call("admin/ai-controls", { paused: false, dailyBudgetCents: 200 });
  const globalRace = await Promise.allSettled([
    reserveAi({ restaurantId: a.rid, kind: "image" }),
    reserveAi({ restaurantId: b.rid, kind: "image" }),
  ]);
  assert.equal(globalRace.filter((r) => r.status === "fulfilled").length, 1);
  checks++;
  await run("DELETE FROM ai_spend");
  rejectNext = true;
  await assert.rejects(
    () =>
      provider("responses", "POST", {}, { restaurantId: a.rid, kind: "image" }),
    (e) => e.providerRejected,
  );
  checks++;
  await reserveAi({ restaurantId: a.rid, kind: "image" });
  checks++;
  // Historical objects count against storage; concurrent uploads cannot exceed it.
  const assetId = id(),
    key = `private/${rid}/source/${assetId}`;
  await bucket().put(key, image, {
    httpMetadata: { contentType: "image/jpeg" },
  });
  await run(
    "INSERT INTO assets (id,restaurant_id,kind,key,mime,name,created_at) VALUES (?,?,'source',?,'image/jpeg','Old upload',?)",
    assetId,
    rid,
    key,
    Date.now(),
  );
  env.WORKSPACE_STORAGE_MB = String((image.length * 2 + 10) / (1024 * 1024));
  const storageRace = await Promise.allSettled([
    reserveStorage(rid, id(), 10),
    reserveStorage(rid, id(), 10),
  ]);
  assert.equal(storageRace.filter((r) => r.status === "fulfilled").length, 1);
  checks++;
  assert.equal(
    (await one("SELECT bytes FROM storage_reservations WHERE id=?", assetId))
      .bytes,
    image.length * 2,
  );
  checks++;
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(12));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () =>
      limitedBytes(
        new Request("http://localhost", {
          method: "POST",
          body: stream,
          duplex: "half",
        }),
        20,
      ),
    (e) => e.status === 413,
  );
  checks++;
  assert(cancelled);
  checks++;
  validateImageDimensions(image, "image/jpeg", true);
  checks++;
  const bomb = Buffer.alloc(24);
  bomb.write("IHDR", 12);
  bomb.writeUInt32BE(100000, 16);
  bomb.writeUInt32BE(100000, 20);
  assert.throws(
    () => validateImageDimensions(bomb, "image/png"),
    (error) => error.status === 413,
  );
  checks++;
  assert.throws(
    () =>
      validateImageDimensions(Buffer.from([255, 216, 255, 0]), "image/jpeg"),
    (error) => error.status === 400,
  );
  checks++;
  // Another caller is not locked out by attempts against the same email.
  for (let n = 0; n < 10; n++)
    await call(
      "auth/login",
      { email: "target@example.test", password: "not-the-password" },
      401,
      { headers: { "cf-connecting-ip": "192.0.2.10" } },
    );
  await call(
    "auth/login",
    { email: "target@example.test", password: "not-the-password" },
    429,
    { headers: { "cf-connecting-ip": "192.0.2.10" } },
  );
  await call(
    "auth/login",
    { email: "target@example.test", password: "not-the-password" },
    401,
    { headers: { "cf-connecting-ip": "192.0.2.11" } },
  );
  // Tenant isolation for management operations, not just draft listing.
  const invite = await call("admin/invite", {
    email: "outsider@example.test",
    allowance: 1,
  });
  cookie = "";
  await call("auth/signup", {
    email: "outsider@example.test",
    password: "fixture password only 123",
    restaurant: "Outsider",
    invite: invite.invite,
  });
  await call(`creation-drafts/${original.id}`, undefined, 404);
  await call(
    `creation-drafts/${original.id}/metadata`,
    { name: "Intrusion" },
    404,
  );
  await call(`creation-drafts/${original.id}/duplicate`, {}, 404);
  await call("admin/ai-controls", { paused: true, dailyBudgetCents: 0 }, 403);
  console.log(
    `PASS: ${checks} launch checks: access requests, pagination, archived drafts, conflict/idempotency, queue fairness/backoff, pause, no-session runner, cancellation, deadlines, atomic budgets/storage, bounded bodies, login abuse and tenant isolation. Provider calls are fixtures.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
