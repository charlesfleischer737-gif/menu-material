import assert from "node:assert/strict";
import { createMenuProofQueue } from "../lib/menu-proof-queue.ts";
const tick = () => new Promise((resolve) => setImmediate(resolve));
const started = [];
let active = 0,
  peak = 0;
const prepare = createMenuProofQueue(
  (menu, signal) => {
    active++;
    peak = Math.max(peak, active);
    return new Promise((resolve, reject) => {
      const finish = (result, error) => {
        active--;
        signal.removeEventListener("abort", abort);
        error ? reject(error) : resolve(result);
      };
      const abort = () => finish(null, signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      started.push({
        menu,
        signal,
        succeed: () => finish({ signature: JSON.stringify(menu) }),
        fail: () => finish(null, Error("retryable failure")),
      });
    });
  },
  2,
  2,
);
const one = new AbortController(),
  two = new AbortController();
const first = prepare({ name: "shared" }, { signal: one.signal });
const second = prepare({ name: "shared" }, { signal: two.signal });
await tick();
assert.equal(started.length, 1, "two consumers share one composition");
one.abort();
await assert.rejects(first, { name: "AbortError" });
assert.equal(
  started[0].signal.aborted,
  false,
  "one thumbnail cannot cancel another consumer's work",
);
started[0].succeed();
const shared = await second;
await tick();
assert.equal(
  await prepare({ name: "shared" }),
  shared,
  "unchanged content reuses the prepared PDF",
);

const obsolete = new AbortController();
const stale = prepare({ name: "same key" }, { signal: obsolete.signal });
await tick();
obsolete.abort();
const fresh = prepare({ name: "same key" });
await assert.rejects(stale, { name: "AbortError" });
await tick();
assert(
  started[1].signal.aborted,
  "the last departing consumer cancels active work",
);
assert.equal(started.length, 3, "a cancelled key can immediately be retried");
started[2].succeed();
await fresh;
await tick();

const a = prepare({ name: "active A" });
const b = prepare({ name: "active B" });
const queuedCancel = new AbortController();
const removed = prepare(
  { name: "unused thumbnail" },
  { signal: queuedCancel.signal, priority: 0 },
);
const thumbnail = prepare({ name: "thumbnail" }, { priority: 0 });
const full = prepare({ name: "full page" }, { priority: 1 });
await tick();
assert.equal(started.length, 5);
queuedCancel.abort();
await assert.rejects(removed, { name: "AbortError" });
started[3].succeed();
await a;
await tick();
assert.equal(
  started[5].menu.name,
  "full page",
  "full proofs precede waiting thumbnails",
);
started[4].succeed();
await b;
await tick();
assert.equal(started[6].menu.name, "thumbnail");
started[5].succeed();
started[6].succeed();
await Promise.all([full, thumbnail]);
await tick();
assert.equal(peak, 2, "the design collection cannot start unbounded PDF work");
assert(!started.some((j) => j.menu.name === "unused thumbnail"));

const failed = prepare({ name: "retry" });
await tick();
started.at(-1).fail();
await assert.rejects(failed, /retryable/);
await tick();
const retry = prepare({ name: "retry" });
await tick();
started.at(-1).succeed();
await retry;
await tick();
const beforeEvicted = started.length;
const evicted = prepare({ name: "shared" });
await tick();
assert.equal(
  started.length,
  beforeEvicted + 1,
  "prepared results have a bounded cache",
);
started.at(-1).succeed();
await evicted;
const early = new AbortController();
early.abort();
await assert.rejects(
  prepare({ name: "never start" }, { signal: early.signal }),
  { name: "AbortError" },
);
console.log(
  "Menu proof queue: shared work, bounded concurrency/cache, priority, cancellation, fresh retries, and failure recovery passed.",
);
