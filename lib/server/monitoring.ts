// Readiness checks, operational alerts and error reporting.
// Alerts go to optional Slack/Discord-compatible webhooks. Nothing here may
// block or fail a user request: delivery runs in the background and every
// failure is swallowed after a structured log line.
import * as workers from "cloudflare:workers";
import { z } from "zod";
import {
  AppError,
  bucket,
  config,
  digest,
  limit,
  now,
  one,
  response,
  run,
  viewer,
} from "./core";
import { aiControls, limitedBytes, publicLimit } from "./safeguards";

type Json = string | number | boolean | null;
export type ErrorContext = {
  kind?: "server" | "job" | "client";
  request?: Request;
  route?: string;
  method?: string;
  status?: number;
  restaurantId?: string | null;
  detail?: Record<string, Json | undefined>;
};

const positive = (key: string, fallback: number) => {
  const value = Number(config(key, String(fallback)));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
export function monitoringSettings() {
  return {
    workerStaleMs: positive("WORKER_STALE_AFTER_SECONDS", 180) * 1000,
    queueAlertMs: positive("QUEUE_ALERT_AFTER_MINUTES", 10) * 60000,
    repeatMs: positive("ALERT_REPEAT_MINUTES", 60) * 60000,
    budgetWarnPercent: Math.min(100, positive("AI_BUDGET_ALERT_PERCENT", 80)),
    errorBurstCount: Math.max(2, Math.round(positive("ERROR_BURST_COUNT", 10))),
    errorBurstMinutes: positive("ERROR_BURST_MINUTES", 5),
  };
}
function webhook(kind: "alert" | "error") {
  const raw =
    kind === "error"
      ? config("ERROR_WEBHOOK_URL") || config("ALERT_WEBHOOK_URL")
      : config("ALERT_WEBHOOK_URL");
  try {
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return url.protocol === "https:" || (url.protocol === "http:" && local)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export const monitoringConfigured = () => ({
  alerting: !!webhook("alert"),
  errorReporting: !!webhook("error"),
});

// Keep background work alive past the response on Workers; tests can flush it.
const pending = new Set<Promise<void>>();
export function background(task: Promise<unknown> | (() => Promise<unknown>)) {
  let promise: Promise<void>;
  try {
    promise = Promise.resolve(typeof task === "function" ? task() : task).then(
      () => {},
      (error) => log("warn", "monitoring_failed", { message: text(error) }),
    );
  } catch (error) {
    log("warn", "monitoring_failed", { message: text(error) });
    promise = Promise.resolve();
  }
  pending.add(promise);
  void promise.finally(() => pending.delete(promise));
  try {
    const waitUntil = (workers as { waitUntil?: unknown }).waitUntil;
    if (typeof waitUntil === "function") waitUntil(promise);
  } catch {
    // Outside a request context the promise simply runs to completion.
  }
  return promise;
}
// Let request work continue if the client disconnects. Workers extend a request
// only for a short grace period, so long work may still be cut off.
export function keepAlive<T>(work: Promise<T>) {
  try {
    const waitUntil = (workers as { waitUntil?: unknown }).waitUntil;
    if (typeof waitUntil === "function")
      waitUntil(
        work.then(
          () => {},
          () => {},
        ),
      );
  } catch {
    // Outside a request context the work simply runs to completion.
  }
  return work;
}
export async function flushMonitoring() {
  while (pending.size) await Promise.all([...pending]);
}

function log(level: "error" | "warn", type: string, fields: object) {
  try {
    (level === "error" ? console.error : console.warn)(
      JSON.stringify({
        level,
        type,
        time: new Date(now()).toISOString(),
        ...fields,
      }),
    );
  } catch {
    // Logging must never throw.
  }
}
function text(value: unknown): string {
  try {
    if (value instanceof Error) return value.message;
    if (value && typeof value === "object" && "message" in value)
      return String((value as { message: unknown }).message);
    return String(value);
  } catch {
    return "Unknown error";
  }
}
// Strip credentials and personal details that may appear inside messages.
export function redact(value: string, max = 1000) {
  return value
    .replace(/Bearer\s+[\w.~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\bsk-[\w-]{8,}/g, "[redacted-key]")
    .replace(
      /\b(menu_material_session|password|passwd|token|secret|invite|api[_-]?key|authorization)(["']?\s*[=:]\s*["']?)[^\s&;,"']+/gi,
      "$1$2[redacted]",
    )
    .replace(/[\w.%+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .slice(0, max);
}
// Route paths can carry one-use tokens (staff links, invitations).
export function safeRoute(path = "") {
  const [pathname] = path.split(/[?#]/);
  return pathname
    .split("/")
    .map((part) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        part,
      )
        ? ":id"
        : /^[\w-]{20,}$/.test(part)
          ? ":token"
          : part,
    )
    .join("/")
    .slice(0, 200);
}
function topFrame(stack: string) {
  const frame = stack
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^at\s|@\S+:\d+/.test(line));
  return (frame || "")
    .replace(/https?:\/\/[^/\s)]+/g, "")
    .replace(/\?[^:\s)]*/g, "")
    .slice(0, 300);
}
const stackOf = (error: unknown) => {
  try {
    const stack =
      error && typeof error === "object" && "stack" in error
        ? (error as { stack: unknown }).stack
        : "";
    return typeof stack === "string" ? stack : "";
  } catch {
    return "";
  }
};

export async function reportError(error: unknown, context: ErrorContext = {}) {
  try {
    const kind = context.kind || "server";
    const message = redact(text(error)) || "Unknown error";
    const stack = redact(
      stackOf(error).split("\n").slice(0, 12).join("\n"),
      3000,
    );
    const frame = topFrame(stack);
    const fingerprint = digest(
      `${kind}|${message.replace(/\d+/g, "#")}|${frame.replace(/:\d+(:\d+)?\)?$/, "")}`,
    ).slice(0, 16);
    let restaurantId = context.restaurantId ?? null;
    let route = context.route;
    // A browser report's own POST says nothing about the page that failed.
    const method =
      context.method ||
      (kind === "client" ? undefined : context.request?.method);
    if (context.request) {
      route ??= new URL(context.request.url).pathname;
      if (!restaurantId)
        try {
          const user = await viewer(context.request);
          if (user)
            restaurantId =
              (await one("SELECT id FROM restaurants WHERE user_id=?", user.id))
                ?.id ?? null;
        } catch {
          // The database may be the reason this request failed.
        }
    }
    const detail = Object.fromEntries(
      Object.entries(context.detail || {})
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => [
          key,
          typeof value === "string" ? redact(value, 300) : value,
        ]),
    );
    const record = {
      kind,
      fingerprint,
      message,
      stack: stack || undefined,
      route: route ? safeRoute(route) : undefined,
      method,
      status: context.status,
      restaurantId: restaurantId || undefined,
      ...(Object.keys(detail).length ? { detail } : {}),
    };
    log("error", `${kind}_error`, record);
    background(deliverError(record, frame));
  } catch {
    // Reporting is best effort and must never mask the original failure.
  }
}
// Fixed-window counters in rate_limits (expired rows are already pruned by
// housekeeping). If the database is down, count per isolate instead.
const memory = new Map<string, { count: number; until: number }>();
function memoryCount(key: string, seconds: number) {
  const entry = memory.get(key);
  if (entry && entry.until > now()) return ++entry.count;
  memory.set(key, { count: 1, until: now() + seconds * 1000 });
  if (memory.size > 200) memory.delete(memory.keys().next().value!);
  return 1;
}
async function allowed(key: string, max: number, seconds: number) {
  try {
    await limit(key, max, seconds);
    return true;
  } catch (error) {
    if (error instanceof AppError && error.status === 429) return false;
    return memoryCount(key, seconds) <= max;
  }
}
async function deliverError(
  record: {
    kind: string;
    fingerprint: string;
    message: string;
    route?: string;
    method?: string;
    status?: number;
  },
  frame: string,
) {
  const settings = monitoringSettings();
  // 503s are deliberate "not connected" gates or outages readiness already
  // reports, so repeated clicks on a disabled feature cannot fake a burst.
  // A 4xx, such as the image provider refusing a request, is no server error.
  const refused =
    !!record.status && record.status >= 400 && record.status < 500;
  if (record.kind !== "client" && record.status !== 503 && !refused) {
    const withinBurst = await allowed(
      "monitor:server-errors",
      settings.errorBurstCount - 1,
      settings.errorBurstMinutes * 60,
    );
    if (!withinBurst)
      await raiseAlert(
        "error-burst",
        `At least ${settings.errorBurstCount} server errors in ${settings.errorBurstMinutes} minutes. Latest: “${record.message}”. Search the logs for "server_error" and "job_error".`,
      );
  }
  if (!webhook("error")) return;
  const repeatSeconds = settings.repeatMs / 1000;
  if (!(await allowed(`monitor:error:${record.fingerprint}`, 1, repeatSeconds)))
    return;
  // A hard ceiling across all fingerprints keeps a storm from flooding the channel.
  if (!(await allowed("monitor:error-webhook", 30, 3600))) return;
  const source =
    record.kind === "client"
      ? "Browser"
      : record.kind === "job"
        ? "Background job"
        : "Server";
  const where = record.route
    ? ` on ${[record.method, record.route].filter(Boolean).join(" ")}`
    : "";
  await send(
    "error",
    [
      `${source} error${record.status ? ` (${record.status})` : ""}${where}: ${record.message}`,
      frame,
      `Fingerprint ${record.fingerprint}. Repeats are muted for ${Math.round(repeatSeconds / 60)} min.`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}
async function send(kind: "alert" | "error", message: string) {
  const url = webhook(kind);
  if (!url) return false;
  let host = "";
  try {
    host = new URL(config("APP_ORIGIN")).host;
  } catch {}
  const body = `[Menu Material${host ? ` · ${host}` : ""}] ${message}`.slice(
    0,
    1900,
  );
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `text` for Slack-compatible hooks, `content` for Discord.
      body: JSON.stringify({ text: body, content: body }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) log("warn", "webhook_failed", { kind, status: res.status });
    return res.ok;
  } catch (error) {
    log("warn", "webhook_failed", { kind, message: redact(text(error), 200) });
    return false;
  }
}

// Condition alerts: one row per condition in app_settings, holding the time it
// last notified, or "retry:<time>" after a failed delivery. A conditional
// upsert lets exactly one caller claim each send.
const alertKey = (condition: string) => `monitor:alert:${condition}`;
async function raiseAlert(
  condition: string,
  message: string,
  notBefore = now() - monitoringSettings().repeatMs,
) {
  let stored = true;
  try {
    const claim = await run(
      "INSERT INTO app_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CASE WHEN app_settings.value LIKE 'retry:%' THEN CAST(substr(app_settings.value,7) AS INTEGER)<=? ELSE CAST(app_settings.value AS INTEGER)<? END",
      alertKey(condition),
      String(now()),
      now(),
      notBefore,
    );
    if (!claim.meta.changes) return false;
  } catch {
    // Without the database (e.g. an error burst caused by it), dedupe per isolate.
    stored = false;
    if (memoryCount(alertKey(condition), (now() - notBefore) / 1000) > 1)
      return false;
  }
  log("warn", "alert", { condition, message });
  if (webhook("alert") && !(await send("alert", message)) && stored)
    // Retry a failed delivery in about five minutes, rather than a full
    // window or, for once-a-day alerts, the next day.
    await run(
      "UPDATE app_settings SET value=? WHERE key=?",
      `retry:${now() + 5 * 60000}`,
      alertKey(condition),
    ).catch(() => {});
  return true;
}
async function resolveAlert(condition: string, message: string) {
  const cleared = await run(
    "DELETE FROM app_settings WHERE key=?",
    alertKey(condition),
  );
  if (!cleared.meta.changes) return false;
  log("warn", "alert_resolved", { condition, message });
  await send("alert", `Resolved: ${message}`);
  return true;
}

const budgetDay = () => new Date(now()).toISOString().slice(0, 10);
const startOfDay = () => Date.parse(`${budgetDay()}T00:00:00.000Z`);
const seconds = (ms: number | null) =>
  ms === null ? null : Math.round(ms / 1000);
function duration(ms: number) {
  const minutes = Math.round(ms / 60000);
  return minutes < 1
    ? `${Math.max(1, Math.round(ms / 1000))} s`
    : minutes < 120
      ? `${minutes} min`
      : `${Math.round(minutes / 60)} h`;
}
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export async function workerStatus() {
  const { workerStaleMs } = monitoringSettings();
  const configured = !!config("JOB_RUNNER_SECRET");
  const lastSeen = Number(
    (await one("SELECT value FROM app_settings WHERE key='worker-heartbeat'"))
      ?.value || 0,
  );
  const ageMs = lastSeen ? Math.max(0, now() - lastSeen) : null;
  return {
    configured,
    lastSeen,
    ageMs,
    staleAfterMs: workerStaleMs,
    healthy: configured && ageMs !== null && ageMs < workerStaleMs,
  };
}
async function queueStatus() {
  const rows = await one(
    `SELECT SUM(CASE WHEN o.status='queued' THEN 1 ELSE 0 END) AS queued,
       SUM(CASE WHEN o.status!='queued' THEN 1 ELSE 0 END) AS in_progress,
       MIN(CASE WHEN o.status='queued' THEN o.created_at END) AS oldest_queued,
       MIN(CASE WHEN o.status!='queued' THEN o.created_at END) AS oldest_in_progress
     FROM outputs o JOIN restaurants r ON r.id=o.restaurant_id
     WHERE o.status IN ('queued','submitting','processing','uncertain') AND r.paused=0`,
  );
  const oldest = Math.min(
    Number(rows?.oldest_queued) || Infinity,
    Number(rows?.oldest_in_progress) || Infinity,
  );
  return {
    queued: Number(rows?.queued || 0),
    inProgress: Number(rows?.in_progress || 0),
    oldestQueuedMs: rows?.oldest_queued
      ? Math.max(0, now() - Number(rows.oldest_queued))
      : null,
    oldestInProgressMs: rows?.oldest_in_progress
      ? Math.max(0, now() - Number(rows.oldest_in_progress))
      : null,
    oldestMs: Number.isFinite(oldest) ? Math.max(0, now() - oldest) : null,
  };
}
async function budgetStatus() {
  const { budgetWarnPercent } = monitoringSettings();
  const controls = await aiControls();
  const spentCents = Number(
    (
      await one(
        "SELECT COALESCE(SUM(reserved_cents),0) AS cents FROM ai_spend WHERE budget_day=? AND status!='rejected'",
        budgetDay(),
      )
    )?.cents || 0,
  );
  const budgetCents = Math.max(0, Number(controls.dailyBudgetCents) || 0);
  const imageCents = Math.max(
    1,
    Math.round(Number(config("AI_IMAGE_RESERVE_USD", "2")) * 100) || 200,
  );
  const percent = budgetCents
    ? Math.round((spentCents / budgetCents) * 100)
    : 100;
  const status = controls.paused
    ? "paused"
    : spentCents + imageCents > budgetCents
      ? "exhausted"
      : percent >= budgetWarnPercent
        ? "warning"
        : "ok";
  return {
    status,
    paused: !!controls.paused,
    spentCents,
    budgetCents,
    percent,
    warnAtPercent: budgetWarnPercent,
  };
}
async function probe(task: () => Promise<unknown>) {
  const started = now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      task(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error("Timed out after 5 s")), 5000);
      }),
    ]);
    return { ok: true, latencyMs: now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: now() - started,
      error: redact(text(error), 200),
    };
  } finally {
    clearTimeout(timer);
  }
}

