import assert from "node:assert/strict";
import { deferredResource } from "../lib/deferred-resource.ts";

let calls = 0;
let complete;
const workspaceModule = { default: () => "workspace" };
const resource = deferredResource(() => {
  calls++;
  return new Promise((resolve) => {
    complete = resolve;
  });
});
assert.equal(calls, 0, "Unvisited workspaces do not load");
assert.equal(resource.peek(), undefined);
const first = resource.load();
const repeated = resource.load();
assert.equal(first, repeated, "Rapid navigation shares an in-flight load");
await Promise.resolve();
assert.equal(calls, 1);
complete(workspaceModule);
assert.equal(await first, workspaceModule);
assert.equal(resource.peek(), workspaceModule);
assert.equal(
  await resource.load(),
  workspaceModule,
  "Revisiting uses the already loaded module",
);
assert.equal(calls, 1);

let attempts = 0;
const retry = deferredResource(() => {
  if (++attempts === 1) throw Error("Network unavailable");
  return Promise.resolve(workspaceModule);
});
const failure = retry.load();
assert.equal(failure, retry.load());
await assert.rejects(failure, /Network unavailable/);
assert.equal(retry.peek(), undefined, "Failure is not a loaded workspace");
assert.equal(attempts, 1, "No automatic request loop after failure");
assert.equal(await retry.load(), workspaceModule, "Explicit retry can recover");
assert.equal(attempts, 2);
assert.equal(
  resource.peek(),
  workspaceModule,
  "Another workspace's failure does not evict a ready module",
);
console.log(
  "Deferred workspaces: on-demand loading, concurrent reuse, cached revisits and failure/retry isolation passed.",
);
