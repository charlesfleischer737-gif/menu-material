// A dedicated, browser-independent process. No OpenAI credential is needed here.
import { writeFile, readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { apnsSettings, createApnsClient } from "./apns.mjs";
const heartbeat =
  process.env.RUNNER_HEARTBEAT_FILE || "/tmp/menu-material-runner-heartbeat";
if (process.argv.includes("--health")) {
  const last = Number(await readFile(heartbeat, "utf8").catch(() => "0"));
  process.exit(Date.now() - last < 120000 ? 0 : 1);
}
const origin = new URL(process.env.APP_ORIGIN || "http://127.0.0.1:5173");
if (
  origin.protocol !== "https:" &&
  !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
)
  throw Error("Use HTTPS for a remote job runner destination.");
const secret = process.env.JOB_RUNNER_SECRET;
if (!secret) throw Error("Set JOB_RUNNER_SECRET on the app and this runner.");
const once = process.argv.includes("--once");
// Run by a scheduler once a minute, --once keeps checking every two seconds
// for most of that minute, then lets its image calls finish before it exits.
const onceUntil =
  Date.now() + (Number(process.env.RUNNER_ONCE_SECONDS) || 55) * 1000;
const shutdown = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    // The first signal stops new checks and lets running image calls finish;
    // a second one exits at once.
    if (shutdown.signal.aborted) process.exit(1);
    shutdown.abort();
  });
// A check that starts an image lasts its whole render, so checks overlap and a
// long render never delays the next one. The app's claims keep overlap safe.
// There is always room for more checks than the six images the site renders
// at once, so a full queue never waits on idle capacity.
const maxRunning = 8;
let failures = 0,
  running = 0;
async function check() {
  running++;
  try {
    const response = await fetch(new URL("/api/internal/tick", origin.origin), {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      // Longer than the app's image call timeout, so no render is abandoned.
      signal: AbortSignal.timeout(240000),
    });
    if (!response.ok) throw Error(`Runner returned HTTP ${response.status}`);
    const result = await response.json();
    if (!result.ok) throw Error("Runner did not acknowledge the check.");
    await writeFile(heartbeat, String(Date.now()), { mode: 0o600 });
    if (failures)
      console.info(
        new Date().toISOString(),
        "Background processing recovered.",
      );
    failures = 0;
  } catch (error) {
    failures++;
    console.error(
      new Date().toISOString(),
      "Background check failed:",
      error.message,
    );
    if (once) process.exitCode = 1;
  } finally {
    running--;
  }
}
// The iPhone app's notifications, when APNS_KEY_ID, APNS_TEAM_ID (or
// APPLE_TEAM_ID) and APNS_PRIVATE_KEY are set: claimed from the site, sent to
// Apple, and acknowledged so delivered ones aren't sent again.
const apnsKey = apnsSettings();
const apns = apnsKey ? createApnsClient(apnsKey) : null;
let delivering = false;
async function internal(path, payload) {
  const response = await fetch(new URL(path, origin.origin), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}
async function deliver() {
  if (!apns || delivering) return;
  delivering = true;
  try {
    const { messages } = await internal("/api/internal/push/claim");
    if (messages?.length) {
      const results = await Promise.all(messages.map((m) => apns.send(m)));
      await internal("/api/internal/push/ack", { results });
    }
  } catch (error) {
    console.error(
      new Date().toISOString(),
      "Notification delivery failed:",
      error.message,
    );
  } finally {
    delivering = false;
  }
}
while (!shutdown.signal.aborted && (!once || Date.now() < onceUntil)) {
  if (running < maxRunning) void check();
  void deliver();
  await delay(
    Math.min(
      60000,
      2000 * 2 ** Math.min(failures, 5),
      once ? Math.max(0, onceUntil - Date.now()) : Infinity,
    ),
    undefined,
    { signal: shutdown.signal },
  ).catch(() => {});
}
apns?.close();
