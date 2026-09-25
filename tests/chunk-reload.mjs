import assert from "node:assert/strict";

// A browser-like tab: session storage, connectivity and location.reload().
const stored = new Map();
let storageWorks = true,
  reloads = 0;
globalThis.sessionStorage = {
  getItem(key) {
    if (!storageWorks) throw Error("Storage is disabled");
    return stored.get(key) ?? null;
  },
  setItem(key, value) {
    if (!storageWorks) throw Error("Storage is disabled");
    stored.set(key, String(value));
  },
};
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
});
globalThis.location = { reload: () => reloads++ };
const { isChunkLoadError, reloadForNewVersion, loadFresh } =
  await import("../lib/chunk-reload.ts");
let checks = 0;

// How browsers and Vite report a code-split file that failed to load.
for (const message of [
  "Failed to fetch dynamically imported module: https://menus.example/assets/post-maker-Cq1.js",
  "error loading dynamically imported module: https://menus.example/assets/a.js",
  "Importing a module script failed.",
  "Unable to preload CSS for /assets/menu-studio-9f.css",
  "Loading chunk 812 failed.",
]) {
  assert(isChunkLoadError(new TypeError(message)), message);
  checks++;
}
for (const other of [
  new Error("Sign in to your restaurant workspace."),
  new TypeError("Cannot read properties of undefined (reading 'id')"),
  new TypeError("Failed to fetch"),
  null,
  undefined,
  { message: "Failed to fetch dynamically imported module" },
]) {
  assert(!isChunkLoadError(other), String(other?.message ?? other));
  checks++;
}

// Other failures reject as before, with no reload.
await assert.rejects(
  loadFresh(() => Promise.reject(new Error("Server error"))),
  /Server error/,
);
assert.equal(await loadFresh(() => Promise.resolve("module")), "module");
assert.equal(reloads, 0);
checks += 3;

// No reload while offline (the browser would show its offline page), without
// session storage, or within a minute of the last reload in this tab.
navigator.onLine = false;
assert.equal(reloadForNewVersion(), false);
navigator.onLine = true;
storageWorks = false;
assert.equal(reloadForNewVersion(), false);
storageWorks = true;
stored.set("menu-material:reloaded-for-update", String(Date.now() - 5000));
assert.equal(reloadForNewVersion(), false);
await assert.rejects(
  loadFresh(() =>
    Promise.reject(new TypeError("Importing a module script failed.")),
  ),
  /Importing a module script failed/,
  "After a recent reload the failure reaches the page's own message",
);
assert.equal(reloads, 0);
checks += 5;

// Otherwise a stale file reloads the page once, and the import stays pending
// so the screen keeps its loading state until the reload happens.
stored.set("menu-material:reloaded-for-update", String(Date.now() - 61_000));
let settled = false;
loadFresh(() =>
  Promise.reject(
    new TypeError("Failed to fetch dynamically imported module: /assets/a.js"),
  ),
).then(
  () => (settled = true),
  () => (settled = true),
);
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(settled, false);
assert.equal(reloads, 1);
assert(
  Date.now() - Number(stored.get("menu-material:reloaded-for-update")) < 1000,
);
// Further failures while it reloads don't reload again.
assert.equal(reloadForNewVersion(), true);
assert.equal(reloads, 1);
checks += 5;

console.log(
  `Chunk reload: ${checks} checks passed (stale-deploy detection, one guarded reload, offline and storage fallbacks).`,
);
