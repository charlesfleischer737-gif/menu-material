import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-material-launch-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.OPENAI_API_KEY = "fixture-only";
process.env.JOB_RUNNER_SECRET = "fixture-runner-secret";
const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;
const { handle } = await import("../lib/server/api.ts");
const { one, run, bucket, id, digest } = await import("../lib/server/core.ts");
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
const image = readFileSync("public/pasta.jpg");
let rejectNext = false,
  holdImages = false;
const held = [];
globalThis.fetch = async (url, init = {}) => {
  assert(String(url).startsWith("https://api.openai.com/v1/"));
  if (init.method === "POST" && rejectNext) {
    rejectNext = false;
    return Response.json({}, { status: 400 });
  }
  if (String(url).startsWith("https://api.openai.com/v1/images/")) {
    submitted++;
    // Description-only dishes are generated from the prompt alone.
    assert.equal(String(url), "https://api.openai.com/v1/images/generations");
    const body = JSON.parse(init.body);
    assert.equal(body.quality, "high");
    assert.equal(body.output_compression, 95);
    const reply = () =>
      Response.json({
        data: [{ b64_json: image.toString("base64") }],
        usage: { output_tokens: 1 },
      });
    // A held call stays open, like a render in progress, until released.
    return holdImages
      ? new Promise((resolve) => held.push(() => resolve(reply())))
      : reply();
  }
  if (init.method === "POST")
    return Response.json({
      output: [{ content: [{ type: "output_text", text: "Fixture caption" }] }],
    });
  // Earlier background responses are still retrieved by ID.
  retrieved++;
  return Response.json({
    id: String(url).split("/").at(-1),
    status: "in_progress",
  });
};
// Let held calls reach the fixture without real sleeps.
async function until(ready) {
  for (let n = 0; n < 1000 && !ready(); n++)
    await new Promise((resolve) => setImmediate(resolve));
  assert(ready(), "The fixture was not reached");
}
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
  // Image calls last their whole render, so these ticks stay open until released.
  holdImages = true;
  const a1 = await enqueue(a, "a1"),
    a2 = await enqueue(a, "a2");
  const rendering = [Promise.all([tick(), tick(), tick()])];
  await until(() => submitted === 2);
  checks++;
  const b1 = await enqueue(b, "b1"),
    c1 = await enqueue(c, "c1");
  // The oldest two remain in progress; another restaurant can start immediately.
  rendering.push(tick());
  await until(() => submitted === 4);
  checks++;
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", c1.id)).status,
    "processing",
    "A job shows as in progress while its image renders",
  );
  checks++;
  const a3 = await enqueue(a, "a3");
  await tick();
  assert.equal(submitted, 4, "A restaurant runs at most two images at once");
  checks++;
  await run("UPDATE restaurants SET paused=1 WHERE id=?", a.rid);
  holdImages = false;
  for (const release of held.splice(0)) release();
  await Promise.all(rendering);
  await tick();
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", a1.id)).status,
    "completed",
    "An image already rendering is saved even after a pause",
  );
  checks++;
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", a2.id)).status,
    "completed",
  );
  checks++;
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", b1.id)).status,
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
  // With a healthy worker the page never starts an image itself, so leaving
  // the page cannot cut a render off.
  const ownerSession = id();
  await run(
    "INSERT INTO sessions (hash,user_id,expires_at) VALUES (?,?,?)",
    digest(ownerSession),
    c.r.user_id,
    Date.now() + 3600000,
  );
  cookie = "menu_material_session=" + ownerSession;
  const workerJob = await call(
    "jobs",
    { dishId: c.dishId, requestKey: id(), revision: "Worker render" },
    202,
  );
  const beforeWorker = submitted;
  await call("jobs/tick", {});
  assert.equal(submitted, beforeWorker, "The page leaves new images alone");
  checks++;
  // The page's status check lists only its own restaurant's unfinished work;
  // restaurant a's queued image stays private.
  const progress = await call("jobs/status");
  assert.deepEqual(progress.jobs, [{ id: workerJob.id, status: "queued" }]);
  checks++;
  assert.deepEqual(
    progress.outputs.map((o) => [o.job_id, o.status]),
    [[workerJob.id, "queued"]],
  );
  checks++;
  // During the worker's render the page learns when it was sent, a typical
  // time for its settings and the server's clock, for the progress bar.
  holdImages = true;
  const workerRender = call("internal/tick", {}, 200, {
    headers: { authorization: "Bearer fixture-runner-secret" },
  });
  await until(() => held.length === 1);
  const during = await call("state");
  const sentOutput = during.outputs.find((o) => o.job_id === workerJob.id);
  const runningJob = during.jobs.find((j) => j.id === workerJob.id);
  assert.equal(runningJob.status, "processing");
  assert(sentOutput.submitted_at <= Date.now());
  assert(Math.abs(during.serverTime - Date.now()) < 1000);
  assert(runningJob.estimate_ms >= 10000 && runningJob.estimate_ms <= 150000);
  checks++;
  offset += 30000;
  held.shift()();
  await workerRender;
  holdImages = false;
  assert.equal(submitted, beforeWorker + 1, "The worker starts them");
  checks++;
  // Its time from sending to saving is kept for later estimates.
  const timing = JSON.parse(
    (
      await one(
        "SELECT details FROM events WHERE kind='image_completed' AND entity_id=?",
        sentOutput.id,
      )
    ).details,
  );
  assert(timing.renderMs >= 30000 && timing.renderMs < 35000);
  assert.deepEqual(
    [timing.model, timing.quality, timing.size],
    ["gpt-image-2.5-flare", "high", "1536x1536"],
  );
  checks++;
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", workerJob.id)).status,
    "completed",
  );
  checks++;
  assert.deepEqual(
    await call("jobs/status"),
    { jobs: [], outputs: [], batchItems: [] },
    "Finished work drops out of the status check",
  );
  checks++;
  cookie = "";
  await call("jobs/status", undefined, 401);
  cookie = adminCookie;
  // Earlier background responses are still polled by ID: every two seconds
  // at first, less often after two minutes. Their deadline restores the
  // parent job status too.
  const earlier = await enqueue(b, "earlier");
  await run(
    "UPDATE outputs SET status='processing',response_id='launch-earlier',submitted_at=?,next_poll_at=0,lease_until=0 WHERE job_id=?",
    Date.now(),
    earlier.id,
  );
  const before = retrieved;
  await tick();
  await tick();
  assert.equal(retrieved, before + 1, "One check at a time");
  checks++;
  offset += 2000;
  await tick();
  assert.equal(retrieved, before + 2, "Checked again after two seconds");
  checks++;
  await run(
    "UPDATE outputs SET submitted_at=?,next_poll_at=0 WHERE job_id=?",
    Date.now() - 5 * 60000,
    earlier.id,
  );
  await tick();
  offset += 2000;
  await tick();
  assert.equal(retrieved, before + 3, "A slow response is checked less often");
  checks++;
  await run(
    "UPDATE outputs SET submitted_at=?,next_poll_at=0,lease_until=0 WHERE job_id=?",
    Date.now() - 61 * 60000,
    earlier.id,
  );
  await tick();
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", earlier.id)).status,
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
