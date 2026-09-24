import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "menu-studio-references-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.LOCAL_DEVELOPMENT = "true";
process.env.OPENAI_API_KEY = "fixture-only";
const { handle } = await import("../lib/server/api.ts");
const { one, run, id, bucket } = await import("../lib/server/core.ts");
const { tick } = await import("../lib/server/generation.ts");
let cookie = "",
  checks = 0,
  providerCalls = 0;
globalThis.fetch = () => {
  providerCalls++;
  throw Error("Reference checks must never call a provider");
};
async function call(path, data, expected = 200) {
  const response = await handle(
    new Request("http://localhost/api/" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        cookie,
        ...(data instanceof FormData
          ? {}
          : { "content-type": "application/json" }),
      },
      body:
        data === undefined
          ? undefined
          : data instanceof FormData
            ? data
            : JSON.stringify(data),
    }),
  );
  const result = await response.json();
  assert.equal(
    response.status,
    expected,
    `${path}: ${result.error || result.id || "unexpected response"}`,
  );
  checks++;
  if (response.headers.has("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  return result;
}
const jpg = readFileSync("public/pasta.jpg");
async function upload(kind, dishId) {
  const form = new FormData();
  form.set("file", new File([jpg], "fixture.jpg", { type: "image/jpeg" }));
  form.set(
    "normalized",
    new File([jpg], "working.jpg", { type: "image/jpeg" }),
  );
  form.set("kind", kind);
  if (dishId) form.set("dishId", dishId);
  return call("assets", form, 201);
}
async function financialState(restaurantId) {
  const state = await call("state");
  return {
    remaining: state.remaining,
    jobs: (
      await one(
        "SELECT count(*) n FROM jobs WHERE restaurant_id=?",
        restaurantId,
      )
    ).n,
    outputs: (
      await one(
        "SELECT count(*) n FROM outputs WHERE restaurant_id=?",
        restaurantId,
      )
    ).n,
    uses: (
      await one(
        "SELECT count(*) n FROM studio_look_uses WHERE restaurant_id=?",
        restaurantId,
      )
    ).n,
  };
}
const storage = bucket(),
  originalHead = storage.head;
try {
  await call("studio-references", { referenceIds: [] }, 401);
  await call("auth/dev", {});
  const state = await call("state"),
    restaurantId = state.restaurant.id;
  const ownCookie = cookie;
  const dish = await call("dishes", {
    name: "Reference QA pasta",
    description: "Tomato and basil",
    confirmed: true,
  });
  const source = await upload("source", dish.id);
  const reference = await upload("reference");
  const reference2 = await upload("reference");
  const reference3 = await upload("reference");
  const asset = await one("SELECT * FROM assets WHERE id=?", reference.id);
  const check = (referenceIds) => call("studio-references", { referenceIds });
  assert.deepEqual(await check([]), { available: true, checks: [] });
  assert.deepEqual(await check([reference.id]), {
    available: true,
    checks: [{ id: reference.id, available: true }],
  });
  assert.equal(
    (await check([reference.id, reference2.id, reference3.id])).available,
    true,
  );
  assert.equal((await check([reference.id, reference.id])).checks.length, 1);
  assert.equal(
    (await check([source.id])).available,
    false,
    "An original is not a style reference",
  );
  assert.equal((await check([id()])).available, false);
  await call(
    "studio-references",
    { referenceIds: [id(), id(), id(), id()] },
    400,
  );
  await call("studio-references", { referenceIds: ["not-a-reference"] }, 400);
  await call("studio-references", { referenceIds: [], restaurantId }, 400);
  await run(
    "UPDATE assets SET deleted_at=? WHERE id=?",
    Date.now(),
    reference.id,
  );
  assert.equal((await check([reference.id])).available, false);
  await run("UPDATE assets SET deleted_at=NULL WHERE id=?", reference.id);

  // Only the working object is used when one was captured; the original
  // existing beside it cannot hide a missing normalized reference.
  await storage.delete(asset.working_key);
  assert.equal((await check([reference.id])).available, false);
  assert.equal(
    (await check([reference2.id, reference.id])).available,
    false,
    "Every captured reference is checked, not only the first thumbnail",
  );
  assert(await storage.head(asset.key));
  const beforeRejection = await financialState(restaurantId);
  const request = (referenceIds, requestKey = id()) => ({
    dishId: dish.id,
    sourceId: source.id,
    requestKey,
    style: { photoStyle: "Soft daylight", referenceIds },
    controls: { plate: "keep" },
    lookContext: { presetId: referenceIds.length ? "reference" : "keep" },
  });
  const missingRequest = request([reference.id]);
  const rejected = await call("jobs", missingRequest, 400);
  assert.match(rejected.error, /inspiration.*unavailable.*another look/i);
  assert.deepEqual(
    await financialState(restaurantId),
    beforeRejection,
    "A missing reference cannot reserve quota, jobs, outputs, or recent-use receipts",
  );
  await storage.put(asset.working_key, new Uint8Array(), {
    httpMetadata: { contentType: "image/jpeg" },
  });
  assert.equal(
    (await check([reference.id])).available,
    false,
    "Empty stored objects are unavailable",
  );
  await storage.put(asset.working_key, new Uint8Array(8 * 1024 * 1024 + 1), {
    httpMetadata: { contentType: "image/jpeg" },
  });
  assert.equal(
    (await check([reference.id])).available,
    false,
    "Oversized provider inputs are blocked before queueing",
  );
  await storage.put(asset.working_key, jpg, {
    httpMetadata: { contentType: "image/jpeg" },
  });
  assert.equal((await check([reference.id])).available, true);

  // A transient storage error is recoverable and is never mislabeled deletion.
  storage.head = async () => {
    throw Error("Fixture storage interruption");
  };
  assert.match(
    (await call("studio-references", { referenceIds: [reference.id] }, 503))
      .error,
    /couldn’t be checked/,
  );
  await call("jobs", missingRequest, 503);
  assert.deepEqual(await financialState(restaurantId), beforeRejection);
  storage.head = originalHead;
  assert.equal((await check([reference.id])).available, true);

  // A successful retry is a single accepted request. If a reference disappears
  // afterward, replay still recovers the already accepted job.
  const job = await call("jobs", missingRequest, 202);
  const acceptedBalance = (await call("state")).remaining;
  await storage.delete(asset.working_key);
  assert.equal((await call("jobs", missingRequest, 202)).id, job.id);
  assert.equal((await call("state")).remaining, acceptedBalance);
  await tick(restaurantId);
  const failed = await one("SELECT * FROM outputs WHERE job_id=?", job.id);
  assert.equal(failed.status, "failed");
  assert.match(
    failed.error,
    /inspiration.*unavailable.*image has been returned/i,
  );
  assert.equal((await call("state")).remaining, beforeRejection.remaining);
  assert.equal(
    providerCalls,
    0,
    "A reference disappearing in the queue must prevent provider submission",
  );
  await storage.put(asset.working_key, jpg, {
    httpMetadata: { contentType: "image/jpeg" },
  });

  // Restored references can create new work. Results already completed remain
  // reusable even when their inspiration is later removed.
  const cachedRequest = request([reference.id]);
  const completed = await call("jobs", cachedRequest, 202);
  const outputId = (
    await one("SELECT id FROM outputs WHERE job_id=?", completed.id)
  ).id;
  const resultId = id(),
    resultKey = `private/${restaurantId}/generated/${resultId}.jpg`;
  await storage.put(resultKey, jpg, {
    httpMetadata: { contentType: "image/jpeg" },
  });
  await run(
    "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,mime,name,created_at) VALUES (?,?,?,'generated',?,'image/jpeg','Completed fixture',?)",
    resultId,
    restaurantId,
    dish.id,
    resultKey,
    Date.now(),
  );
  await run(
    "UPDATE outputs SET status='completed',asset_id=? WHERE id=?",
    resultId,
    outputId,
  );
  await run("UPDATE jobs SET status='completed' WHERE id=?", completed.id);
  await run(
    "UPDATE assets SET deleted_at=? WHERE id=?",
    Date.now(),
    reference.id,
  );
  const beforeCache = (await call("state")).remaining;
  assert.equal((await call("jobs", cachedRequest, 202)).id, completed.id);
  const reused = await call(
    "jobs",
    { ...cachedRequest, requestKey: id() },
    202,
  );
  assert.equal(reused.id, completed.id);
  assert.equal(reused.reused, true);
  assert.equal((await call("state")).remaining, beforeCache);
  assert.equal((await check([reference.id])).available, false);
  assert.equal(
    (await check([resultId])).available,
    false,
    "Unapproved results cannot become inspiration",
  );
  await call(`assets/${resultId}/approve`, { accurate: true });
  assert.equal(
    (await check([resultId])).available,
    true,
    "Approved results may be reused as inspiration",
  );
  const approvedJob = await call("jobs", request([resultId]), 202);
  await run("UPDATE assets SET needs_correction=1 WHERE id=?", resultId);
  assert.equal((await check([resultId])).available, false);
  await tick(restaurantId);
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", approvedJob.id)).status,
    "failed",
    "Accuracy revoked after queueing prevents dispatch",
  );
  assert.equal(providerCalls, 0);

  // Use the exact same generic response for foreign and unknown identifiers.
  cookie = "";
  await call("auth/signup", {
    email: "reference-other@example.test",
    password: "a sufficiently long test password",
  });
  const foreign = await upload("reference");
  cookie = ownCookie;
  let headCalls = 0;
  storage.head = async function (key) {
    headCalls++;
    return originalHead.call(storage, key);
  };
  const foreignResult = await check([foreign.id]);
  const missingResult = await check([id()]);
  assert.deepEqual(Object.keys(foreignResult), Object.keys(missingResult));
  assert.equal(foreignResult.available, false);
  assert.equal(
    headCalls,
    0,
    "Storage belonging to another restaurant is never probed",
  );
  const beforeForeign = await financialState(restaurantId);
  await call("jobs", request([foreign.id]), 400);
  assert.deepEqual(await financialState(restaurantId), beforeForeign);
  assert.equal(headCalls, 0);
  storage.head = originalHead;
  const normal = await call("jobs", request([]), 202);
  assert.equal(
    (await one("SELECT source_id FROM jobs WHERE id=?", normal.id)).source_id,
    source.id,
    "A regular look remains available for the original source",
  );
  assert.equal(providerCalls, 0);
  console.log(
    `Studio references: ${checks} API checks; full-reference readiness, unavailable/storage recovery, ownership, pre-reservation checks, queue races, replay and cached reuse passed. No provider calls.`,
  );
} finally {
  storage.head = originalHead;
  rmSync(root, { recursive: true, force: true });
}