export type Readiness = Awaited<ReturnType<typeof readiness>>;
export async function readiness() {
  const settings = monitoringSettings();
  const database = await probe(() => one("SELECT 1 AS ok"));
  // A missing key is a cheap round trip that proves the bucket answers.
  const storage = await probe(() => bucket().head("health/readiness-probe"));
  const unavailable = { ok: false, error: "Database unavailable." };
  let worker, queue, aiBudget;
  try {
    const status = await workerStatus();
    worker = {
      ok: status.healthy,
      configured: status.configured,
      lastSeen: status.lastSeen || null,
      ageSeconds: seconds(status.ageMs),
      staleAfterSeconds: seconds(status.staleAfterMs),
    };
  } catch (error) {
    worker = { ...unavailable, error: redact(text(error), 200) };
  }
  try {
    const status = await queueStatus();
    queue = {
      ok: status.oldestMs === null || status.oldestMs < settings.queueAlertMs,
      queued: status.queued,
      inProgress: status.inProgress,
      oldestQueuedSeconds: seconds(status.oldestQueuedMs),
      oldestInProgressSeconds: seconds(status.oldestInProgressMs),
      alertAfterSeconds: seconds(settings.queueAlertMs),
    };
  } catch (error) {
    queue = { ...unavailable, error: redact(text(error), 200) };
  }
  try {
    const status = await budgetStatus();
    aiBudget = { ok: status.status !== "exhausted", ...status };
  } catch (error) {
    aiBudget = { ...unavailable, error: redact(text(error), 200) };
  }
  const checks = { database, storage, worker, queue, aiBudget };
  const failed = Object.entries(checks)
    .filter(([, check]) => !check.ok)
    .map(([name]) => name);
  return {
    ok: failed.length === 0,
    failed,
    checkedAt: now(),
    checks,
    monitoring: monitoringConfigured(),
  };
}
export function coarseReadiness(report: Readiness) {
  return {
    ok: report.ok,
    failed: report.failed,
    checkedAt: report.checkedAt,
    checks: Object.fromEntries(
      Object.entries(report.checks).map(([name, check]) => [
        name,
        check.ok ? "ok" : "degraded",
      ]),
    ),
  };
}

