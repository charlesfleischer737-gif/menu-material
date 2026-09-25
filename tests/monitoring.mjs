import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-material-monitoring-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
// Without an AI key the tick leaves jobs queued, which is what these checks need.
process.env.OPENAI_API_KEY = "";
process.env.JOB_RUNNER_SECRET = "fixture-runner-secret";
process.env.ALERT_WEBHOOK_URL = "https://hooks.example.test/alerts";
process.env.ERROR_WEBHOOK_URL = "https://hooks.example.test/errors";
process.env.APP_ORIGIN = "https://menu.example.test";
const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;
const minute = 60000;
const { handle } = await import("../lib/server/api.ts");
const { one, run, id, digest } = await import("../lib/server/core.ts");
const { reportError, flushMonitoring } =
  await import("../lib/server/monitoring.ts");
const { env } = await import("../lib/local-runtime.ts");

const posts = [];
let webhookFails = false;
globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  assert(target.startsWith("https://hooks.example.test/"), target);
  if (webhookFails) throw new Error("Webhook network failure");
  const body = JSON.parse(init.body);
  // `text` for Slack-compatible hooks, `content` for Discord.
  for (const field of [body.text, body.content])
    assert(field.startsWith("[Menu Material · menu.example.test] "));
  assert.deepEqual(body.allowed_mentions, { parse: [] });
  posts.push({
    channel: target.split("/").at(-1),
    text: body.text,
    content: body.content,
  });
  return new Response("ok");
};
const logs = [];
const originalError = console.error,
  originalWarn = console.warn;
console.error = (...args) => logs.push(args.map(String).join(" "));
console.warn = (...args) => logs.push(args.map(String).join(" "));

let checks = 0;
async function call(path, { method, headers = {}, body, cookie } = {}) {
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body:
        body === undefined || typeof body === "string"
          ? body
          : JSON.stringify(body),
    }),
  );
  const data = await res.json();
  await flushMonitoring();
  return { status: res.status, data, res };
}
async function expect(path, status, options) {
  const result = await call(path, options);
  assert.equal(
    result.status,
    status,
    `${path}: ${JSON.stringify(result.data)}`,
  );
  checks++;
  return result.data;
}
const alerts = () => posts.filter((p) => p.channel === "alerts");
const errors = () => posts.filter((p) => p.channel === "errors");
const bearer = { authorization: "Bearer fixture-runner-secret" };
const tickWorker = () =>
  expect("internal/tick", 200, { body: {}, headers: bearer });

async function owner(name) {
  const userId = id(),
    rid = id(),
    session = `session-${name}`;
  await run(
    "INSERT INTO users (id,email,password,created_at) VALUES (?,?,?,?)",
    userId,
    `${name}@example.test`,
    "not-used",
    Date.now(),
  );
  await run(
    "INSERT INTO restaurants (id,user_id,name,slug,allowance,created_at) VALUES (?,?,?,?,10,?)",
    rid,
    userId,
    name,
    name,
    Date.now(),
  );
  await run(
    "INSERT INTO sessions (hash,user_id,expires_at) VALUES (?,?,?)",
    digest(session),
    userId,
    Date.now() + 30 * 86400000,
  );
  return { rid, cookie: `menu_material_session=${session}` };
}
async function queueJob(rid) {
  const dishId = id(),
    jobId = id(),
    outputId = id();
  await run(
    "INSERT INTO dishes (id,restaurant_id,name,description,confirmed_at,created_at) VALUES (?,?,'Fixture','Fixture dish',?,?)",
    dishId,
    rid,
    Date.now(),
    Date.now(),
  );
  await run(
    "INSERT INTO jobs (id,restaurant_id,dish_id,request_key,fingerprint,prompt,details,input_method,status,created_at) VALUES (?,?,?,?,'f','','{}','upload','queued',?)",
    jobId,
    rid,
    dishId,
    id(),
    Date.now(),
  );
  await run(
    "INSERT INTO outputs (id,job_id,restaurant_id,slot,status,created_at) VALUES (?,?,?,0,'queued',?)",
    outputId,
    jobId,
    rid,
    Date.now(),
  );
  return outputId;
}

