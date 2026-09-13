// Run continuously on a trusted server, or invoke --once from a scheduler.
const origin = process.env.APP_ORIGIN || "http://127.0.0.1:5173";
const secret = process.env.JOB_RUNNER_SECRET;
if (!secret) throw Error("Set JOB_RUNNER_SECRET on the app and this runner.");
const once = process.argv.includes("--once");
do {
  try {
    const r = await fetch(new URL("/api/internal/tick", origin), {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw Error(`Runner returned ${r.status}`);
  } catch (e) {
    console.error(new Date().toISOString(), e.message);
    if (once) process.exitCode = 1;
  }
  if (!once) await new Promise((r) => setTimeout(r, 5000));
} while (!once);
