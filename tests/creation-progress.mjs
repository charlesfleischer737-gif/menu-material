import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-creation-progress-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
const { creationProgress, typicalRenderMs, typicalWait, TYPICAL_RENDER_MS } =
  await import("../lib/creation-progress.ts");
const { syncServerClock, serverNow } = await import("../lib/server-clock.ts");
const { withRenderEstimates } = await import("../lib/server/generation.ts");
const { run, id } = await import("../lib/server/core.ts");
let checks = 0;

// Waiting to be sent fills only the first sliver of the bar.
assert.deepEqual(creationProgress({ queuedFor: 0, sentFor: null }), {
  value: 0,
  stage: "Getting started",
  time: "",
});
assert.equal(creationProgress({ queuedFor: 1500, sentFor: null }).value, 0.025);
assert.equal(creationProgress({ queuedFor: 9000, sentFor: null }).value, 0.05);
assert.equal(
  creationProgress({ queuedFor: 11000, sentFor: null }).stage,
  "Waiting for the studio",
);
checks++;
// Once sent, the bar fills evenly to 90% at the typical time, slows after it,
// and never completes before the saved result arrives.
const at = (ms, typical = 40000) =>
  creationProgress({ queuedFor: ms + 1000, sentFor: ms, typical });
assert.equal(at(0).value, 0.05);
assert.equal(at(20000).value, 0.475);
assert.equal(at(40000).value, 0.9);
let previous = 0;
for (let ms = 0; ms <= 600000; ms += 1000) {
  const { value } = at(ms);
  assert(value > previous && value < 0.98, `Progress keeps moving at ${ms}`);
  previous = value;
}
assert(at(60000).value < 0.95, "Past the typical time the bar slows down");
checks++;
assert.equal(at(0).stage, "Creating your photo");
assert.equal(at(0, 45000).time, "About 45 seconds left");
assert.equal(at(1, 30000).time, "About 30 seconds left");
assert.equal(at(12000, 30000).time, "About 20 seconds left");
assert.equal(at(24000, 30000).time, "About 5 seconds left");
assert.equal(at(25500, 30000).time, "Almost done");
assert.equal(at(30000, 30000).time, "Taking longer than usual");
assert.equal(at(0, 70000).time, "About a minute left");
assert.equal(at(0, 150000).time, "About 3 minutes left");
assert.equal(typicalWait(45000), "about 45 seconds");
assert.equal(typicalWait(20050), "about 20 seconds");
assert.equal(typicalWait(61000), "about a minute");
assert.equal(typicalWait(119000), "about 2 minutes");
assert.equal(typicalWait(), "about 45 seconds");
// The expected time and the countdown agree when the image is sent.
for (const typical of [12000, 20050, 43000, 61000, 119000])
  assert.equal(at(0, typical).time, `A${typicalWait(typical).slice(1)} left`);
checks++;
// The estimate is the time three in four recent images beat, within limits.
assert.equal(typicalRenderMs([30000, 31000, 32000, 33000]), TYPICAL_RENDER_MS);
assert.equal(
  typicalRenderMs([9e9, 20000, 21000, 22000, 23000, 24000, 25000, 26000]),
  25000,
);
assert.equal(
  typicalRenderMs([20000, 21000, 22000, 23000, 24000, NaN, 0, -5]),
  23000,
);
assert.equal(typicalRenderMs([1, 2, 3, 4, 5]), 10000);
assert.equal(typicalRenderMs([4e5, 4e5, 4e5, 4e5, 4e5]), 150000);
// Until five images finish, the default follows the quality.
assert.equal(typicalRenderMs([20000], "medium"), 30000);
assert.equal(typicalRenderMs([], "low"), 30000);
assert.equal(typicalRenderMs([], "high"), TYPICAL_RENDER_MS);
assert.equal(typicalRenderMs([], "max"), 90000);
assert.equal(typicalRenderMs([], "auto"), TYPICAL_RENDER_MS);
checks++;
// Server times are read against the server's clock, not a wrong device clock.
syncServerClock(Date.now() + 120000);
assert(Math.abs(serverNow() - Date.now() - 120000) < 50);
for (const invalid of [undefined, null, "soon", NaN, Infinity])
  syncServerClock(invalid);
assert(
  Math.abs(serverNow() - Date.now() - 120000) < 50,
  "A response without a server time keeps the last known clock",
);
checks++;

// Estimates come from recent direct renders with the same settings.
const rendering = {
  model: "gpt-image-2.5-flare",
  quality: "high",
  size: "1536x1536",
};
const recent = (renderMs, overrides = {}, age = 60000) =>
  run(
    "INSERT INTO events (id,restaurant_id,kind,entity_id,details,created_at) VALUES (?,NULL,'image_completed',?,?,?)",
    id(),
    id(),
    JSON.stringify({ jobId: id(), renderMs, ...rendering, ...overrides }),
    Date.now() - age,
  );
const job = (status = "queued", details = { rendering }) => ({
  id: id(),
  status,
  details: JSON.stringify(details),
});
const estimate = async (value) =>
  (await withRenderEstimates([value]))[0].estimate_ms;
assert.equal(await estimate(job()), TYPICAL_RENDER_MS, "No history yet");
assert.equal(
  await estimate(
    job("queued", { rendering: { ...rendering, quality: "medium" } }),
  ),
  30000,
  "Without history, medium quality expects a quicker image",
);
for (const ms of [30000, 32000, 34000, 36000]) await recent(ms);
for (const ms of [20000, 21000, 22000]) await recent(ms, { size: "1024x1536" });
// Four matching sizes are too few alone, so all seven for this quality count.
assert.equal(await estimate(job()), 34000);
checks++;
await recent(38000);
assert.equal(await estimate(job()), 36000, "Five matching sizes win");
assert.equal(
  await estimate(
    job("processing", { rendering: { ...rendering, size: "1024x1536" } }),
  ),
  34000,
  "A size without five renders uses every size",
);
checks++;
// Other qualities, earlier background renders (no renderMs) and old renders
// do not count.
for (const ms of [5000, 5000, 5000, 5000, 5000]) {
  await recent(ms, { quality: "medium" });
  await recent(ms, { renderMs: undefined, waitMs: ms });
  await recent(ms, {}, 15 * 86400000);
}
assert.equal(await estimate(job()), 36000);
assert.equal(
  await estimate(
    job("queued", { rendering: { ...rendering, quality: "medium" } }),
  ),
  10000,
);
checks++;
const [finished, legacy] = await withRenderEstimates([
  job("completed"),
  job("queued", {}),
]);
assert.equal(finished.estimate_ms, undefined, "Only unfinished jobs need one");
assert.equal(legacy.estimate_ms, TYPICAL_RENDER_MS);
checks++;
rmSync(root, { recursive: true, force: true });
console.log(
  `Creation progress: ${checks} checks passed (bar shape, labels, estimates and server clock).`,
);
