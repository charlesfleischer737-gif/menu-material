import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-material-ai-budget-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.OPENAI_API_KEY = "fixture-only";
process.env.JOB_RUNNER_SECRET = "fixture-runner-secret";
process.env.ALERT_WEBHOOK_URL = "https://hooks.example.test/alerts";
process.env.ERROR_WEBHOOK_URL = "https://hooks.example.test/errors";
process.env.APP_ORIGIN = "https://menu.example.test";
const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;
const { handle } = await import("../lib/server/api.ts");
const { one, all, run, id, digest } = await import("../lib/server/core.ts");
const { reserveAi, settledCents } = await import("../lib/server/safeguards.ts");
const { tick, provider, enqueue, jobStatus } =
  await import("../lib/server/generation.ts");
const { flushMonitoring, reportError } =
  await import("../lib/server/monitoring.ts");
const { env } = await import("../lib/local-runtime.ts");

const image = readFileSync("public/pasta.jpg");
const logs = [];
const originalError = console.error,
  originalWarn = console.warn;
console.error = (...args) => logs.push(args.map(String).join(" "));
console.warn = (...args) => logs.push(args.map(String).join(" "));

// Provider and webhook fixtures. Image calls answer in order from imagePlan,
// then from imageHandler, then with a finished image.
const posts = [];
let webhookFails = false;
const imageCalls = [];
const imagePlan = [];
let imageHandler = null;
let textReply = null;
let retrieved = 0;
const finished = () =>
  Response.json({
    data: [{ b64_json: image.toString("base64") }],
    usage: { input_tokens: 500, output_tokens: 1000 },
  });
const refused =
  (status, code, headers = {}) =>
  () =>
    Response.json(
      { error: { message: `Fixture ${code}`, type: code, code } },
      { status, headers },
    );
globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  if (target.startsWith("https://hooks.example.test/")) {
    if (webhookFails) throw new Error("Webhook network failure");
    posts.push({
      channel: target.split("/").at(-1),
      text: JSON.parse(init.body).text,
    });
    return new Response("ok");
  }
  assert(target.startsWith("https://api.openai.com/v1/"), target);
  if (target.includes("/images/")) {
    const prompt =
      init.body instanceof FormData
        ? init.body.get("prompt")
        : JSON.parse(init.body).prompt;
    imageCalls.push({ url: target, prompt });
    const planned = imagePlan.shift();
    if (planned) return planned();
    return imageHandler?.(prompt) || finished();
  }
  if (init.method === "POST") {
    if (textReply) return textReply();
    return Response.json({
      output: [{ content: [{ type: "output_text", text: "Fixture caption" }] }],
      usage: { input_tokens: 300, output_tokens: 60 },
    });
  }
  retrieved++;
  return Response.json({
    id: target.split("/").at(-1),
    status: "in_progress",
  });
};

