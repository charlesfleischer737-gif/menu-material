import assert from "node:assert/strict";
import {
  hasSavedContent,
  readPreference,
  rememberPreference,
  resolveWorkspace,
  workspacePreferenceKey,
} from "../lib/workspace-navigation.ts";

// Explicit links and browser history must beat the remembered workspace.
assert.equal(resolveWorkspace("#post", "menu", false), "post");
assert.equal(resolveWorkspace("#menu", "studio", false), "menu");
assert.equal(resolveWorkspace("#library", "post", false), "library");
assert.equal(resolveWorkspace("#explore", "studio", false), "explore");
assert.equal(resolveWorkspace("", "explore", false), "explore");
assert.equal(resolveWorkspace("#campaigns", "studio", false), "campaigns");
assert.equal(
  resolveWorkspace("#promotion/saved-campaign", "tools", false),
  "campaigns",
);
assert.equal(resolveWorkspace("#promotion/", "tools", false), "tools");
assert.equal(resolveWorkspace("", "menu", false), "menu");
assert.equal(resolveWorkspace("#unknown", "post", false), "post");
assert.equal(resolveWorkspace("#home", "menu", false), "studio");
assert.equal(resolveWorkspace("", "home", false), null);
assert.equal(resolveWorkspace("", "", false), null);
assert.equal(resolveWorkspace("#admin", "menu", false), "menu");
assert.equal(resolveWorkspace("#admin", "menu", true), "admin");
assert.equal(resolveWorkspace("", "admin", true), null);

// Remembering a workspace never crosses user or restaurant boundaries.
const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
const key = workspacePreferenceKey("owner", "restaurant");
rememberPreference(key, "menu");
assert.equal(readPreference(key), "menu");
assert.equal(readPreference(workspacePreferenceKey("staff", "restaurant")), "");
assert.equal(readPreference(workspacePreferenceKey("owner", "another")), "");
globalThis.localStorage = {
  getItem: () => {
    throw Error("Storage blocked");
  },
  setItem: () => {
    throw Error("Storage blocked");
  },
};
assert.equal(readPreference(key), "");
assert.doesNotThrow(() => rememberPreference(key, "studio"));
delete globalThis.localStorage;
assert.equal(readPreference(key), "");

// Empty drafts must not displace actual work when opening on another device.
const drafts = [
  { kind: "studio", draft: { step: 1, sourceId: "" } },
  { kind: "menu", draft: { rows: [{ name: "Soup" }] } },
  { kind: "post", draft: { items: [{ photoId: "photo" }] } },
];
assert.equal(drafts.find(hasSavedContent)?.kind, "menu");
assert.equal(
  hasSavedContent({ kind: "menu", draft: { importId: "import" } }),
  true,
);
assert.equal(
  hasSavedContent({ kind: "studio", draft: { sourceId: "photo" } }),
  true,
);
assert.equal(
  hasSavedContent({ kind: "studio", draft: { description: "Soup" } }),
  true,
);
assert.equal(
  hasSavedContent({ kind: "post", draft: { title: "Friday special" } }),
  true,
);
assert.equal(hasSavedContent({ kind: "post", draft: { items: [] } }), false);
assert.equal(
  hasSavedContent({ kind: "admin", draft: { title: "Ignored" } }),
  false,
);
console.log(
  "Workspace routing, account isolation, and saved-work fallback checks passed.",
);
