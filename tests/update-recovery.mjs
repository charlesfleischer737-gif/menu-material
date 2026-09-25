import assert from "node:assert/strict";
import { recoverFromUpdates } from "../lib/update-recovery.ts";

const target = new EventTarget();
const stored = new Map();
let reloads = 0,
  online = true,
  storageWorks = true,
  clock = 1_000_000;
const stop = recoverFromUpdates({
  target,
  online: () => online,
  // Session storage survives the reload, which is what stops a loop.
  storage: () => {
    if (!storageWorks) throw Error("Storage is blocked");
    return {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    };
  },
  reload: () => reloads++,
  now: () => clock,
});
const missingFile = () =>
  target.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));

missingFile();
assert.equal(reloads, 1, "A file missing after a deploy reloads the page");
clock += 30000;
missingFile();
assert.equal(reloads, 1, "Another failure within a minute keeps the error");
clock += 31000;
missingFile();
assert.equal(reloads, 2, "A later deploy recovers again");
clock += 120000;
online = false;
missingFile();
assert.equal(reloads, 2, "Offline, the page's connection message stays");
online = true;
storageWorks = false;
missingFile();
assert.equal(reloads, 2, "Without storage a reload could repeat, so none");
storageWorks = true;
stop();
missingFile();
assert.equal(reloads, 2, "Stopping removes the listener");
console.log(
  "Update recovery: one reload per deploy, no reload loops, offline and blocked-storage fallbacks, and cleanup passed.",
);