let checks = 0;
const day = () => new Date(Date.now()).toISOString().slice(0, 10);
async function call(path, { body, cookie, headers = {} } = {}) {
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  const data = await res.json();
  await flushMonitoring();
  return { status: res.status, data };
}
async function restaurant(name, { paid = false, budget } = {}) {
  const userId = id(),
    rid = id(),
    dishId = id(),
    session = `session-${name}`;
  await run(
    "INSERT INTO users (id,email,password,created_at) VALUES (?,?,?,?)",
    userId,
    `${name}@example.test`,
    "not-used",
    Date.now(),
  );
  await run(
    "INSERT INTO restaurants (id,user_id,name,slug,allowance,created_at) VALUES (?,?,?,?,20,?)",
    rid,
    userId,
    name,
    name,
    Date.now(),
  );
  if (budget !== undefined)
    await run(
      "UPDATE restaurants SET daily_budget_cents=? WHERE id=?",
      budget,
      rid,
    );
  await run(
    "INSERT INTO dishes (id,restaurant_id,name,description,confirmed_at,created_at) VALUES (?,?,?,?,?,?)",
    dishId,
    rid,
    name,
    "Three steamed dumplings with chili oil",
    Date.now(),
    Date.now(),
  );
  await run(
    "INSERT INTO sessions (hash,user_id,expires_at) VALUES (?,?,?)",
    digest(session),
    userId,
    Date.now() + 90 * 86400000,
  );
  if (paid) {
    await run(
      "INSERT INTO billing_accounts (restaurant_id,customer_id,subscription_id,status) VALUES (?,?,?,'active')",
      rid,
      `cus_${name}`,
      `sub_${name}`,
    );
    await run(
      "INSERT INTO billing_periods (id,restaurant_id,subscription_id,invoice_id,starts_at,ends_at,allowance) VALUES (?,?,?,?,?,?,100)",
      `bp_${name}`,
      rid,
      `sub_${name}`,
      `in_${name}`,
      Date.now() - 10 * 86400000,
      Date.now() + 60 * 86400000,
    );
  }
  return {
    rid,
    dishId,
    cookie: `menu_material_session=${session}`,
    r: await one("SELECT * FROM restaurants WHERE id=?", rid),
  };
}
const newJob = (fixture, extra = {}) =>
  enqueue(fixture.r, {
    dishId: fixture.dishId,
    requestKey: id(),
    ...extra,
  });
const output = (jobId) => one("SELECT * FROM outputs WHERE job_id=?", jobId);
const jobState = async (jobId) =>
  (await one("SELECT status FROM jobs WHERE id=?", jobId)).status;
const counted = async (rid) =>
  (
    await one(
      "SELECT COUNT(*) AS n FROM outputs WHERE restaurant_id=? AND status!='failed'",
      rid,
    )
  ).n;