try {
  // Liveness stays cheap and unconditional.
  assert.deepEqual(await expect("health", 200), { ok: true });

  // No worker has ever checked in: not ready, and only coarse detail is public.
  let ready = await expect("health/ready", 503);
  assert.deepEqual(ready.failed, ["worker"]);
  assert.deepEqual(ready.checks, {
    database: "ok",
    storage: "ok",
    worker: "degraded",
    queue: "ok",
    aiBudget: "ok",
  });
  assert(!/lastSeen|configured|Cents|latency/.test(JSON.stringify(ready)));
  // Uptime monitors that probe with HEAD get the same status.
  const head = await handle(
    new Request("http://localhost/api/health/ready", { method: "HEAD" }),
  );
  assert.equal(head.status, 503);
  assert.equal(alerts().length, 0, "idle site without jobs does not alert");
  checks++;

  // The worker's authenticated tick records a heartbeat and makes it ready.
  await tickWorker();
  ready = await expect("health/ready", 200);
  assert.equal(ready.ok, true);
  assert.equal(ready.checks.worker, "ok");
  checks++;
  const detail = await expect("health/ready", 200, { headers: bearer });
  assert.equal(detail.checks.worker.configured, true);
  assert.equal(typeof detail.checks.worker.ageSeconds, "number");
  assert.equal(typeof detail.checks.database.latencyMs, "number");
  assert.deepEqual(detail.monitoring, { alerting: true, errorReporting: true });
  assert(!JSON.stringify(detail).includes("fixture-runner-secret"));
  checks++;
  const wrongSecret = await expect("health/ready", 200, {
    headers: { authorization: "Bearer not-the-secret" },
  });
  assert.equal(wrongSecret.checks.worker, "ok");
  checks++;

  // Admins see the detail; owners get the public view.
  const dev = await call("auth/dev", { body: {} });
  const adminCookie = dev.res.headers.get("set-cookie").split(";")[0];
  const adminReady = await expect("health/ready", 200, { cookie: adminCookie });
  assert.equal(typeof adminReady.checks.queue.queued, "number");
  const adminData = await expect("admin", 200, { cookie: adminCookie });
  assert.equal(adminData.readiness.ok, true);
  assert.equal(adminData.readiness.checks.storage.ok, true);
  const kitchen = await owner("kitchen");
  const ownerReady = await expect("health/ready", 200, {
    cookie: kitchen.cookie,
  });
  assert.equal(ownerReady.checks.queue, "ok");
  let state = await expect("state", 200, { cookie: kitchen.cookie });
  assert.equal(state.workerHealthy, true);
  checks++;

  // A stale heartbeat while a job waits fails readiness and alerts once.
  const outputId = await queueJob(kitchen.rid);
  offset += 200000;
  ready = await expect("health/ready", 503);
  assert.deepEqual(ready.failed, ["worker"]);
  state = await expect("state", 200, { cookie: kitchen.cookie });
  assert.equal(state.workerHealthy, false);
  assert.equal(alerts().length, 1);
  assert.match(alerts()[0].text, /has not checked in for 3 min/);
  assert.match(alerts()[0].text, /1 image job is waiting/);
  checks++;
  await expect("health/ready", 503);
  offset += minute;
  await expect("health/ready", 503);
  assert.equal(alerts().length, 1, "worker alert is deduplicated");
  checks++;

  // The oldest waiting job crosses the queue threshold.
  offset += 7 * minute;
  ready = await expect("health/ready", 503, { headers: bearer });
  assert.deepEqual(ready.failed, ["worker", "queue"]);
  assert(ready.checks.queue.oldestQueuedSeconds >= 600);
  assert.equal(alerts().length, 2);
  assert.match(alerts()[1].text, /oldest image job has been waiting 1\d min/);
  checks++;

  // The worker returns: its alert resolves while the queue alert stays muted.
  offset += minute;
  await tickWorker();
  assert.equal(alerts().length, 3);
  assert.match(alerts()[2].text, /Resolved: the background worker/);
  state = await expect("state", 200, { cookie: kitchen.cookie });
  assert.equal(state.workerHealthy, true);
  checks++;

  // Unresolved conditions repeat only after the repeat window.
  offset += 61 * minute;
  await tickWorker();
  assert.equal(alerts().length, 4);
  assert.match(alerts()[3].text, /oldest image job has been waiting/);
  checks++;
  await run("UPDATE outputs SET status='completed' WHERE id=?", outputId);
  offset += minute;
  ready = await expect("health/ready", 200);
  assert.equal(alerts().length, 5);
  assert.match(alerts()[4].text, /Resolved: no image job has been waiting/);
  checks++;

  // Site-wide AI budget: a warning at 80% and an exhaustion alert, once a day.
  const spend = async (cents) =>
    run(
      "INSERT INTO ai_spend (id,restaurant_id,kind,budget_day,reserved_cents,created_at) VALUES (?,?,'image',?,?,?)",
      id(),
      kitchen.rid,
      new Date(Date.now()).toISOString().slice(0, 10),
      cents,
      Date.now(),
    );
  await spend(8500);
  offset += minute;
  await tickWorker();
  ready = await expect("health/ready", 200, { headers: bearer });
  assert.equal(ready.checks.aiBudget.status, "warning");
  assert.equal(alerts().length, 6);
  assert.match(alerts()[5].text, /AI budget is 85% used/);
  offset += minute;
  await tickWorker();
  assert.equal(alerts().length, 6, "budget warning is sent once per day");
  checks++;
  await spend(1400);
  offset += minute;
  await tickWorker();
  ready = await expect("health/ready", 503);
  assert.deepEqual(ready.failed, ["aiBudget"]);
  assert.equal(alerts().length, 7);
  assert.match(alerts()[6].text, /AI budget is used up/);
  checks++;
  await run("DELETE FROM ai_spend");

  // reportError never throws, whatever it is handed or if delivery fails.
  offset += 10 * minute;
  const strange = [
    undefined,
    null,
    "plain string",
    42,
    {
      get message() {
        throw Error("getter");
      },
    },
    Object.defineProperty(Error("stack getter"), "stack", {
      get() {
        throw Error("stack");
      },
    }),
  ];
  const circular = { message: "circular" };
  circular.self = circular;
  strange.push(circular);
  webhookFails = true;
  for (const value of strange)
    assert.equal(await reportError(value, { kind: "client" }), undefined);
  await reportError(Error("fails to deliver"), {
    request: new Request("http://localhost/api/state"),
    detail: { cyclic: undefined },
  });
  await flushMonitoring();
  webhookFails = false;
  assert(logs.some((line) => line.includes('"type":"webhook_failed"')));
  checks++;

  // Errors are logged without secrets and posted once per fingerprint.
  const sentErrors = errors().length;
  const secretError = () =>
    Error(
      "Upstream rejected Bearer abc.def123 for owner@example.test password=hunter22 sk-live1234567890",
    );
  await reportError(secretError(), {
    route: "/api/staff/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefg/upload",
    method: "POST",
    status: 500,
  });
  await reportError(secretError(), { status: 500 });
  await flushMonitoring();
  const secretLog = logs.filter((line) => line.includes("Upstream rejected"));
  assert(secretLog.length >= 2);
  for (const line of secretLog) {
    assert(!/abc\.def123|owner@example|hunter22|sk-live/.test(line), line);
    assert.equal(JSON.parse(line).type, "server_error");
  }
  assert(secretLog[0].includes("/api/staff/:token/upload"));
  assert.equal(errors().length, sentErrors + 1);
  assert.match(errors().at(-1).text, /Server error \(500\)/);
  checks++;

  // A burst of server errors raises one alert.
  const before = alerts().length;
  for (let n = 0; n < 12; n++)
    await reportError(Error("Feature is not connected yet"), { status: 503 });
  await flushMonitoring();
  assert.equal(alerts().length, before, "503 gates do not count as a burst");
  for (let n = 0; n < 12; n++)
    await reportError(Error(`Burst failure ${"x".repeat(n)}`), {
      status: 500,
    });
  await flushMonitoring();
  const burst = alerts()
    .slice(before)
    .filter((p) => /server errors in 5 minutes/.test(p.text));
  assert.equal(burst.length, 1);
  checks++;

  // Unexpected failures through the router are reported; 4xx AppErrors are not.
  const serverLines = () =>
    logs.filter((line) => line.includes('"type":"server_error"')).length;
  let lines = serverLines();
  await expect("dishes", 401, { body: {} });
  await expect("auth/login", 401, {
    body: { email: "nobody@example.test", password: "incorrect password" },
  });
  assert.equal(serverLines(), lines);
  const database = env.DB;
  delete env.DB;
  try {
    await expect("state", 503, { cookie: kitchen.cookie });
    assert.equal(serverLines(), lines + 1);
    const failure = JSON.parse(
      logs.filter((line) => line.includes('"type":"server_error"')).at(-1),
    );
    assert.equal(failure.status, 503);
    assert.equal(failure.route, "/api/state");
    assert.equal(failure.method, "GET");
    assert(!JSON.stringify(failure).includes("session-kitchen"));
    ready = await expect("health/ready", 503, { headers: bearer });
    assert.equal(ready.checks.database.ok, false);
    assert.equal(ready.checks.storage.ok, true);
    assert(ready.failed.includes("database"));
  } finally {
    env.DB = database;
  }
  checks++;

  // Browser error reports: validated, bounded, same-origin and rate limited.
  // (The odd values above used this hour's share of browser reports.)
  offset += 61 * minute;
  const report = {
    message: "Cannot read properties of undefined (reading 'name')",
    stack:
      "TypeError: Cannot read properties of undefined (reading 'name')\n    at Workspace (http://localhost/assets/workspace.js?v=1:10:5)",
    source: "http://localhost/assets/workspace.js?v=1",
    line: 10,
    column: 5,
    url: "http://localhost/workspace?invite=very-secret-invite#top",
    kind: "error",
  };
  const ip = (n) => ({
    "cf-connecting-ip": `198.51.100.${n}`,
    origin: "http://localhost",
  });
  lines = logs.length;
  const sentClient = errors().length;
  await expect("client-errors", 202, {
    body: report,
    headers: ip(1),
    cookie: kitchen.cookie,
  });
  await expect("client-errors", 202, { body: report, headers: ip(1) });
  const clientLog = logs
    .slice(lines)
    .filter((line) => line.includes('"type":"client_error"'));
  assert.equal(clientLog.length, 2);
  const logged = JSON.parse(clientLog[0]);
  assert.equal(logged.route, "/workspace");
  assert.equal(logged.restaurantId, kitchen.rid);
  assert.equal(logged.detail.source, "/assets/workspace.js");
  assert(!/very-secret-invite|session-kitchen/.test(clientLog.join("\n")));
  assert.equal(errors().length, sentClient + 1, "client errors are deduped");
  assert.match(errors().at(-1).text, /Browser error on \/workspace/);
  checks++;
  await expect("client-errors", 400, { body: {}, headers: ip(2) });
  await expect("client-errors", 400, {
    body: { ...report, line: "ten" },
    headers: ip(2),
  });
  await expect("client-errors", 400, { body: "not json", headers: ip(2) });
  await expect("client-errors", 413, {
    body: { ...report, stack: "x".repeat(9000) },
    headers: ip(2),
  });
  await expect("client-errors", 403, {
    body: report,
    headers: { ...ip(2), origin: "https://elsewhere.example" },
  });
  // Scripts and other sites cannot post reports: the browser must say the
  // request came from this site.
  await expect("client-errors", 403, {
    body: report,
    headers: { "cf-connecting-ip": "198.51.100.2" },
  });
  await expect("client-errors", 202, {
    body: report,
    headers: {
      "cf-connecting-ip": "198.51.100.2",
      "sec-fetch-site": "same-origin",
    },
  });
  for (let n = 0; n < 20; n++)
    await expect("client-errors", 202, { body: report, headers: ip(3) });
  await expect("client-errors", 429, { body: report, headers: ip(3) });
  checks++;

  // Fake reports are forwarded as inert text and only up to their own
  // hourly share, so a real server error still gets through afterwards.
  offset += 61 * minute;
  const beforeFakes = errors().length;
  for (let n = 0; n < 30; n++)
    await expect("client-errors", 202, {
      body: {
        message: `@everyone <!channel> <@U123> Payouts failing ${String.fromCharCode(97 + (n % 26), 97 + Math.floor(n / 26))} — re-authenticate: <https://evil.example/login|Open billing> or [Open billing](https://evil.example/login) www.evil.example`,
        url: "/admin",
      },
      headers: {
        "cf-connecting-ip": `2001:db8:${n}::1`,
        origin: "http://localhost",
      },
    });
  const fakes = errors().slice(beforeFakes);
  assert.equal(fakes.length, 5);
  for (const fake of fakes) {
    for (const field of [fake.text, fake.content]) {
      assert(!/@everyone|https?:\/\/|www\./.test(field), field);
      assert.match(field, /@\u200beveryone/);
    }
    assert(!/[<>]/.test(fake.text.split("] ")[1]), fake.text);
    assert.match(fake.text, /&lt;!channel&gt; &lt;@U123&gt;/);
    assert(!/<[@!#]/.test(fake.content), fake.content);
  }
  await reportError(Error("Real failure after the fakes"), { status: 500 });
  await flushMonitoring();
  assert.match(errors().at(-1).text, /Real failure after the fakes/);
  checks++;

  assert.equal(
    (
      await one(
        "SELECT COUNT(*) AS n FROM app_settings WHERE key LIKE 'monitor:%'",
      )
    ).n > 0,
    true,
  );
  console.log(
    `PASS: ${checks} monitoring checks: liveness/readiness, coarse vs authorized detail, stale worker and queue alerts with dedupe and recovery, daily AI budget alerts, error burst, reportError safety and redaction, API error reporting, and client error validation, same-origin reports, limits, dedupe, their own webhook share and inert chat text. Webhooks are fixtures.`,
  );
} finally {
  console.error = originalError;
  console.warn = originalWarn;
  rmSync(root, { recursive: true, force: true });
}
