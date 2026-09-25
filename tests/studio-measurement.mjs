import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-studio-measurement-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.OPENAI_API_KEY = "fixture-only";
const { handle } = await import("../lib/server/api.ts");
const { run, one, all, id } = await import("../lib/server/core.ts");
const { updateJob } = await import("../lib/server/generation.ts");
const { photoBrief, styleFor, emptyAdjustments } =
  await import("../lib/studio.ts");
const { canonicalStudioEvents, parseCreationEventDetails } =
  await import("../lib/studio-events.ts");
const { photoExportEventKey } = await import("../lib/photo-export-identity.ts");
const { StudioTimer } = await import("../lib/studio-timing.ts");
const { searchIntent } = await import("../lib/studio-discovery.ts");
let cookie = "",
  checks = 0;
globalThis.fetch = () => {
  throw Error("No external requests in measurement fixtures.");
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
  const body = await res.json();
  assert.equal(res.status, status, `${path}: ${JSON.stringify(body)}`);
  checks++;
  if (res.headers.has("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return body;
}
try {
  for (const [query, intent] of [
    ["football Sunday", "occasion"],
    ["warm wood table", "setting"],
    ["bright and cozy", "mood"],
    ["pizza", "subject"],
    ["private restaurant name", "other"],
  ]) {
    assert.equal(searchIntent(query), intent);
    assert.deepEqual(
      parseCreationEventDetails("style_search_used", { intent }),
      { intent },
    );
  }
  assert.equal(canonicalStudioEvents.source_ready, undefined);
  assert.equal(canonicalStudioEvents.studio_source_ready, "source_ready");
  const active = new StudioTimer("decision", 0);
  assert.equal(active.drain(10000), 10000);
  assert.equal(active.drain(20000), 10000);
  assert.equal(
    active.drain(45000),
    10000,
    "Idle time after 30 seconds is not active effort.",
  );
  assert.equal(active.drain(50000), 0);
  active.interact(55000);
  assert.equal(
    active.drain(60000),
    5000,
    "Returning activity never backfills idle time.",
  );
  active.observe(65000, false);
  assert.equal(active.drain(90000), 5000);
  active.observe(95000, true);
  assert.equal(
    active.drain(100000),
    5000,
    "Hidden and unfocused time is excluded.",
  );
  const waiting = new StudioTimer("generation", 0);
  assert.equal(
    waiting.drain(45000),
    45000,
    "Visible waiting is separate from active decisions.",
  );
  assert.equal(
    waiting.drain(3600000),
    0,
    "A suspended browser cannot claim an hour of observed waiting.",
  );
  for (const details of [
    { query: "private dish" },
    { note: "private note" },
    { image: "private URL" },
    { restaurantName: "private name" },
    { category: "private text" },
    { measurementMode: "production" },
  ])
    assert.throws(() =>
      parseCreationEventDetails("style_search_used", details),
    );
  assert.equal(
    canonicalStudioEvents.export_complete,
    undefined,
    "Legacy export clicks must not become prepared files or received files.",
  );
  assert.equal(
    canonicalStudioEvents.export_download_started,
    "download_started",
  );
  assert.equal(canonicalStudioEvents.image_approved, "result_approved");
  assert.equal(
    canonicalStudioEvents.image_completed,
    undefined,
    "Only the canonical terminal event enters the funnel.",
  );
  const assetKey = id();
  const key = await photoExportEventKey(assetKey, "menu", emptyAdjustments);
  assert.equal(key.length, 64);
  assert.equal(
    await photoExportEventKey(assetKey, "menu", { ...emptyAdjustments }),
    key,
  );
  for (const [field, value] of Object.entries({
    x: 51,
    y: 49,
    zoom: 1.1,
    fit: false,
    brightness: 110,
    contrast: 105,
    warmth: 5,
    rotate: 90,
  }))
    assert.notEqual(
      await photoExportEventKey(assetKey, "menu", {
        ...emptyAdjustments,
        [field]: value,
      }),
      key,
      `${field} changes export identity`,
    );
  assert.equal(
    await photoExportEventKey(assetKey, "master", {
      ...emptyAdjustments,
      rotate: 90,
    }),
    await photoExportEventKey(assetKey, "master", emptyAdjustments),
    "Master identity ignores unapplied crop controls.",
  );
  await call("auth/dev", {});
  const state = await call("state");
  const dish = await call("dishes", {
    name: "Measurement fixture",
    description: "A bowl of pasta",
    confirmed: true,
  });
  const file = new File([readFileSync("public/pasta.jpg")], "fixture.jpg", {
    type: "image/jpeg",
  });
  const form = new FormData();
  form.set("file", file);
  form.set("normalized", file);
  form.set("dishId", dish.id);
  form.set("requestKey", id());
  const source = await call("assets", form, 201);
  const draftId = id();
  await call("creation-drafts", {
    id: draftId,
    revision: 0,
    kind: "studio",
    draft: { ...photoBrief(), dishId: dish.id, sourceId: source.id },
  });
  const opened = {
    kind: "studio_opened",
    details: { draftId, sourceId: source.id, guest: false },
    eventKey: id(),
  };
  const otherUser = id(),
    otherRestaurant = id(),
    otherSource = id(),
    otherDraft = id();
  await run(
    "INSERT INTO users (id,email,password,created_at) VALUES (?,?,?,?)",
    otherUser,
    "measurement-other@fixture.test",
    "fixture-only",
    Date.now(),
  );
  await run(
    "INSERT INTO restaurants (id,user_id,name,slug,created_at) VALUES (?,?,?,?,?)",
    otherRestaurant,
    otherUser,
    "Other fixture",
    "measurement-other",
    Date.now(),
  );
  await run(
    "INSERT INTO assets (id,restaurant_id,kind,key,mime,name,created_at) VALUES (?,?,'source',?,'image/jpeg','Other fixture',?)",
    otherSource,
    otherRestaurant,
    `private/${otherRestaurant}/fixture.jpg`,
    Date.now(),
  );
  await run(
    "INSERT INTO creation_drafts (id,restaurant_id,kind,draft,updated_at) VALUES (?,?,'studio','{}',?)",
    otherDraft,
    otherRestaurant,
    Date.now(),
  );
  for (const details of [{ sourceId: otherSource }, { draftId: otherDraft }])
    await call("creation-events", { kind: "style_search_used", details }, 400);
  const timing = {
    kind: "studio_timing",
    details: {
      draftId,
      phase: "decision",
      milliseconds: 15000,
      device: "phone",
    },
    eventKey: id(),
  };
  await call("creation-events", timing);
  await call("creation-events", timing);
  assert.equal(
    (await one("SELECT count(*) AS n FROM events WHERE kind='studio_timing'"))
      .n,
    1,
  );
  await call(
    "creation-events",
    { ...timing, details: { ...timing.details, milliseconds: 0 } },
    400,
  );
  await call(
    "creation-events",
    { ...timing, details: { draftId, milliseconds: 15000 } },
    400,
  );
  // A new, empty studio draft isn't saved yet: the page records the open
  // without it, since an unsaved draft is "unavailable work" to the server.
  await call(
    "creation-events",
    { ...opened, details: { draftId: id(), guest: false } },
    400,
  );
  await call("creation-events", {
    kind: "studio_opened",
    details: { guest: false },
    eventKey: id(),
  });
  await run("DELETE FROM events WHERE kind='studio_opened'");
  await call("creation-events", opened);
  await call("creation-events", opened);
  assert.equal(
    (await one("SELECT count(*) AS n FROM events WHERE kind='studio_opened'"))
      .n,
    1,
  );
  for (const details of [
    { query: "private text" },
    { note: "private note" },
    { sourceId: id() },
    { draftId: id() },
    { measurementMode: "production" },
  ])
    await call("creation-events", { kind: "style_search_used", details }, 400);
  const selected = {
    kind: "look_selected",
    details: { look: "menu-wood", origin: "catalog" },
    eventKey: id(),
  };
  await call("creation-events", selected);
  await call("creation-events", selected);
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM events WHERE kind='look_selected' AND json_extract(details,'$.origin')='catalog'",
      )
    ).n,
    1,
    "Replaying a catalog selection records it once, separately from the initial look.",
  );
  await call("creation-events", {
    ...selected,
    details: { look: "menu-wood", origin: "recent" },
    eventKey: id(),
  });
  await call(
    "creation-events",
    {
      ...selected,
      details: { look: "menu-wood", origin: "private text" },
      eventKey: id(),
    },
    400,
  );
  assert.equal(
    (await one("SELECT count(*) AS n FROM events WHERE kind='look_reused'")).n,
    0,
    "Selecting a look is not a generation using it.",
  );
  for (const kind of [
    "generation_requested",
    "generation_completed",
    "source_ready",
    "look_reused",
    "file_receipt_confirmed",
  ])
    await call(
      "creation-events",
      { kind, entityId: source.id, details: {} },
      400,
    );
  await call(
    "creation-events",
    {
      kind: "export_prepared",
      entityId: source.id,
      details: { destination: "menu" },
      eventKey: key,
    },
    400,
  );
  await Promise.all([
    call(`assets/${source.id}/approve`, { accurate: true }),
    call(`assets/${source.id}/approve`, { accurate: true }),
  ]);
  const approvedAt = (
    await one("SELECT approved_at FROM assets WHERE id=?", source.id)
  ).approved_at;
  await call(`assets/${source.id}/approve`, { accurate: true });
  assert.equal(
    (await one("SELECT approved_at FROM assets WHERE id=?", source.id))
      .approved_at,
    approvedAt,
  );
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM events WHERE kind='image_approved' AND entity_id=?",
        source.id,
      )
    ).n,
    1,
  );
  const prepared = {
    kind: "export_prepared",
    entityId: source.id,
    details: { destination: "menu" },
    eventKey: key,
  };
  await call("creation-events", prepared);
  await call("creation-events", prepared);
  const download = {
    ...prepared,
    kind: "export_download_started",
    eventKey: id(),
  };
  await call("creation-events", download);
  await call("creation-events", download);
  await call("creation-events", { ...download, eventKey: id() });
  assert.equal(
    (await one("SELECT count(*) AS n FROM events WHERE kind='export_prepared'"))
      .n,
    1,
  );
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM events WHERE kind='export_download_started'",
      )
    ).n,
    2,
    "One event per actual download attempt, no refresh duplicates.",
  );
  await call(
    "creation-events",
    {
      kind: "export_download_started",
      details: { destination: "photo-set", count: 2 },
    },
    400,
  );
  await run("UPDATE assets SET needs_correction=1 WHERE id=?", source.id);
  await call("creation-events", { ...prepared, eventKey: id() }, 400);
  await run("UPDATE assets SET needs_correction=0 WHERE id=?", source.id);
  const job = await call(
    "jobs",
    {
      dishId: dish.id,
      sourceId: source.id,
      requestKey: id(),
      candidateCount: 1,
      style: styleFor({ ...photoBrief(), look: "menu-wood" }, state.restaurant),
      lookContext: { presetId: "menu-wood" },
      controls: { format: "menu" },
    },
    202,
  );
  await run("UPDATE outputs SET status='failed' WHERE job_id=?", job.id);
  await updateJob(job.id);
  await updateJob(job.id);
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM events WHERE kind='generation_failed'",
      )
    ).n,
    1,
  );
  await run(
    "UPDATE outputs SET status='completed',asset_id=? WHERE job_id=?",
    source.id,
    job.id,
  );
  await updateJob(job.id);
  await updateJob(job.id);
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM events WHERE kind='generation_completed'",
      )
    ).n,
    0,
  );
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM events WHERE kind='generation_recovered'",
      )
    ).n,
    1,
    "Late recovery remains separate from first-attempt success.",
  );
  const records = await all("SELECT details FROM events");
  assert(
    records.every(
      (row) => JSON.parse(row.details).measurementMode === "internal",
    ),
    "Local fixtures cannot label themselves production.",
  );
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM events WHERE json_extract(details,'$.measurementMode')='production'",
      )
    ).n,
    0,
  );
  await run("ALTER TABLE events RENAME TO events_unavailable");
  await updateJob(job.id);
  await run("UPDATE assets SET approved_at=NULL WHERE id=?", source.id);
  await call(`assets/${source.id}/approve`, { accurate: true });
  assert(
    (await one("SELECT approved_at FROM assets WHERE id=?", source.id))
      .approved_at,
    "A newly recorded approval survives an analytics write failure.",
  );
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", job.id)).status,
    "completed",
    "Analytics failure does not fail a completed job.",
  );
  await run("ALTER TABLE events_unavailable RENAME TO events");
  console.log(
    `Photo Studio measurement checks passed: ${checks} API checks plus privacy, identity, deduplication and recovery assertions.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