// Evaluate alert conditions at most about once a minute across all callers:
// the worker's internal tick, open browsers' job ticks and readiness probes.
let evaluatedAt = 0;
export async function evaluateAlerts() {
  const interval = 55000;
  if (now() - evaluatedAt < interval) return false;
  const last = Number(
    (
      await one(
        "SELECT value FROM app_settings WHERE key='monitor:evaluated-at'",
      )
    )?.value || 0,
  );
  if (now() - last < interval) {
    evaluatedAt = last;
    return false;
  }
  const claim = await run(
    "INSERT INTO app_settings (key,value) VALUES ('monitor:evaluated-at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(app_settings.value AS INTEGER)<?",
    String(now()),
    now() - interval,
  );
  if (!claim.meta.changes) return false;
  evaluatedAt = now();
  const settings = monitoringSettings();
  const worker = await workerStatus();
  const queue = await queueStatus();
  const budget = await budgetStatus();
  const waiting = queue.queued + queue.inProgress;
  if (worker.healthy)
    await resolveAlert(
      "worker-stale",
      "the background worker is checking in again.",
    );
  else if (waiting)
    await raiseAlert(
      "worker-stale",
      `${
        !worker.configured
          ? "The background worker is not configured (JOB_RUNNER_SECRET is missing)"
          : worker.ageMs === null
            ? "The background worker has never checked in"
            : `The background worker has not checked in for ${duration(worker.ageMs)}`
      } while ${waiting} image ${waiting === 1 ? "job is" : "jobs are"} waiting. Start or restart \`npm run worker\` and check its logs.`,
    );
  if (queue.oldestMs !== null && queue.oldestMs >= settings.queueAlertMs) {
    if (!budget.paused)
      await raiseAlert(
        "queue-stale",
        `The oldest image job has been waiting ${duration(queue.oldestMs)} (${queue.queued} queued, ${queue.inProgress} in progress). Check the worker, OPENAI_API_KEY and the AI budget.`,
      );
  } else
    await resolveAlert(
      "queue-stale",
      `no image job has been waiting longer than ${duration(settings.queueAlertMs)}.`,
    );
  // Budget alerts repeat at most once per UTC budget day.
  if (budget.status === "exhausted")
    await raiseAlert(
      "ai-budget-exhausted",
      `Today's site-wide AI budget is used up (${dollars(budget.spentCents)} of ${dollars(budget.budgetCents)} reserved). New AI work waits until midnight UTC or until an administrator raises the budget.`,
      startOfDay(),
    );
  if (budget.status === "warning" || budget.status === "exhausted")
    await raiseAlert(
      "ai-budget-warning",
      `Today's site-wide AI budget is ${budget.percent}% used (${dollars(budget.spentCents)} of ${dollars(budget.budgetCents)} reserved).`,
      startOfDay(),
    );
  return true;
}
export function checkAlertsInBackground() {
  return background(evaluateAlerts);
}