async function siteBudget(cents) {
  await run(
    "INSERT INTO app_settings (key,value) VALUES ('ai-controls',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    JSON.stringify({ paused: false, dailyBudgetCents: cents }),
  );
}
// Finish leftover work so a site-wide check sees only a section's own images.
async function settleLeftovers() {
  await run(
    "UPDATE outputs SET status='failed',lease_until=0 WHERE status NOT IN ('completed','failed')",
  );
  await run(
    "UPDATE jobs SET status='failed' WHERE status IN ('queued','processing')",
  );
}
// Make one matching database write fail, like a lost D1 connection.
function failOnce(match) {
  const realPrepare = env.DB.prepare;
  let armed = true;
  env.DB.prepare = (sql) => {
    const statement = realPrepare(sql);
    return Object.assign(
      Object.create(Object.getPrototypeOf(statement)),
      statement,
      {
        bind: (...args) => {
          const bound = statement.bind(...args);
          if (!armed || !match(sql, args)) return bound;
          armed = false;
          return Object.assign(
            Object.create(Object.getPrototypeOf(bound)),
            bound,
            {
              run: async () => {
                throw Error("D1_ERROR: Network connection lost.");
              },
            },
          );
        },
      },
    );
  };
  return () => {
    env.DB.prepare = realPrepare;
  };
}
async function eventually(ready) {
  for (let n = 0; n < 400 && !(await ready()); n++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert(await ready(), "The expected state was not reached");
}
const HELD =
  "Waiting for the daily AI budget to reset at 00:00 UTC. It will start automatically; cancel it to keep your image.";

try {
  let sent, out;
  await siteBudget(10000);

  // 1. Finished calls count at their measured cost, never above the
  // reservation; uncertain calls keep it. Budgets add up the settled amounts.
  assert.equal(
    settledCents("caption", { input_tokens: 300, output_tokens: 60 }),
    0.03,
    "$0.000216 at gpt-4.1-mini list prices, rounded up to 0.03 cents",
  );
  assert.equal(
    settledCents("import", { prompt_tokens: 1_000_000, completion_tokens: 0 }),
    40,
  );
  assert.equal(settledCents("caption", {}), null, "no usage keeps it all");
  assert.equal(settledCents("image", {}), null, "no estimate keeps it all");
  env.IMAGE_COST_ESTIMATE_USD = "0.07";
  assert.equal(settledCents("image", {}), 7);
  env.AI_TEXT_INPUT_USD_PER_MILLION_TOKENS = "2";
  env.AI_TEXT_OUTPUT_USD_PER_MILLION_TOKENS = "8";
  assert.equal(
    settledCents("caption", { input_tokens: 1000, output_tokens: 1000 }),
    1,
    "configured prices apply",
  );
  delete env.AI_TEXT_INPUT_USD_PER_MILLION_TOKENS;
  delete env.AI_TEXT_OUTPUT_USD_PER_MILLION_TOKENS;
  checks++;
  env.AI_FREE_DAILY_TEXT_CALLS = "1000";
  const kitchen = await restaurant("settle-kitchen");
  await provider(
    "responses",
    "POST",
    { input: "caption" },
    { restaurantId: kitchen.rid, kind: "caption", key: "caption-settled" },
  );
  assert.deepEqual(
    {
      ...(await one(
        "SELECT status,reserved_cents FROM ai_spend WHERE id='caption-settled'",
      )),
    },
    { status: "submitted", reserved_cents: 0.03 },
  );
  checks++;
  // A reservation of $0.10 per caption would reach this $2.50 budget after 25.
  await run("DELETE FROM ai_spend");
  await siteBudget(250);
  for (let n = 0; n < 60; n++)
    await provider(
      "responses",
      "POST",
      { input: "caption" },
      { restaurantId: kitchen.rid, kind: "caption" },
    );
  const spent = await one(
    "SELECT SUM(reserved_cents) AS cents FROM ai_spend WHERE budget_day=?",
    day(),
  );
  assert(spent.cents < 2, `60 captions count ${spent.cents} cents`);
  await reserveAi({ restaurantId: kitchen.rid, kind: "image" });
  checks++;
  await run("DELETE FROM ai_spend");
  await siteBudget(10000);
  // A call whose answer never arrives, or cannot be read, may still be billed.
  textReply = () => Promise.reject(new TypeError("fetch failed"));
  await assert.rejects(() =>
    provider(
      "responses",
      "POST",
      {},
      {
        restaurantId: kitchen.rid,
        kind: "caption",
        key: "caption-dropped",
      },
    ),
  );
  textReply = () =>
    new Response('{"output":[{"content', {
      headers: { "content-type": "application/json" },
    });
  await assert.rejects(() =>
    provider(
      "responses",
      "POST",
      {},
      {
        restaurantId: kitchen.rid,
        kind: "caption",
        key: "caption-unreadable",
      },
    ),
  );
  textReply = null;
  assert.deepEqual(
    (
      await all(
        "SELECT id,status,reserved_cents FROM ai_spend WHERE id IN ('caption-dropped','caption-unreadable') ORDER BY id",
      )
    ).map((row) => [row.id, row.status, row.reserved_cents]),
    [
      ["caption-dropped", "uncertain", 10],
      ["caption-unreadable", "uncertain", 10],
    ],
  );
  checks++;
  // Images settle to IMAGE_COST_ESTIMATE_USD when it is set, otherwise they
  // keep their full reservation.
  const estimated = await newJob(kitchen);
  await tick(kitchen.rid);
  assert.equal(await jobState(estimated.id), "completed");
  const estimatedSpend = await one(
    "SELECT status,reserved_cents FROM ai_spend WHERE id=?",
    `${(await output(estimated.id)).id}:1`,
  );
  assert.deepEqual(
    [estimatedSpend.status, estimatedSpend.reserved_cents],
    ["submitted", 7],
  );
  delete env.IMAGE_COST_ESTIMATE_USD;
  const unestimated = await newJob(kitchen, { revision: "brighter" });
  await tick(kitchen.rid);
  assert.equal(
    (
      await one(
        "SELECT reserved_cents FROM ai_spend WHERE id=?",
        `${(await output(unestimated.id)).id}:1`,
      )
    ).reserved_cents,
    200,
  );
  checks++;
  delete env.AI_FREE_DAILY_TEXT_CALLS;

  // 2. Free plans have a daily cap on calls other than images.
  await run("DELETE FROM ai_spend");
  env.AI_FREE_DAILY_TEXT_CALLS = "3";
  const free = await restaurant("free-cap");
  for (const kind of ["caption", "analysis", "import"])
    await reserveAi({ restaurantId: free.rid, kind });
  await assert.rejects(
    () => reserveAi({ restaurantId: free.rid, kind: "caption" }),
    (e) =>
      e.status === 429 &&
      /free plan's 3 AI requests for today/.test(e.message) &&
      /00:00 UTC/.test(e.message),
  );
  const refusedCaption = await call("captions/generate", {
    body: { dishId: free.dishId },
    cookie: free.cookie,
  });
  assert.equal(refusedCaption.status, 429);
  assert.match(refusedCaption.data.error, /free plan's 3 AI requests/);
  checks++;
  await reserveAi({ restaurantId: free.rid, kind: "image" });
  // A call the provider refused cost nothing and does not count.
  await run(
    "UPDATE ai_spend SET status='rejected' WHERE restaurant_id=? AND kind='caption'",
    free.rid,
  );
  await reserveAi({ restaurantId: free.rid, kind: "caption" });
  const pro = await restaurant("paid-cap", { paid: true });
  for (let n = 0; n < 6; n++)
    await reserveAi({ restaurantId: pro.rid, kind: "caption" });
  offset += 86400000;
  await reserveAi({ restaurantId: free.rid, kind: "analysis" });
  offset -= 86400000;
  checks++;
  delete env.AI_FREE_DAILY_TEXT_CALLS;

  // 3. On a paid plan the default restaurant budget no longer holds images to
  // ten a day; an administrator's budget and the site-wide budget still do.
  await run("DELETE FROM ai_spend");
  await siteBudget(1000000);
  const freeImages = await restaurant("free-images");
  for (let n = 0; n < 10; n++)
    await reserveAi({ restaurantId: freeImages.rid, kind: "image" });
  await assert.rejects(
    () => reserveAi({ restaurantId: freeImages.rid, kind: "image" }),
    (e) => e.status === 429,
    "a free restaurant keeps its $20 daily budget",
  );
  const proImages = await restaurant("pro-images", { paid: true });
  for (let n = 0; n < 100; n++)
    await reserveAi({ restaurantId: proImages.rid, kind: "image" });
  await assert.rejects(
    () => reserveAi({ restaurantId: proImages.rid, kind: "image" }),
    (e) => e.status === 429,
    "up to the plan's 100 images a day",
  );
  const proCapped = await restaurant("pro-capped", {
    paid: true,
    budget: 1000,
  });
  for (let n = 0; n < 5; n++)
    await reserveAi({ restaurantId: proCapped.rid, kind: "image" });
  await assert.rejects(
    () => reserveAi({ restaurantId: proCapped.rid, kind: "image" }),
    (e) => e.status === 429,
    "an administrator's own restaurant budget still applies",
  );
  const total = (await one("SELECT SUM(reserved_cents) AS cents FROM ai_spend"))
    .cents;
  await siteBudget(total + 200);
  const proSite = await restaurant("pro-site", { paid: true });
  await reserveAi({ restaurantId: proSite.rid, kind: "image" });
  await assert.rejects(
    () => reserveAi({ restaurantId: proSite.rid, kind: "image" }),
    (e) => e.status === 429 && /AI budget has been reached/.test(e.message),
    "the site-wide budget still applies",
  );
  checks++;
  await run("DELETE FROM ai_spend");
  await siteBudget(10000);

  // 4. A job whose final status write failed is settled from its finished
  // images by the next check, including its correction.
  const stuck = await restaurant("stuck-kitchen");
  const stuckJob = await newJob(stuck);
  await run(
    "INSERT INTO photo_corrections (original_job_id,restaurant_id,reported_asset_id,reason,correction_job_id,status,created_at,updated_at) VALUES (?,?,?,?,?,'queued',?,?)",
    id(),
    stuck.rid,
    id(),
    "ingredients",
    stuckJob.id,
    Date.now(),
    Date.now(),
  );
  let restore = failOnce(
    (sql, args) =>
      sql.startsWith("UPDATE jobs SET status=?") &&
      args[0] === "completed" &&
      args[1] === stuckJob.id,
  );
  await tick(stuck.rid);
  restore();
  assert.equal((await output(stuckJob.id)).status, "completed");
  assert.equal(await jobState(stuckJob.id), "processing");
  assert.deepEqual(
    (await jobStatus(stuck.rid)).jobs.map((job) => job.id),
    [stuckJob.id],
    "pages keep waiting on it",
  );
  await tick(stuck.rid);
  assert.equal(await jobState(stuckJob.id), "completed");
  assert.deepEqual((await jobStatus(stuck.rid)).jobs, []);
  assert.equal(
    (
      await one(
        "SELECT status FROM photo_corrections WHERE correction_job_id=?",
        stuckJob.id,
      )
    ).status,
    "ready",
    "the correction settles as on the normal path",
  );
  checks++;
  // The worker's site-wide sweep reads every job, so it runs at most every
  // ten minutes.
  await settleLeftovers();
  const sweep = async () => {
    const job = await newJob(stuck, { revision: id() });
    await run("UPDATE outputs SET status='completed' WHERE job_id=?", job.id);
    await run("UPDATE jobs SET status='processing' WHERE id=?", job.id);
    await tick();
    return jobState(job.id);
  };
  await run("DELETE FROM app_settings WHERE key='job-settle-last-run'");
  assert.equal(await sweep(), "completed");
  offset += 60000;
  assert.equal(await sweep(), "processing", "not again within ten minutes");
  offset += 10 * 60000;
  await tick();
  assert.equal(
    (
      await one(
        "SELECT COUNT(*) AS n FROM jobs WHERE restaurant_id=? AND status='processing'",
        stuck.rid,
      )
    ).n,
    0,
  );
  checks++;

  // 5. Rate limits and overloads are sent again after a pause, a few times at
  // most and counted once; other refusals explain themselves.
  const busy = await restaurant("busy-kitchen");
  const limited = await newJob(busy);
  sent = imageCalls.length;
  imagePlan.push(refused(429, "rate_limit_exceeded", { "retry-after": "20" }));
  await tick(busy.rid);
  out = await output(limited.id);
  assert.equal(out.status, "queued");
  assert.equal(out.attempts, 1);
  assert(out.next_poll_at >= Date.now() + 19000, "honors Retry-After");
  assert.match(out.error, /busy, so this image will start again automatically/);
  assert.equal(await jobState(limited.id), "queued");
  assert.equal(
    (await one("SELECT status FROM ai_spend WHERE id=?", `${out.id}:1`)).status,
    "rejected",
    "a refused call does not count against the budget",
  );
  await tick(busy.rid);
  assert.equal(imageCalls.length, sent + 1, "not before the wait");
  offset += 21000;
  await tick(busy.rid);
  out = await output(limited.id);
  assert.deepEqual(
    [out.status, out.attempts, out.error],
    ["completed", 2, null],
  );
  assert.equal(imageCalls.length, sent + 2);
  assert.equal(await counted(busy.rid), 1, "the image counts once");
  checks++;
  const overloaded = await newJob(busy, { revision: "overloaded" });
  sent = imageCalls.length;
  for (let n = 0; n < 4; n++) imagePlan.push(refused(503, "server_overloaded"));
  const delays = [];
  for (let n = 0; n < 4; n++) {
    await tick(busy.rid);
    out = await output(overloaded.id);
    if (out.status === "queued") delays.push(out.next_poll_at - Date.now());
    offset += 25000;
  }
  assert.equal(imageCalls.length, sent + 4, "four sends at most");
  assert(
    delays.length === 3 &&
      delays.every((ms, n) => Math.abs(ms - 5000 * 2 ** n) < 1000),
    `doubling pauses: ${delays}`,
  );
  assert.equal(out.status, "failed");
  assert.match(
    out.error,
    /busy\. This image was not counted; please try again in a few minutes/,
  );
  assert.equal(await counted(busy.rid), 1);
  checks++;
  const quota = await newJob(busy, { revision: "quota" });
  imagePlan.push(refused(429, "insufficient_quota"));
  await tick(busy.rid);
  await flushMonitoring();
  out = await output(quota.id);
  assert.equal(out.status, "failed");
  assert.match(out.error, /unavailable on our side/);
  assert(
    posts.some(
      (post) =>
        post.channel === "errors" && /insufficient_quota/.test(post.text),
    ),
    "the operator is told the provider account needs attention",
  );
  const moderated = await newJob(busy, { revision: "moderated" });
  imagePlan.push(refused(400, "moderation_blocked"));
  await tick(busy.rid);
  out = await output(moderated.id);
  assert.equal(out.status, "failed");
  assert.match(out.error, /safety check declined this photo or its wording/);
  assert.match(out.error, /Try a different photo, or reword the dish details/);
  checks++;
  // Provider refusals are not server errors.
  const alerts = () =>
    posts.filter((post) => /server errors in 5 minutes/.test(post.text)).length;
  const burstsBefore = alerts();
  for (let n = 0; n < 12; n++)
    await reportError(Error(`Provider refused ${"x".repeat(n)}`), {
      kind: "job",
      status: 400,
    });
  await flushMonitoring();
  assert.equal(alerts(), burstsBefore);
  for (let n = 0; n < 12; n++)
    await reportError(Error(`Server failed ${"x".repeat(n)}`), {
      kind: "job",
      status: 500,
    });
  await flushMonitoring();
  assert.equal(alerts(), burstsBefore + 1);
  checks++;

  // 6. One image's failed status write neither ends the check early nor cuts
  // off another image rendering in it.
  await settleLeftovers();
  const a = await restaurant("settled-a"),
    b = await restaurant("settled-b");
  const jobA = await newJob(a),
    jobB = await newJob(b);
  let releaseB = null;
  imageHandler = (prompt) =>
    prompt.includes('"name":"settled-b"')
      ? new Promise((resolve) => (releaseB = () => resolve(finished())))
      : null;
  restore = failOnce(
    (sql, args) =>
      sql.startsWith("UPDATE jobs SET status=?") &&
      args[0] === "completed" &&
      args[1] === jobA.id,
  );
  let settled = false;
  const checking = tick().then(() => (settled = true));
  await eventually(async () => (await output(jobA.id)).status === "completed");
  await eventually(() => !!releaseB);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(settled, false, "the check waits for the other render");
  releaseB();
  await checking;
  restore();
  imageHandler = null;
  assert.equal(await jobState(jobB.id), "completed");
  assert.equal(await jobState(jobA.id), "processing");
  await tick(a.rid);
  assert.equal(await jobState(jobA.id), "completed");
  checks++;
  // The worker's check still succeeds and records its heartbeat.
  const jobC = await newJob(a, { revision: "heartbeat" });
  restore = failOnce(
    (sql, args) =>
      sql.startsWith("UPDATE jobs SET status=?") &&
      args[0] === "completed" &&
      args[1] === jobC.id,
  );
  await run("DELETE FROM app_settings WHERE key='worker-heartbeat'");
  const workerCheck = await call("internal/tick", {
    body: {},
    headers: { authorization: "Bearer fixture-runner-secret" },
  });
  restore();
  assert.equal(workerCheck.status, 200);
  assert.equal((await output(jobC.id)).status, "completed");
  assert(
    await one("SELECT value FROM app_settings WHERE key='worker-heartbeat'"),
  );
  checks++;

  // 9. A call abandoned mid-render is recorded as uncertain, as is one whose
  // answer could not be read.
  const lost = await restaurant("lost-call");
  const lostJob = await newJob(lost);
  const lostOutput = await output(lostJob.id);
  await run(
    "UPDATE outputs SET status='submitting',attempts=1,submitted_at=?,lease_until=0 WHERE id=?",
    Date.now() - 300000,
    lostOutput.id,
  );
  await run(
    "INSERT INTO ai_spend (id,restaurant_id,kind,budget_day,reserved_cents,created_at) VALUES (?,?,'image',?,200,?)",
    `${lostOutput.id}:1`,
    lost.rid,
    day(),
    Date.now(),
  );
  sent = imageCalls.length;
  await tick(lost.rid);
  out = await output(lostJob.id);
  assert.equal(out.status, "failed");
  assert.match(out.error, /could not be recovered/);
  assert.equal(imageCalls.length, sent, "never sent again");
  assert.deepEqual(
    {
      ...(await one(
        "SELECT status,reserved_cents FROM ai_spend WHERE id=?",
        `${lostOutput.id}:1`,
      )),
    },
    { status: "uncertain", reserved_cents: 200 },
  );
  const unreadable = await newJob(lost, { revision: "cut off" });
  imagePlan.push(
    () =>
      new Response('{"data":[{"b64_json":"/9j/', {
        headers: { "content-type": "application/json" },
      }),
  );
  await tick(lost.rid);
  out = await output(unreadable.id);
  assert.equal(out.status, "failed");
  assert.match(out.error, /interrupted/);
  assert.equal(
    (await one("SELECT status FROM ai_spend WHERE id=?", `${out.id}:1`)).status,
    "uncertain",
  );
  checks++;

  // 11. Earlier background responses past their deadline fail when they come
  // up for their next check, and a worker check never scans all outputs.
  await settleLeftovers();
  const legacy = await restaurant("legacy-kitchen");
  const legacyJob = await newJob(legacy);
  await run(
    "UPDATE outputs SET status='processing',response_id='resp-legacy',submitted_at=?,next_poll_at=0,lease_until=0 WHERE job_id=?",
    Date.now() - 61 * 60000,
    legacyJob.id,
  );
  const polling = await newJob(legacy, { revision: "still polling" });
  await run(
    "UPDATE outputs SET status='processing',response_id='resp-polling',submitted_at=?,next_poll_at=0,lease_until=0 WHERE job_id=?",
    Date.now() - 60000,
    polling.id,
  );
  const waiting = await newJob(await restaurant("legacy-neighbor"));
  // The site-wide job sweep reads the jobs table and is gated (section 4).
  await run(
    "INSERT INTO app_settings (key,value) VALUES ('job-settle-last-run',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    String(Date.now()),
  );
  const statements = [];
  const realPrepare = env.DB.prepare;
  env.DB.prepare = (sql) => {
    const statement = realPrepare(sql);
    return Object.assign(
      Object.create(Object.getPrototypeOf(statement)),
      statement,
      {
        bind: (...args) => {
          statements.push({ sql, args });
          return statement.bind(...args);
        },
      },
    );
  };
  const before = retrieved;
  try {
    await tick();
  } finally {
    env.DB.prepare = realPrepare;
  }
  out = await output(legacyJob.id);
  assert.equal(out.status, "failed");
  assert.match(out.error, /took too long to recover/);
  assert.equal(await jobState(legacyJob.id), "failed");
  assert.equal(retrieved, before + 1, "only the response in time is retrieved");
  assert.equal((await output(polling.id)).status, "processing");
  assert.equal(await jobState(waiting.id), "completed");
  const scans = [];
  for (const { sql, args } of statements.filter((s) =>
    /\boutputs\b/.test(s.sql),
  ))
    for (const row of await all("EXPLAIN QUERY PLAN " + sql, ...args))
      if (/^SCAN (outputs|o|x)$/.test(row.detail))
        scans.push(`${row.detail}: ${sql}`);
  assert.deepEqual(scans, [], "every outputs query uses an index");
  checks++;

  // 12. A full workspace is refused before any image is paid for.
  const store = await restaurant("full-storage");
  sent = imageCalls.length;
  env.WORKSPACE_STORAGE_MB = "1";
  const full = await call("jobs", {
    body: { dishId: store.dishId, requestKey: id() },
    cookie: store.cookie,
  });
  delete env.WORKSPACE_STORAGE_MB;
  assert.equal(full.status, 413);
  assert.match(full.data.error, /storage is full/);
  assert.equal(
    (
      await one(
        "SELECT COUNT(*) AS n FROM jobs WHERE restaurant_id=?",
        store.rid,
      )
    ).n,
    0,
  );
  const filling = await newJob(store);
  env.WORKSPACE_STORAGE_MB = "1";
  await tick(store.rid);
  delete env.WORKSPACE_STORAGE_MB;
  out = await output(filling.id);
  assert.equal(out.status, "failed");
  assert.match(out.error, /storage is full, so this image wasn't created/);
  assert.equal(imageCalls.length, sent, "no image call");
  assert.equal(await counted(store.rid), 0, "nothing is counted");
  assert.equal(
    (
      await one(
        "SELECT COUNT(*) AS n FROM storage_reservations WHERE id LIKE 'headroom:%'",
      )
    ).n,
    0,
  );
  checks++;

  // 13. While the daily budget is spent, queued images are held without being
  // claimed or sent, say why honestly, and start by themselves later.
  await run("DELETE FROM ai_spend");
  await siteBudget(100);
  const held = await restaurant("held-kitchen");
  const heldJob = await newJob(held);
  sent = imageCalls.length;
  await tick(held.rid);
  out = await output(heldJob.id);
  assert.deepEqual(
    [out.status, out.attempts, out.lease_until, out.lease_token, out.error],
    ["queued", 0, 0, null, HELD],
    "held without being claimed",
  );
  assert(out.next_poll_at > Date.now() + 55000);
  assert.equal(await jobState(heldJob.id), "queued");
  assert.equal((await one("SELECT COUNT(*) AS n FROM ai_spend")).n, 0);
  assert.equal(imageCalls.length, sent);
  assert.equal(
    (await jobStatus(held.rid)).outputs[0].error,
    HELD,
    "the page shows why",
  );
  await tick(held.rid);
  assert.equal((await output(heldJob.id)).next_poll_at, out.next_poll_at);
  await siteBudget(10000);
  offset += 61000;
  await tick(held.rid);
  out = await output(heldJob.id);
  assert.deepEqual([out.status, out.error], ["completed", null]);
  checks++;

  // 14. A description-only image is described, not "kept" from a photo.
  const described = await restaurant("described");
  const describedJob = await newJob(described);
  const describedPrompt = JSON.parse(describedJob.details).generationPrompts[0];
  assert.doesNotMatch(
    describedPrompt,
    /original upload|original camera angle|Keep the original plate|this same dish/,
  );
  assert.match(describedPrompt, /No photo of this dish was supplied/);
  assert.match(describedPrompt, /Three steamed dumplings with chili oil/);
  await tick(described.rid);
  assert.equal(imageCalls.at(-1).url.endsWith("/images/generations"), true);
  assert.equal(imageCalls.at(-1).prompt, describedPrompt);
  const form = new FormData();
  form.set("file", new File([image], "dish.jpg", { type: "image/jpeg" }));
  form.set(
    "normalized",
    new File([image], "dish-working.jpg", { type: "image/jpeg" }),
  );
  form.set("dishId", described.dishId);
  const uploaded = await handle(
    new Request("http://localhost/api/assets", {
      method: "POST",
      headers: { cookie: described.cookie },
      body: form,
    }),
  );
  assert.equal(uploaded.status, 201);
  const photoJob = await newJob(described, {
    sourceId: (await uploaded.json()).id,
  });
  assert.match(
    JSON.parse(photoJob.details).generationPrompts[0],
    /Use the original upload as the source of truth/,
  );
  checks++;

  console.log(
    `PASS: ${checks} AI budget and job checks: settled spend, free daily cap, paid-plan image budget, stuck-job repair, provider retries and refusals, independent image settling, uncertain spend, legacy deadlines on an index, storage before calls, budget holds and description prompts. Provider calls and webhooks are fixtures.`,
  );
} finally {
  console.error = originalError;
  console.warn = originalWarn;
  rmSync(root, { recursive: true, force: true });
}
