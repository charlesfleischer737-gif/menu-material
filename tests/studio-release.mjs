import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-studio-release-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.LOCAL_DEVELOPMENT = "true";
process.env.OPENAI_API_KEY = "fixture-only";
const realNow = Date.now;
let advance = 0;
Date.now = () => realNow() + advance;
const { handle } = await import("../lib/server/api.ts");
const { run, one, id, digest } = await import("../lib/server/core.ts");
const { studioReleaseControls, checkStudioGeneration } =
  await import("../lib/server/studio-release.ts");
const { photoBrief, styleFor, resolvePhotoLook, PIPELINE_VERSION, looks } =
  await import("../lib/studio.ts");
const { studioCreationBlock, startingLooks } =
  await import("../lib/studio-discovery.ts");
let cookie = "",
  checks = 0,
  submissions = 0,
  polls = 0;
const jpg = readFileSync("public/pasta.jpg");
globalThis.fetch = async (url, options = {}) => {
  assert(
    String(url).startsWith("https://api.openai.com/v1/responses"),
    "No unexpected external request",
  );
  if (options.method === "POST") {
    submissions++;
    return Response.json({
      id: "fixture-recovery",
      status: "in_progress",
      output: [],
    });
  }
  polls++;
  return Response.json({
    id: "fixture-recovery",
    status: "completed",
    output: [{ type: "image_generation_call", result: jpg.toString("base64") }],
    usage: {},
  });
};
async function call(path, data, status = 200) {
  const res = await handle(
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
  const type = res.headers.get("content-type") || "";
  const body = type.includes("json")
    ? await res.json()
    : new Uint8Array(await res.arrayBuffer());
  if (Array.isArray(status))
    assert(status.includes(res.status), `${path}: unexpected ${res.status}`);
  else
    assert.equal(
      res.status,
      status,
      `${path}: ${JSON.stringify(body).slice(0, 250)}`,
    );
  checks++;
  if (res.headers.has("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return Array.isArray(status) ? { status: res.status, body } : body;
}
try {
  assert.equal(resolvePhotoLook({ look: "retired-unknown" }), null);
  assert.throws(() => styleFor({ look: "retired-unknown" }, {}), /unavailable/);
  assert.match(
    studioCreationBlock({ look: "retired-unknown" }),
    /Choose another look/,
  );
  const captured = {
    look: "retired-unknown",
    photoStyleSnapshot: "Captured unique scene",
    savedLookName: "Original custom look",
  };
  assert.equal(resolvePhotoLook(captured).name, "Original custom look");
  assert.equal(styleFor(captured, {}).photoStyle, "Captured unique scene");
  assert.equal(studioCreationBlock(captured), "");
  for (const look of looks)
    assert(
      resolvePhotoLook({ look: look.id }),
      `Legacy/current look ${look.id} remains readable`,
    );
  const recommendations = startingLooks(
    photoBrief(),
    [],
    undefined,
    [],
    ["keep", "menu-wood", "delivery-white"],
  );
  assert.equal(recommendations.length, 3);
  assert(
    recommendations.every(
      (look) => !["keep", "menu-wood", "delivery-white"].includes(look.id),
    ),
  );
  assert.match(
    studioCreationBlock(
      { look: "menu-wood" },
      { creationEnabled: true, disabledStyleIds: ["menu-wood"] },
    ),
    /temporarily unavailable/,
  );
  assert.match(
    studioCreationBlock(photoBrief(), {
      creationEnabled: false,
      message: "Paused for QA",
    }),
    /Paused for QA/,
  );
  const guest = await call("state");
  assert.equal(guest.studioAvailability.creationEnabled, true);
  await call("admin/studio-release", {}, 403);
  await call("auth/dev", {});
  const adminCookie = cookie,
    state = await call("state"),
    restaurant = state.restaurant;
  let controls = (await call("admin")).studioRelease;
  assert.equal(controls.revision, 0);
  const dish = await call("dishes", { name: "Fixture pasta", confirmed: true });
  const form = new FormData();
  form.set("file", new File([jpg], "pasta.jpg", { type: "image/jpeg" }));
  form.set("dishId", dish.id);
  form.set(
    "normalized",
    new File([jpg], "working.jpg", { type: "image/jpeg" }),
  );
  const source = await call("assets", form, 201);
  const body = {
    dishId: dish.id,
    sourceId: source.id,
    style: styleFor({ ...photoBrief(), look: "menu-wood" }, restaurant),
    controls: { plate: "keep" },
    lookContext: { presetId: "menu-wood" },
    requestKey: id(),
  };
  const queued = await call("jobs", body, 202);
  assert.equal((await call("state")).remaining, state.remaining - 1);
  controls = await call("admin/studio-release", {
    ...controls,
    disabledStyleIds: ["menu-wood"],
  });
  assert.equal(controls.revision, 1);
  const replay = await call("admin/studio-release", {
    ...controls,
    revision: 0,
  });
  assert.equal(replay.revision, 1, "Lost-response replay is idempotent");
  await call(
    "admin/studio-release",
    { ...controls, revision: 0, mode: "paused" },
    409,
  );
  await call(
    "admin/studio-release",
    { ...controls, disabledStyleIds: ["invented-style"] },
    400,
  );
  await call("jobs/tick", {});
  const stopped = await one(
    "SELECT status,error,attempts FROM outputs WHERE job_id=?",
    queued.id,
  );
  assert.equal(stopped.status, "failed");
  assert.equal(stopped.attempts, 0);
  assert.match(stopped.error, /reserved allowance is available again/);
  assert.equal(
    submissions,
    0,
    "A newly disabled style never reaches provider submission",
  );
  assert.equal((await call("state")).remaining, state.remaining);
  await call("jobs", { ...body, requestKey: id() }, 423);
  assert.equal(
    (await call("jobs", body, 202)).id,
    queued.id,
    "Existing logical requests remain recoverable",
  );
  const { retryFailed } = await import("../lib/server/menu-tools.ts");
  await assert.rejects(
    () => retryFailed(restaurant, queued.id),
    (error) => error.status === 423,
  );
  controls = await call("admin/studio-release", {
    ...controls,
    disabledStyleIds: [],
    disabledPipelines: [PIPELINE_VERSION],
  });
  assert.equal((await call("state")).studioAvailability.creationEnabled, false);
  await call("jobs", { ...body, requestKey: id() }, 423);
  controls = await call("admin/studio-release", {
    ...controls,
    disabledPipelines: [],
  });
  const running = await call("jobs", { ...body, requestKey: id() }, 202);
  await call("jobs/tick", {});
  assert.equal(submissions, 1);
  assert.equal(
    (await one("SELECT status FROM outputs WHERE job_id=?", running.id)).status,
    "processing",
  );
  controls = await call("admin/studio-release", {
    ...controls,
    mode: "paused",
    disabledStyleIds: ["menu-wood"],
    disabledPipelines: [PIPELINE_VERSION],
  });
  advance += 61000;
  await call("jobs/tick", {});
  const completed = await one(
    "SELECT status,asset_id FROM outputs WHERE job_id=?",
    running.id,
  );
  assert.equal(
    completed.status,
    "completed",
    "Previously submitted work is recovered even when its creation route is paused",
  );
  assert.equal(submissions, 1);
  assert.equal(polls, 1);
  await call("assets/" + completed.asset_id + "/approve", { accurate: true });
  const exported = await call("assets/" + completed.asset_id + "?download=1");
  assert(
    exported instanceof Uint8Array && exported.length > 0,
    "Saved results remain downloadable during a pause",
  );
  const userId = id(),
    otherRestaurant = id(),
    session = id();
  await run(
    "INSERT INTO users (id,email,password,created_at) VALUES (?,?,?,?)",
    userId,
    "release-owner@fixture.test",
    "fixture-only",
    Date.now(),
  );
  await run(
    "INSERT INTO restaurants (id,user_id,name,slug,created_at) VALUES (?,?,?,?,?)",
    otherRestaurant,
    userId,
    "Other fixture restaurant",
    "release-other",
    Date.now(),
  );
  await run(
    "INSERT INTO sessions (hash,user_id,expires_at) VALUES (?,?,?)",
    digest(session),
    userId,
    Date.now() + 3600000,
  );
  controls = await call("admin/studio-release", {
    ...controls,
    mode: "pilot",
    pilotRestaurantIds: [restaurant.id],
    disabledStyleIds: [],
    disabledPipelines: [],
  });
  assert.equal((await call("state")).studioAvailability.creationEnabled, true);
  cookie = "menu_material_session=" + session;
  const outside = await call("state");
  assert.equal(outside.studioAvailability.creationEnabled, false);
  assert(
    !JSON.stringify(outside.studioAvailability).includes(restaurant.id),
    "Public policy never discloses other restaurant IDs",
  );
  await call("admin/studio-release", controls, 403);
  const secondDish = await call("dishes", {
    name: "Other fixture dish",
    description:
      "A single serving of tomato pasta on a white plate with basil.",
    confirmed: true,
  });
  await call(
    "jobs",
    { dishId: secondDish.id, requestKey: id(), controls: { plate: "keep" } },
    423,
  );
  cookie = "";
  const anonymous = await call("state");
  assert.equal(anonymous.studioAvailability.creationEnabled, false);
  assert(!JSON.stringify(anonymous.studioAvailability).includes(restaurant.id));
  cookie = adminCookie;
  await run(
    "UPDATE app_settings SET value=? WHERE key='studio-release'",
    "malformed",
  );
  assert.equal(
    (await call("state")).studioAvailability.creationEnabled,
    false,
    "Malformed controls fail closed without hiding saved work",
  );
  await call("assets/" + completed.asset_id + "?download=1");
  await assert.rejects(
    () =>
      checkStudioGeneration(restaurant.id, {
        pipelineVersion: PIPELINE_VERSION,
      }),
    (error) => error.status === 423,
  );
  controls = await call("admin/studio-release", {
    revision: 0,
    mode: "open",
    pilotRestaurantIds: [],
    disabledStyleIds: [],
    disabledPipelines: [],
  });
  assert.equal(
    (await call("state")).studioAvailability.creationEnabled,
    true,
    "Admin can repair malformed controls",
  );
  const changes = await Promise.all([
    call("admin/studio-release", { ...controls, mode: "paused" }, [200, 409]),
    call(
      "admin/studio-release",
      { ...controls, disabledStyleIds: ["delivery-white"] },
      [200, 409],
    ),
  ]);
  assert.deepEqual(
    changes.map((result) => result.status).sort(),
    [200, 409],
    "Concurrent edits do not silently overwrite one another",
  );
  const final = await studioReleaseControls();
  assert.equal(final.revision, controls.revision + 1);
  console.log(
    `Photo Studio release controls: ${checks} API checks plus unknown-look, captured-recipe, legacy compatibility, scoped access, queue withdrawal, recovery, export and conflict assertions passed. Provider responses are fixtures.`,
  );
} finally {
  Date.now = realNow;
  rmSync(root, { recursive: true, force: true });
}
