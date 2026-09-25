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
const { tick, provider, enqueue } = await import("../lib/server/generation.ts");
const { flushMonitoring } = await import("../lib/server/monitoring.ts");
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
const finished = () =>
  Response.json({
    data: [{ b64_json: image.toString("base64") }],
    usage: { input_tokens: 500, output_tokens: 1000 },
  });
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
async function siteBudget(cents) {
  await run(
    "INSERT INTO app_settings (key,value) VALUES ('ai-controls',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    JSON.stringify({ paused: false, dailyBudgetCents: cents }),
  );
}

try {
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
  // A call whose answer never arrives may still be billed.
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
  textReply = null;
  assert.deepEqual(
    (
      await all(
        "SELECT id,status,reserved_cents FROM ai_spend WHERE id IN ('caption-dropped','caption-unreadable') ORDER BY id",
      )
    ).map((row) => [row.id, row.status, row.reserved_cents]),
    [["caption-dropped", "uncertain", 10]],
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

  console.log(
    `PASS: ${checks} AI budget and job checks: settled spend, free daily cap and paid-plan image budget. Provider calls and webhooks are fixtures.`,
  );
} finally {
  console.error = originalError;
  console.warn = originalWarn;
  rmSync(root, { recursive: true, force: true });
}
