import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
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
const {
  reserveAi,
  settledCents,
  aiBudgetRoom,
  freeBudgetShare,
  GUEST_AI,
  MENU_READING_TIMEOUT_MS,
} = await import("../lib/server/safeguards.ts");
const { tick, provider, enqueue, jobStatus } =
  await import("../lib/server/generation.ts");
const { flushMonitoring, reportError } =
  await import("../lib/server/monitoring.ts");
const { env, keptAlive } = await import("../lib/local-runtime.ts");

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
      "INSERT INTO billing_periods (id,restaurant_id,subscription_id,invoice_id,starts_at,ends_at,allowance) VALUES (?,?,?,?,?,?,50)",
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

let runner;
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
  // Without an estimate, an image counts the usage the Images API reports:
  // text input, image input and output tokens, at gpt-image-1's list prices
  // by default. Input not reported as text is priced as image input.
  assert.equal(
    settledCents("image", {
      input_tokens: 1000,
      input_tokens_details: { text_tokens: 200, image_tokens: 800 },
      output_tokens: 4000,
    }),
    16.9,
    "$0.001 + $0.008 + $0.16",
  );
  assert.equal(
    settledCents("image", { input_tokens: 500, output_tokens: 1000 }),
    4.5,
  );
  assert.equal(
    settledCents("image", {}),
    null,
    "no estimate and no usage keeps it all",
  );
  assert.equal(settledCents("image", { output_tokens: 1000 }), null);
  env.AI_IMAGE_OUTPUT_USD_PER_MILLION_TOKENS = "80";
  assert.equal(
    settledCents("image", { input_tokens: 0, output_tokens: 1000 }),
    8,
    "configured image prices apply",
  );
  delete env.AI_IMAGE_OUTPUT_USD_PER_MILLION_TOKENS;
  env.IMAGE_COST_ESTIMATE_USD = "0.07";
  assert.equal(settledCents("image", {}), 7);
  assert.equal(
    settledCents("image", { input_tokens: 500, output_tokens: 1000 }),
    7,
    "a set estimate wins over usage",
  );
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
  // Guests and Free plans share only part of the site-wide budget (section
  // 17); here they may use all of it.
  env.AI_FREE_BUDGET_SHARE_PERCENT = "100";
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
  // Unsettled, 60 captions at their $0.01 reservation would leave no room for
  // an image in this $2.50 budget.
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
      ["caption-dropped", "uncertain", 1],
      ["caption-unreadable", "uncertain", 1],
    ],
  );
  checks++;
  // Images settle to IMAGE_COST_ESTIMATE_USD when it is set, otherwise to
  // the cost of the usage the provider reports; without usage they keep
  // their full reservation.
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
  assert.equal((await output(estimated.id)).cost_estimate, 0.07);
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
    4.5,
    "500 input and 1,000 output tokens",
  );
  assert.equal(
    (await output(unestimated.id)).cost_estimate,
    0.045,
    "the dashboard shows the measured cost",
  );
  const unmeasured = await newJob(kitchen, { revision: "no usage" });
  imagePlan.push(() =>
    Response.json({ data: [{ b64_json: image.toString("base64") }] }),
  );
  await tick(kitchen.rid);
  assert.equal(await jobState(unmeasured.id), "completed");
  assert.equal(
    (
      await one(
        "SELECT reserved_cents FROM ai_spend WHERE id=?",
        `${(await output(unmeasured.id)).id}:1`,
      )
    ).reserved_cents,
    200,
  );
  checks++;
  delete env.AI_FREE_DAILY_TEXT_CALLS;
  delete env.AI_FREE_BUDGET_SHARE_PERCENT;

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
  for (let n = 0; n < 50; n++)
    await reserveAi({ restaurantId: proImages.rid, kind: "image" });
  await assert.rejects(
    () => reserveAi({ restaurantId: proImages.rid, kind: "image" }),
    (e) => e.status === 429,
    "up to the plan's 50 images a day",
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

  // 7 and 8. --once keeps checking every two seconds for its window, then
  // waits for a running image call before it exits. More checks can overlap
  // than the six images the site renders at once.
  assert.match(
    readFileSync("scripts/job-runner.mjs", "utf8"),
    /const maxRunning = 8;/,
  );
  const requests = [];
  let answerFirst = null;
  const server = createServer((req, res) => {
    requests.push(req.headers.authorization);
    const answer = () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
    };
    if (requests.length === 1) answerFirst = answer;
    else answer();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  runner = spawn(process.execPath, ["scripts/job-runner.mjs", "--once"], {
    env: {
      ...process.env,
      APP_ORIGIN: `http://127.0.0.1:${server.address().port}`,
      JOB_RUNNER_SECRET: "fixture-runner-secret",
      RUNNER_ONCE_SECONDS: "5",
      RUNNER_HEARTBEAT_FILE: join(root, "runner-heartbeat"),
    },
    stdio: "ignore",
  });
  const exited = new Promise((resolve) => runner.on("exit", resolve));
  await new Promise((resolve) => setTimeout(resolve, 6500));
  assert.equal(runner.exitCode, null, "still waiting on its first check");
  assert(
    requests.length >= 3 && requests.length <= 4,
    `checks every two seconds for five seconds: ${requests.length}`,
  );
  assert(requests.every((auth) => auth === "Bearer fixture-runner-secret"));
  answerFirst();
  assert.equal(await exited, 0);
  runner = null;
  server.close();
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

  // 15. A saved style naming a photo style since removed still creates images.
  // The saved look applies to new work with Pro features (comped here).
  const retired = await restaurant("retired-style");
  await run(
    "UPDATE restaurants SET style=?,pro_until=? WHERE id=?",
    JSON.stringify({
      photoPreset: "retired-look",
      tone: "Playful",
      photoStyle: "Warm wood and soft window light",
      referenceIds: ["not-a-uuid"],
    }),
    Date.now() + 365 * 86400000,
    retired.rid,
  );
  const retiredJob = await enqueue(
    await one("SELECT * FROM restaurants WHERE id=?", retired.rid),
    { dishId: retired.dishId, requestKey: id() },
  );
  const retiredStyle = JSON.parse(retiredJob.details).style;
  assert.deepEqual(
    [
      retiredStyle.photoPreset,
      retiredStyle.tone,
      retiredStyle.photoStyle,
      retiredStyle.referenceIds,
    ],
    ["", "Playful", "Warm wood and soft window light", []],
  );
  checks++;

  // 16. With default settings a finished image counts the cost of the usage
  // the provider reports, not its $2 reservation, so fifty images in a day no
  // longer hold the next one: neither ten free accounts' five each before a
  // Pro image, nor one Pro account's fifty before a new signup's first.
  await settleLeftovers();
  await run("DELETE FROM ai_spend");
  await siteBudget(10000);
  async function makeImages(fixture, count) {
    const jobs = [];
    for (let n = 0; n < count; n++)
      jobs.push((await newJob(fixture, { revision: id() })).id);
    for (let n = 0; n < count; n++) await tick(fixture.rid);
    for (const job of jobs) assert.equal(await jobState(job), "completed");
  }
  for (let n = 0; n < 10; n++)
    await makeImages(await restaurant(`fifty-free-${n}`), 5);
  const fifty = await one(
    "SELECT COUNT(*) AS n,SUM(reserved_cents) AS cents FROM ai_spend WHERE budget_day=? AND kind='image' AND status='submitted'",
    day(),
  );
  assert.deepEqual([fifty.n, fifty.cents], [50, 225], "4.5 cents each");
  // The next image, a Pro restaurant's, is made; and after that account's
  // own fifty, so is a new signup's first.
  const fiftyPro = await restaurant("fifty-pro", { paid: true });
  await makeImages(fiftyPro, 1);
  await makeImages(fiftyPro, 49);
  await makeImages(await restaurant("fifty-signup"), 1);
  checks++;

  // 17. Guests and Free plans together use at most
  // AI_FREE_BUDGET_SHARE_PERCENT (default 70) of the site-wide budget, checked
  // in the same atomic reservation, so an active paid plan always has the
  // rest. At 100 they share all of it, as before.
  assert.equal(freeBudgetShare(), 70);
  await settleLeftovers();
  await run("DELETE FROM ai_spend");
  await siteBudget(1000);
  env.AI_FREE_BUDGET_SHARE_PERCENT = "60";
  const shareFree = await restaurant("share-free"),
    sharePro = await restaurant("share-pro", { paid: true });
  for (let n = 0; n < 3; n++)
    await reserveAi({ restaurantId: shareFree.rid, kind: "image" });
  await assert.rejects(
    () => reserveAi({ restaurantId: shareFree.rid, kind: "image" }),
    (e) => e.status === 429 && /AI budget has been reached/.test(e.message),
  );
  await assert.rejects(
    () => reserveAi({ restaurantId: GUEST_AI, kind: "analysis" }),
    (e) => e.status === 429 && /Tell us what’s in your photo/.test(e.message),
    "guests share the same part",
  );
  assert.equal(await aiBudgetRoom(shareFree.rid, "image"), false);
  assert.equal(await aiBudgetRoom(sharePro.rid, "image"), true);
  for (let n = 0; n < 2; n++)
    await reserveAi({ restaurantId: sharePro.rid, kind: "image" });
  await assert.rejects(
    () => reserveAi({ restaurantId: sharePro.rid, kind: "image" }),
    (e) => e.status === 429,
    "the site-wide budget still applies",
  );
  assert.deepEqual(
    (
      await all(
        "SELECT paid,SUM(reserved_cents) AS cents FROM ai_spend GROUP BY paid ORDER BY paid",
      )
    ).map((row) => [row.paid, row.cents]),
    [
      [0, 600],
      [1, 400],
    ],
  );
  checks++;
  // Queued images: a Free restaurant's waits while a paid one's is made.
  await run("DELETE FROM ai_spend");
  await run(
    "INSERT INTO ai_spend (id,restaurant_id,kind,budget_day,reserved_cents,status,created_at) VALUES (?,?,'caption',?,500,'submitted',?)",
    id(),
    shareFree.rid,
    day(),
    Date.now(),
  );
  const waitingFree = await newJob(shareFree),
    madePro = await newJob(sharePro);
  await tick(shareFree.rid);
  await tick(sharePro.rid);
  out = await output(waitingFree.id);
  assert.deepEqual([out.status, out.error], ["queued", HELD]);
  assert.equal(await jobState(madePro.id), "completed");
  env.AI_FREE_BUDGET_SHARE_PERCENT = "100";
  offset += 61000;
  await tick(shareFree.rid);
  assert.equal(await jobState(waitingFree.id), "completed");
  delete env.AI_FREE_BUDGET_SHARE_PERCENT;
  checks++;

  // 18. A text call runs on to its settlement if the page that asked for it
  // closes: it is kept alive from the start, as images are. (On Workers a
  // closed connection cancels whatever is not kept alive.)
  await run("DELETE FROM ai_spend");
  await siteBudget(10000);
  env.AI_FREE_DAILY_TEXT_CALLS = "1000";
  const closing = await restaurant("closing-tab");
  let answer = null;
  textReply = () =>
    new Promise((resolve) => {
      answer = () =>
        resolve(
          Response.json({
            output: [
              { content: [{ type: "output_text", text: "Fixture caption" }] },
            ],
            usage: { input_tokens: 300, output_tokens: 60 },
          }),
        );
    });
  const alreadyKept = new Set(keptAlive);
  const leaving = provider(
    "responses",
    "POST",
    { input: "caption" },
    { restaurantId: closing.rid, kind: "caption", key: "caption-kept" },
  );
  const kept = [...keptAlive].filter((work) => !alreadyKept.has(work));
  assert.equal(kept.length, 1, "kept alive before anything is sent");
  await eventually(() => !!answer);
  assert.equal(
    (await one("SELECT status FROM ai_spend WHERE id='caption-kept'")).status,
    "reserved",
  );
  answer();
  // What a Worker keeps running once the client has gone.
  await Promise.all(kept);
  assert.deepEqual(
    {
      ...(await one(
        "SELECT status,reserved_cents FROM ai_spend WHERE id='caption-kept'",
      )),
    },
    { status: "submitted", reserved_cents: 0.03 },
  );
  await leaving;
  textReply = null;
  delete env.AI_FREE_DAILY_TEXT_CALLS;
  checks++;

  // 19. A call cut off before it settled (a Worker stopped mid-call, or a
  // menu reading outliving the time a closed tab allows) no longer holds the
  // budget until midnight UTC. With a provider that never answers, visitors'
  // photo checks fill the guests' share and hold a Pro image. Twice their
  // timeout later the worker's housekeeping counts them as uncertain, at the
  // most a finished check cost that day; a menu reading waits twice its own
  // longer timeout.
  await settleLeftovers();
  await run("DELETE FROM ai_spend");
  await siteBudget(250);
  env.AI_ANALYSIS_RESERVE_USD = "0.25";
  const guestCheck = async (bytes, network) => {
    const form = new FormData();
    form.set("file", new File([bytes], "photo.jpg", { type: "image/jpeg" }));
    const res = await handle(
      new Request("http://localhost/api/guest-photo-analysis", {
        method: "POST",
        headers: { "cf-connecting-ip": network },
        body: form,
      }),
    );
    return { status: res.status, data: await res.json() };
  };
  const photo = (n) => Buffer.concat([image, Buffer.from([n])]);
  const replyReading = () =>
    Response.json({
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                family: "Pizza",
                subject: "Margherita pizza",
                confidence: "high",
                drinkKind: "other",
                menuDocument: false,
                issue: "none",
              }),
            },
          ],
        },
      ],
      usage: { input_tokens: 400, output_tokens: 40 },
    });
  const workerTick = () =>
    call("internal/tick", {
      body: {},
      headers: { authorization: "Bearer fixture-runner-secret" },
    });
  const guestSpend = async (status) =>
    (
      await all(
        "SELECT reserved_cents FROM ai_spend WHERE restaurant_id=? AND status=? ORDER BY created_at",
        GUEST_AI,
        status,
      )
    ).map((row) => row.reserved_cents);
  textReply = replyReading;
  assert.equal((await guestCheck(photo(0), "192.0.2.1")).status, 200);
  assert.deepEqual(await guestSpend("submitted"), [0.03]);
  textReply = () => new Promise(() => {});
  // Their visitors leave, and nothing answers or settles them.
  for (let n = 1; n <= 6; n++) void guestCheck(photo(n), `192.0.2.${10 + n}`);
  const reader = await restaurant("cut-reader");
  void provider(
    "responses",
    "POST",
    {},
    { restaurantId: reader.rid, kind: "import", key: "import-cut" },
    MENU_READING_TIMEOUT_MS,
  );
  await eventually(
    async () =>
      (await one("SELECT COUNT(*) AS n FROM ai_spend WHERE status='reserved'"))
        .n === 7,
  );
  const cutPro = await restaurant("cut-pro", { paid: true });
  assert.equal(await aiBudgetRoom(cutPro.rid, "image"), false, "held");
  assert.equal((await guestCheck(photo(7), "192.0.2.30")).status, 429);
  offset += 40000;
  await workerTick();
  assert.deepEqual(await guestSpend("reserved"), Array(6).fill(25));
  offset += 61000;
  await workerTick();
  assert.deepEqual(await guestSpend("uncertain"), Array(6).fill(0.03));
  assert.deepEqual(
    {
      ...(await one(
        "SELECT status,reserved_cents FROM ai_spend WHERE id='import-cut'",
      )),
    },
    { status: "reserved", reserved_cents: 5 },
  );
  assert.equal(await aiBudgetRoom(cutPro.rid, "image"), true, "no longer");
  textReply = replyReading;
  assert.equal((await guestCheck(photo(8), "192.0.2.31")).status, 200);
  offset += 150000;
  await workerTick();
  assert.deepEqual(
    {
      ...(await one(
        "SELECT status,reserved_cents FROM ai_spend WHERE id='import-cut'",
      )),
    },
    { status: "uncertain", reserved_cents: 5 },
    "no reading finished today, so it keeps its $0.05 reservation",
  );
  delete env.AI_ANALYSIS_RESERVE_USD;
  checks++;

  // 20. Before signup, the sample photo has a fixed reading, and a photo read
  // in the past week is answered from that reading, so neither calls the AI
  // service or counts toward a network's daily checks. Besides 20 an hour,
  // each network gets AI_GUEST_DAILY_CALLS_PER_NETWORK (default 60) a day.
  await run("DELETE FROM ai_spend");
  await siteBudget(10000);
  let readings = 0;
  textReply = () => {
    readings++;
    return replyReading();
  };
  const sampleFile = readFileSync("public/burger-phone-original.jpg");
  const sampleRead = await guestCheck(sampleFile, "192.0.2.40");
  assert.equal(sampleRead.status, 200);
  assert.deepEqual(
    [
      sampleRead.data.family,
      sampleRead.data.confidence,
      sampleRead.data.menuDocument,
    ],
    ["Burgers & sandwiches", "high", false],
  );
  const firstRead = await guestCheck(photo(100), "192.0.2.41");
  const againRead = await guestCheck(photo(100), "192.0.2.42");
  assert.equal(firstRead.data.subject, "Margherita pizza");
  assert.deepEqual(againRead.data, firstRead.data);
  assert.equal(readings, 1, "the sample and a repeated photo make no call");
  assert.deepEqual(await guestSpend("submitted"), [0.03]);
  checks++;
  env.AI_GUEST_DAILY_CALLS_PER_NETWORK = "2";
  for (const n of [101, 102])
    assert.equal((await guestCheck(photo(n), "192.0.2.43")).status, 200);
  const capped = await guestCheck(photo(103), "192.0.2.43");
  assert.equal(capped.status, 429);
  assert.match(capped.data.error, /used up for today/);
  assert.equal((await guestCheck(photo(100), "192.0.2.43")).status, 200);
  assert.equal((await guestCheck(sampleFile, "192.0.2.43")).status, 200);
  assert.equal(readings, 3);
  offset += 86400000;
  assert.equal((await guestCheck(photo(103), "192.0.2.43")).status, 200);
  delete env.AI_GUEST_DAILY_CALLS_PER_NETWORK;
  checks++;
  // A reading is kept a week.
  offset += 8 * 86400000;
  await workerTick();
  assert.equal((await guestCheck(photo(100), "192.0.2.44")).status, 200);
  assert.equal(readings, 5, "read again once the week is over");
  textReply = null;
  checks++;

  // A once-a-day budget alert that fails to deliver is retried within
  // minutes, not the next day, and is still sent only once that day.
  {
    const { evaluateAlerts } = await import("../lib/server/monitoring.ts");
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const start = Date.parse(`${tomorrow}T14:00:00.000Z`);
    const at = (minutes) => (offset = start + minutes * 60000 - realNow());
    const check = async (minutes) => {
      at(minutes);
      await evaluateAlerts();
      await flushMonitoring();
    };
    at(0);
    const spent = await restaurant("budget-alert");
    await siteBudget(1000);
    await run(
      "INSERT INTO ai_spend (id,restaurant_id,kind,budget_day,reserved_cents,status,created_at) VALUES (?,?,'image',?,1000,'submitted',?)",
      id(),
      spent.rid,
      day(),
      Date.now(),
    );
    const usedUp = () =>
      posts.filter((p) => /budget is used up/.test(p.text)).length;
    const before = usedUp();
    webhookFails = true;
    await check(0);
    webhookFails = false;
    await check(2);
    assert.equal(usedUp(), before, "waits about five minutes to retry");
    await check(6);
    assert.equal(usedUp(), before + 1, "retries a failed daily alert");
    await check(30);
    assert.equal(usedUp(), before + 1, "sends a daily alert once");
    checks++;
  }

  // Before signup the guest studio hears whether an image can be made now,
  // and afterwards the account does: a yes or no, never spend figures.
  {
    await run("DELETE FROM ai_spend");
    await siteBudget(1000);
    const free = await restaurant("images-free"),
      paid = await restaurant("images-pro", { paid: true });
    // Signed out, a Free account, a paid one.
    const available = async () => {
      const answers = [];
      for (const cookie of [undefined, free.cookie, paid.cookie])
        answers.push((await call("state", { cookie })).data.imagesAvailable);
      return answers;
    };
    assert.deepEqual(await available(), [true, true, true]);
    assert.doesNotMatch(
      JSON.stringify((await call("state")).data),
      /cents|spent|budget/i,
    );
    // Guests and Free plans have used their share; paid plans keep the rest.
    for (let n = 0; n < 3; n++)
      await reserveAi({ restaurantId: free.rid, kind: "image" });
    assert.deepEqual(await available(), [false, false, true]);
    // The whole day's budget is used.
    for (let n = 0; n < 2; n++)
      await reserveAi({ restaurantId: paid.rid, kind: "image" });
    assert.deepEqual(await available(), [false, false, false]);
    await run("DELETE FROM ai_spend");
    assert.deepEqual(await available(), [true, true, true]);
    // AI work paused in Administration.
    await run(
      "UPDATE app_settings SET value=? WHERE key='ai-controls'",
      JSON.stringify({ paused: true, dailyBudgetCents: 1000 }),
    );
    assert.deepEqual(await available(), [false, false, false]);
    await siteBudget(1000);
    // No OpenAI key.
    env.OPENAI_API_KEY = "";
    try {
      assert.deepEqual(await available(), [false, false, false]);
    } finally {
      env.OPENAI_API_KEY = "fixture-only";
    }
    assert.deepEqual(await available(), [true, true, true]);
    checks++;
  }

  console.log(
    `PASS: ${checks} AI budget and job checks: settled spend, free daily cap, paid-plan image budget, stuck-job repair, provider retries and refusals, independent image settling, --once window and runner capacity, uncertain spend, legacy deadlines on an index, storage before calls, budget holds, description prompts, lenient saved styles, fifty images settled from usage, the guests' and Free plans' share, text calls kept alive, cut-off calls settled by housekeeping, the sample, cached and daily-capped photo checks before signup, same-day retries of failed daily alerts, and whether images can be made, told before signup. Provider calls and webhooks are fixtures.`,
  );
} finally {
  runner?.kill();
  console.error = originalError;
  console.warn = originalWarn;
  rmSync(root, { recursive: true, force: true });
}
