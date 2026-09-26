import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-studio-guest-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.LOCAL_DEVELOPMENT = "true";
process.env.OPENAI_API_KEY = "fixture-only";
const { handle } = await import("../lib/server/api.ts");
const { one, id } = await import("../lib/server/core.ts");
const { transferGuestPhoto } = await import("../lib/guest-studio.ts");
const { photoBrief } = await import("../lib/studio.ts");
let cookie = "",
  checks = 0;
// The guest studio's own requests go to the app; nothing leaves the test.
globalThis.fetch = async (url, init = {}) => {
  assert(String(url).startsWith("/api/"), "No external calls");
  const res = await handle(
    new Request("http://localhost" + url, {
      ...init,
      headers: { ...init.headers, cookie },
    }),
  );
  if (res.headers.has("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return res;
};
globalThis.localStorage = {
  getItem: () => null,
  setItem() {},
  removeItem() {},
};
globalThis.history = { replaceState() {} };
async function call(path, data) {
  const res = await fetch("/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  assert(res.ok, `${path}: ${res.status}`);
  checks++;
  return res.json();
}
try {
  await call("auth/signup", {
    email: "guest-sample@example.test",
    password: "a sufficiently long password",
  });
  const state = await call("state");
  const bytes = readFileSync("public/pasta.jpg");
  const file = new File([bytes], "sample-burger.jpg", { type: "image/jpeg" });
  const photo = { file, normalized: file, url: "blob:local" };
  // "Try a sample" stays a sample after signup: kept out of menus and posts.
  const sampleDraft = {
    ...photoBrief(),
    name: "Sample burger",
    sample: true,
    mode: "photo",
  };
  const sampleTransfer = { id: id(), revision: 0, requestKey: id() };
  await transferGuestPhoto(sampleDraft, photo, null, state, sampleTransfer);
  const sampleDish = await one(
    "SELECT name,sample FROM dishes WHERE id=?",
    sampleTransfer.dishId,
  );
  assert.equal(sampleDish.name, "Sample burger");
  assert.equal(sampleDish.sample, 1, "A guest's sample is saved as a sample");
  checks++;
  const ownTransfer = { id: id(), revision: 0, requestKey: id() };
  await transferGuestPhoto(
    { ...photoBrief(), name: "My pasta", mode: "photo" },
    photo,
    null,
    state,
    ownTransfer,
  );
  assert.equal(
    (await one("SELECT sample FROM dishes WHERE id=?", ownTransfer.dishId))
      .sample,
    0,
    "A guest's own photo is a real dish",
  );
  checks++;
  // Signing in without pressing Create hands the draft to the workspace
  // Photo Studio: the photo and choices are saved, and no image is made.
  const jobsBefore = (await one("SELECT count(*) n FROM jobs")).n;
  const handOff = { id: id(), revision: 0, requestKey: id() };
  await transferGuestPhoto(
    {
      ...photoBrief(),
      mode: "photo",
      look: "menu-stone",
      note: "Keep the bowl",
      sourceId: "guest-photo",
      analysisSourceId: "guest-photo",
      analysisStatus: "manual",
      recommendationFamily: "Pizza",
    },
    photo,
    null,
    state,
    handOff,
    undefined,
    { create: false },
  );
  assert.equal(handOff.jobId, undefined);
  assert.equal((await one("SELECT count(*) n FROM jobs")).n, jobsBefore);
  const handed = JSON.parse(
    (await one("SELECT draft FROM creation_drafts WHERE id=?", handOff.id))
      .draft,
  );
  assert.equal(handed.step, 1);
  assert.equal(handed.sourceId, handOff.sourceId);
  assert.equal(handed.dishId, handOff.dishId);
  assert.equal(handed.look, "menu-stone");
  assert.equal(handed.note, "Keep the bowl");
  // What the photo shows, as read or as the guest said, stays with the saved
  // photo, so the workspace doesn't read it again over the guest's choice.
  assert.equal(handed.analysisSourceId, handOff.sourceId);
  assert.equal(handed.analysisStatus, "manual");
  assert.equal(handed.recommendationFamily, "Pizza");
  checks++;
  // A photo still being read is read again in the workspace.
  const unread = { id: id(), revision: 0, requestKey: id() };
  await transferGuestPhoto(
    {
      ...photoBrief(),
      mode: "photo",
      sourceId: "guest-photo",
      analysisSourceId: "guest-photo",
      analysisStatus: "analyzing",
    },
    photo,
    null,
    state,
    unread,
    undefined,
    { create: false },
  );
  assert.equal(
    JSON.parse(
      (await one("SELECT draft FROM creation_drafts WHERE id=?", unread.id))
        .draft,
    ).analysisSourceId,
    "",
  );
  checks++;
  console.log(
    `Guest studio: ${checks} checks passed (samples stay samples after signup; sign-in hands the draft and what the photo shows to the workspace without making an image).`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
