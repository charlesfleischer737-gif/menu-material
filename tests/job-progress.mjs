import assert from "node:assert/strict";
import { watchJobs } from "../lib/job-progress.ts";

let every, fire, unscheduled;
let advances = 0,
  statusCalls = 0,
  reloads = 0,
  pageHidden = false,
  workerIsHealthy = false,
  failReload = false,
  gate = Promise.resolve();
let progress = { jobs: [{ id: "one", status: "queued" }] };
const held = [];
const settle = async () => {
  for (let n = 0; n < 10; n++)
    await new Promise((resolve) => setImmediate(resolve));
};
// One interval, and the return of the oldest open advance request.
const step = async () => {
  fire();
  await settle();
};
const finish = async () => {
  held.shift()();
  await settle();
};
const stop = watchJobs({
  // An advance request stays open, like a render, until the test finishes it.
  advance: () => {
    advances++;
    return new Promise((resolve) => held.push(resolve));
  },
  // The status is read when requested and answered when the gate opens.
  status: () => {
    statusCalls++;
    const value = JSON.stringify(progress);
    return gate.then(() => JSON.parse(value));
  },
  reload: async () => {
    reloads++;
    if (failReload) throw Error("Offline");
  },
  hidden: () => pageHidden,
  workerHealthy: () => workerIsHealthy,
  healthEvery: 8000,
  schedule: (callback, ms) => {
    fire = callback;
    every = ms;
    return 7;
  },
  unschedule: (timer) => {
    unscheduled = timer;
  },
});
assert.equal(every, 2000, "Progress is checked every two seconds");

await step();
assert.equal(advances, 1);
assert.equal(statusCalls, 0, "Status is checked once the advance returns");
await step();
assert.equal(reloads, 1, "Progress shows while a render holds a request open");
await step();
assert.equal(advances, 1, "One advance request at a time");
assert.equal(statusCalls, 2);
assert.equal(reloads, 1, "An unchanged status reloads nothing");
progress = { jobs: [{ id: "one", status: "processing" }] };
await step();
assert.equal(reloads, 2);
progress = { jobs: [] };
await finish();
assert.equal(reloads, 3, "A result shows as soon as its request returns");

const before = statusCalls;
await step();
await finish();
await step();
await finish();
assert.equal(advances, 3);
assert.equal(statusCalls, before + 2, "One status check per interval");

let openGate;
gate = new Promise((resolve) => (openGate = resolve));
await step();
await step();
progress = { jobs: [{ id: "two", status: "queued" }] };
await finish();
openGate();
await settle();
gate = Promise.resolve();
assert.equal(reloads, 4, "A change during a running check is checked again");

progress = { jobs: [{ id: "two", status: "processing" }] };
failReload = true;
await step();
await step();
assert.equal(reloads, 5);
failReload = false;
await step();
assert.equal(reloads, 6, "A failed reload is retried at the next check");

// Without a worker, only an open page starts queued work, so a background tab
// keeps starting it every 8 seconds; nobody sees its status, so it checks none.
pageHidden = true;
const quiet = { advances, statusCalls };
await step();
assert.deepEqual(
  { advances, statusCalls },
  quiet,
  "A hidden page checks no status while a render holds a request open",
);
while (held.length) await finish();
const hiddenStart = { advances, statusCalls };
for (let n = 0; n < 3; n++) await step();
assert.deepEqual(
  { advances, statusCalls },
  hiddenStart,
  "A hidden tab starts work at a slower pace",
);
await step();
assert.equal(advances, hiddenStart.advances + 1, "…every 8 seconds");
await finish();
assert.equal(statusCalls, hiddenStart.statusCalls, "…and checks no status");
for (let n = 0; n < 3; n++) await step();
assert.equal(advances, hiddenStart.advances + 1);
await step();
assert.equal(advances, hiddenStart.advances + 2);
await finish();
pageHidden = false;
await step();
assert.equal(
  advances,
  hiddenStart.advances + 3,
  "A visible page starts work on every interval again",
);
await finish();

// A healthy worker starts and finishes images itself: the page only watches.
workerIsHealthy = true;
const watching = { advances, statusCalls, reloads };
await step();
await step();
assert.equal(advances, watching.advances, "No start requests with a worker");
assert.equal(statusCalls, watching.statusCalls + 2, "Status is still checked");
pageHidden = true;
await step();
assert.equal(statusCalls, watching.statusCalls + 2, "…while the page is seen");
pageHidden = false;
assert.equal(reloads, watching.reloads);
await step();
assert.equal(
  reloads,
  watching.reloads + 1,
  "A reload now and then keeps the worker's health current",
);
assert.equal(advances, watching.advances);
// A worker that stops checking in hands starting back to the page.
workerIsHealthy = false;
await step();
assert.equal(advances, watching.advances + 1);
await finish();

const stopped = { advances, statusCalls };
stop();
assert.equal(unscheduled, 7);
await step();
assert.deepEqual(
  { advances, statusCalls },
  stopped,
  "Stopping ends all checks",
);
console.log(
  "Job progress: one advance and one status check per interval, status-driven reloads, prompt results, mid-check changes, reload retries, slower starts from hidden tabs, worker-only starts and stopping passed.",
);
