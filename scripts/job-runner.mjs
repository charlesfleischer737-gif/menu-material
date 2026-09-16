// A dedicated, browser-independent process. No OpenAI credential is needed here.
import { writeFile, readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const heartbeat =
  process.env.RUNNER_HEARTBEAT_FILE || "/tmp/plateworthy-runner-heartbeat";
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
const shutdown = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => shutdown.abort());
let failures = 0;
do {
  try {
    const response = await fetch(new URL("/api/internal/tick", origin.origin), {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(65000)]),
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
    if (shutdown.signal.aborted) break;
    failures++;
    console.error(
      new Date().toISOString(),
      "Background check failed:",
      error.message,
    );
    if (once) process.exitCode = 1;
  }
  if (!once)
    await delay(Math.min(60000, 2000 * 2 ** Math.min(failures, 5)), undefined, {
      signal: shutdown.signal,
    }).catch(() => {});
} while (!once && !shutdown.signal.aborted);