async function detailAllowed(req: Request) {
  const secret = config("JOB_RUNNER_SECRET");
  const presented = req.headers.get("authorization") || "";
  if (secret && digest(presented) === digest(`Bearer ${secret}`)) return true;
  try {
    return (await viewer(req))?.role === "admin";
  } catch {
    return false;
  }
}
export async function readinessRoute(req: Request) {
  const detailed = await detailAllowed(req);
  if (!detailed)
    try {
      await publicLimit(req, "readiness", 120, 900);
    } catch (error) {
      // A database outage must still produce a readiness answer.
      if (error instanceof AppError && error.status === 429) throw error;
    }
  const report = await readiness();
  if (report.checks.database.ok) checkAlertsInBackground();
  return response(
    detailed ? report : coarseReadiness(report),
    report.ok ? 200 : 503,
  );
}

const clientErrorSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  stack: z.string().max(4000).optional(),
  source: z.string().max(500).optional(),
  line: z.number().int().min(0).max(10_000_000).optional(),
  column: z.number().int().min(0).max(10_000_000).optional(),
  url: z.string().max(1000).optional(),
  kind: z.enum(["error", "unhandledrejection", "boundary"]).default("error"),
  digest: z.string().max(100).optional(),
});
export async function clientErrorRoute(req: Request) {
  await publicLimit(req, "client-error", 20, 900);
  const bytes = await limitedBytes(req, 8 * 1024);
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppError(400, "Please send a valid error report.");
  }
  const input = clientErrorSchema.parse(raw);
  let page = "";
  try {
    page = new URL(input.url || "/", req.url).pathname;
  } catch {}
  await reportError(
    { message: input.message, stack: input.stack || "" },
    {
      kind: "client",
      request: req,
      route: page || "/",
      detail: {
        source: input.source?.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0],
        line: input.line,
        column: input.column,
        event: input.kind,
        digest: input.digest,
        userAgent: (req.headers.get("user-agent") || "").slice(0, 200),
      },
    },
  );
  return response({ ok: true }, 202);
}
