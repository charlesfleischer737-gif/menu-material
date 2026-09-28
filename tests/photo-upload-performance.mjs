import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mount, text } from "./component-harness.mjs";
import { photoBrief, looks } from "../lib/studio.ts";
import { parseCreationEventDetails } from "../lib/studio-events.ts";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const components = new Proxy({}, { get: (_, name) => String(name) });
async function imports(file) {
  const source = readFileSync(
    new URL(`../app/components/${file}`, import.meta.url),
    "utf8",
  );
  const modules = {};
  for (const [, name] of source.matchAll(/from "([^"]+)"/g)) {
    if (name === "react") continue;
    modules[name] = name.startsWith("@/lib/")
      ? await import(`../${name.slice(2)}.ts`)
      : components;
  }
  return modules;
}
globalThis.window = new EventTarget();
globalThis.document = { activeElement: null };
const revoked = [];
let urls = 0;
URL.createObjectURL = () => `blob:photo-${++urls}`;
URL.revokeObjectURL = (url) => revoked.push(url);

let prepared = deferred(),
  transferred = deferred(),
  saved = deferred(),
  reloaded = deferred();
const calls = [],
  events = [];
let draft;
const state = {
  user: { id: "user" },
  restaurant: {
    id: "restaurant",
    name: "Kitchen",
    timezone: "America/New_York",
    style: {},
  },
  dishes: [],
  assets: [],
  jobs: [],
  outputs: [],
  aiConnected: true,
  remaining: 5,
};
const modules = await imports("photo-studio.tsx");
const page = mount("photo-studio.tsx", (hooks) => ({
  ...modules,
  "@/lib/client": {
    normalizePhoto: () => prepared.promise,
    api: async (path) => {
      calls.push(path);
      if (path === "dishes") return { id: "dish" };
      if (path === "assets") return transferred.promise;
      if (path.endsWith("/context")) return {};
      if (path === "photo-analysis") throw Error("Guidance offline");
      throw Error(`Unexpected request: ${path}`);
    },
  },
  "@/lib/photo-advice": {
    photoAdvice: () => Promise.reject(Error("Advice unavailable")),
  },
  "./use-studio-navigation": { useStudioNavigation() {} },
  "./use-studio-timing": { useStudioTiming() {} },
  "./use-inspiration-availability": {
    useInspirationAvailability: () => ({ status: "ready" }),
  },
  "./creation-shared": {
    Feedback: "Feedback",
    DraftRecovery: "DraftRecovery",
    SavedDrafts: "SavedDrafts",
    useStepFocus: () => ({ current: null }),
    track: (kind, id, details) => events.push({ kind, id, details }),
    useCreationDraft: () => {
      const [value, setValue] = hooks.useState(photoBrief());
      draft = value;
      const latest = hooks.useRef(value);
      return {
        draft: value,
        id: "draft",
        storedId: "",
        ready: true,
        status: "",
        stored: () => false,
        read: () => latest.current,
        save: () => saved.promise,
        change: (patch) => {
          latest.current = { ...latest.current, ...patch };
          setValue(latest.current);
        },
      };
    },
    useAction: () => {
      const [busy, setBusy] = hooks.useState("");
      const [error, setError] = hooks.useState("");
      const lock = hooks.useRef(false);
      return {
        busy,
        error,
        setError,
        setNotice() {},
        act: async (label, work) => {
          if (lock.current) return;
          lock.current = true;
          setBusy(label);
          setError("");
          try {
            await work();
          } catch (error) {
            setError(error.message);
          } finally {
            setBusy("");
            lock.current = false;
          }
        },
      };
    },
  },
}));
page.render({
  state,
  active: false,
  refresh: () => reloaded.promise,
  seed: null,
});
const workbench = () =>
  page.find((node) => node.type === "StudioWorkbench")[0].props;
const file = new File(["original"], "dish.jpg", { type: "image/jpeg" });
page.fire(() => workbench().uploadPhoto(file));
assert.equal(workbench().busy, "Preparing your photo");
assert.deepEqual(
  calls,
  [],
  "An unprepared file never creates a dish or uploads",
);
prepared.resolve(new Blob(["working"], { type: "image/jpeg" }));
await page.settle();
assert.equal(
  workbench().source,
  "blob:photo-1",
  "Preview appears before the server accepts the upload",
);
assert.equal(
  workbench().busy,
  "",
  "Style controls unlock while the original uploads",
);
assert.equal(workbench().photoUploading, true);
assert.equal(
  draft.sourceId,
  "",
  "A temporary preview never becomes a saved asset ID",
);
const leaving = new Event("beforeunload", { cancelable: true });
window.dispatchEvent(leaving);
assert.equal(
  leaving.defaultPrevented,
  true,
  "Unfinished original upload is protected on tab close",
);
const look = looks.find(
  (entry) => entry.id !== draft.look && entry.id !== "reference",
);
page.fire(() => workbench().chooseLook(look.id));
assert.equal(draft.look, look.id, "A style can be selected during upload");
transferred.resolve({ id: "source" });
await page.settle();
assert.equal(workbench().photoUploading, false);
assert.equal(
  workbench().busy,
  "",
  "Slow draft saves and workspace reloads never hold Create disabled",
);
assert.equal(draft.sourceId, "source");
assert.equal(
  draft.look,
  look.id,
  "Upload completion preserves the chosen style",
);
assert.equal(
  workbench().source,
  "blob:photo-1",
  "The saved photo reuses its local preview without downloading again",
);
const afterUpload = new Event("beforeunload", { cancelable: true });
window.dispatchEvent(afterUpload);
assert.equal(afterUpload.defaultPrevented, false);
const measurement = events.find((event) => event.kind === "upload_complete");
assert.deepEqual(
  parseCreationEventDetails("upload_complete", measurement.details),
  measurement.details,
);
assert.equal(measurement.details.originalBytes, file.size);

// A failed replacement releases its preview and restores the saved original.
prepared = deferred();
transferred = deferred();
page.fire(() => workbench().uploadPhoto(file));
prepared.resolve(new Blob(["replacement"], { type: "image/jpeg" }));
await page.settle();
assert.equal(workbench().source, "blob:photo-2");
assert.deepEqual(revoked, ["blob:photo-1"]);
transferred.reject(Error("Upload interrupted"));
await page.settle();
assert.equal(draft.sourceId, "source");
assert.equal(workbench().source, "/api/assets/source");
assert.equal(workbench().photoUploading, false);
assert.deepEqual(revoked, ["blob:photo-1", "blob:photo-2"]);
assert.equal(
  page.find((node) => node.type === "Feedback")[0].props.error,
  "Upload interrupted",
);
page.unmount();

// Render the real workbench: choosing a style is safe, creating or replacing
// the photo before storage acknowledges it is not.
const workbenchModules = await imports("studio-workbench.tsx");
const ui = mount("studio-workbench.tsx", {
  ...workbenchModules,
  "./radio-keys": await import("../app/components/radio-keys.ts"),
  "./use-studio-library": {
    useStudioLibrary: () => ({
      ready: false,
      library: { looks: [], recentLooks: [] },
    }),
  },
  "./use-studio-navigation": { useStudioNavigation() {} },
  "./creation-shared": { track() {} },
});
const uiProps = {
  draft: { ...photoBrief(), sourceId: "" },
  state,
  selected: looks[0],
  styleImage: "",
  source: "blob:pending",
  busy: "",
  photoUploading: true,
  advice: "",
  referencePhoto: null,
  update() {},
  chooseLook() {},
};
ui.render(uiProps);
assert.equal(
  ui.find((node) => node.props?.className === "st-create")[0].props.disabled,
  true,
);
assert.match(
  text(ui.find((node) => node.props?.className === "st-create")[0]),
  /Saving your photo/,
);
assert.equal(
  ui.find((node) => node.type === "button" && text(node) === "Replace")[0].props
    .disabled,
  true,
);
assert(
  ui
    .find((node) => node.type === "StyleTile")
    .every((node) => !node.props.disabled),
);
ui.render({
  ...uiProps,
  draft: { ...uiProps.draft, sourceId: "source" },
  photoUploading: false,
});
assert.equal(
  ui.find((node) => node.props?.className === "st-create")[0].props.disabled,
  false,
);
ui.unmount();
console.log(
  "PASS: early upload preview, usable style controls, safe Create gating, background saves, failure recovery, preview cleanup and upload timing.",
);
