import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-studio-progress-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.OPENAI_API_KEY = "fixture-only";
const actualNow = Date.now;
const day = 86400000,
  present = actualNow();
let time = present - 10 * day;
Date.now = () => time;
const { handle } = await import("../lib/server/api.ts");
const { run, one, all, id } = await import("../lib/server/core.ts");
const { updateJob } = await import("../lib/server/generation.ts");
const { photoBrief, styleFor, emptyAdjustments } =
  await import("../lib/studio.ts");
const { photoExportEventKey } = await import("../lib/photo-export-identity.ts");
let cookie = "",
  checks = 0;
globalThis.fetch = () => {
  throw Error("This suite never calls an external service.");
};
async function call(path, data, status = 200) {
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
  const body = await response.json();
  assert.equal(response.status, status, `${path}: ${JSON.stringify(body)}`);
  checks++;
  if (response.headers.has("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  return body;
}
const jpg = readFileSync("public/pasta.jpg");
async function upload(dishId) {
  const body = new FormData();
  body.set("dishId", dishId);
  body.set("file", new File([jpg], "fixture.jpg", { type: "image/jpeg" }));
  body.set(
    "normalized",
    new File([jpg], "working.jpg", { type: "image/jpeg" }),
  );
  return call("assets", body, 201);
}
const sum = (report, key) =>
  report.rows.reduce((value, row) => value + Number(row[key] || 0), 0);
try {
  await call("auth/dev", {});
  const state = await call("state");
  const dish = await call("dishes", {
    name: "Fixture pasta",
    description: "Pasta in its actual bowl",
    confirmed: true,
  });
  const source = await upload(dish.id);
  assert.equal(
    sum(await call("admin/studio-report?mode=internal"), "sources"),
    0,
    "A library upload is not a Studio source draft.",
  );
  const draftId = id(),
    draft = {
      ...photoBrief(),
      dishId: dish.id,
      sourceId: source.id,
      look: "menu-wood",
    };
  let saved = await call("creation-drafts", {
    id: draftId,
    revision: 0,
    kind: "studio",
    draft,
  });
  await call("creation-drafts", {
    id: draftId,
    revision: 0,
    kind: "studio",
    draft,
  });
  const request = {
    studioDraftId: draftId,
    dishId: dish.id,
    sourceId: source.id,
    requestKey: id(),
    candidateCount: 1,
    style: styleFor(draft, state.restaurant),
    lookContext: { presetId: "menu-wood" },
    controls: { format: "menu" },
  };
  const job = await call("jobs", request, 202);
  await call("jobs", request, 202);
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM events WHERE kind='studio_job_linked'",
      )
    ).n,
    1,
  );
  const resultId = id();
  await run(
    "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,mime,name,created_at) VALUES (?,?,?,'generated',?,'image/jpeg','Fixture result',?)",
    resultId,
    state.restaurant.id,
    dish.id,
    "fixture-only.jpg",
    time,
  );
  await run(
    "UPDATE outputs SET asset_id=?,status='completed' WHERE job_id=?",
    resultId,
    job.id,
  );
  await updateJob(job.id);
  await call(`assets/${resultId}/approve`, { accurate: true });
  time += day;
  const key = await photoExportEventKey(resultId, "menu", emptyAdjustments);
  const wrongKey = await photoExportEventKey(resultId, "menu", {
    ...emptyAdjustments,
    x: 25,
  });
  const details = {
    draftId,
    sourceId: source.id,
    destination: "menu",
    exportKey: key,
  };
  await call("creation-events", {
    kind: "export_prepared",
    entityId: resultId,
    details,
    eventKey: key,
  });
  await call("creation-events", {
    kind: "export_download_started",
    entityId: resultId,
    details: { ...details, exportKey: wrongKey },
    eventKey: id(),
  });
  assert.equal(
    sum(await call("admin/studio-report?mode=internal"), "useful_proxy"),
    0,
    "A different crop cannot borrow another file's preparation.",
  );
  const attempt = id();
  await call("creation-events", {
    kind: "export_download_started",
    entityId: resultId,
    details,
    eventKey: attempt,
  });
  await call("creation-events", {
    kind: "export_download_started",
    entityId: resultId,
    details,
    eventKey: attempt,
  });
  let report = await call("admin/studio-report?mode=internal");
  assert.equal(sum(report, "sources"), 1);
  assert.equal(sum(report, "useful_proxy"), 1);
  assert.equal(report.rows[0].average_proxy_ms, day);
  assert.equal(report.rows[0].mature, 0);
  assert.equal(
    sum(await call("admin/studio-report"), "sources"),
    0,
    "Production reports exclude every internal fixture.",
  );
  await run(
    "UPDATE events SET details=json_set(details,'$.measurementMode','production') WHERE kind='studio_source_ready'",
  );
  const mixedMode = await call("admin/studio-report");
  assert.equal(sum(mixedMode, "sources"), 1);
  assert.equal(sum(mixedMode, "requested"), 0);
  assert.equal(sum(mixedMode, "result"), 0);
  assert.equal(
    sum(mixedMode, "useful_proxy"),
    0,
    "Internal job links and exports cannot enter a production source cohort.",
  );
  await run(
    "UPDATE events SET details=json_set(details,'$.measurementMode','internal') WHERE kind='studio_source_ready'",
  );
  const replacement = await upload(dish.id);
  saved = await call("creation-drafts", {
    id: draftId,
    revision: saved.revision,
    kind: "studio",
    draft: { ...draft, sourceId: replacement.id },
  });
  for (const kind of ["export_prepared", "export_download_started"])
    await call("creation-events", {
      kind,
      entityId: resultId,
      details: { ...details, sourceId: replacement.id },
      eventKey: kind === "export_prepared" ? key : id(),
    });
  const unrelated = await call("admin/studio-report?mode=internal");
  assert.equal(sum(unrelated, "prepared"), 1);
  assert.equal(
    sum(unrelated, "useful_proxy"),
    1,
    "An export inside the follow-up window must still belong to the exact source family.",
  );
  await call("jobs", { ...request, requestKey: id() }, 409);
  await call(
    "jobs",
    { ...request, studioDraftId: id(), requestKey: id() },
    400,
  );
  saved = await call("creation-drafts", {
    id: draftId,
    revision: saved.revision,
    kind: "studio",
    draft,
  });
  assert.equal(
    sum(await call("admin/studio-report?mode=internal"), "sources"),
    2,
    "Reattaching the same original does not create a third cohort.",
  );
  time = present;
  await call("auth/dev", {});
  const guestDraftId = id();
  await call("creation-drafts", {
    id: guestDraftId,
    revision: 0,
    kind: "studio",
    draft: { ...draft, measurementOrigin: "guest" },
  });
  await call("jobs", { ...request, studioDraftId: guestDraftId }, 202);
  let resumed = (await call("admin/studio-report?mode=internal")).rows.find(
    (row) => row.guest,
  );
  assert.equal(
    resumed.requested,
    0,
    "Replaying an old logical job in another draft is not a new creation.",
  );
  assert.equal(resumed.reused, 1);
  const reused = await call(
    "jobs",
    { ...request, studioDraftId: guestDraftId, requestKey: id() },
    202,
  );
  assert.equal(
    reused.id,
    job.id,
    "Draft measurement context never changes the image fingerprint.",
  );
  assert.equal(reused.reused, true);
  const guestDetails = { ...details, draftId: guestDraftId };
  await call("creation-events", {
    kind: "export_prepared",
    entityId: resultId,
    details: guestDetails,
    eventKey: key,
  });
  await call("creation-events", {
    kind: "export_download_started",
    entityId: resultId,
    details: guestDetails,
    eventKey: id(),
  });
  assert.equal(
    (await one("SELECT count(*) AS n FROM events WHERE kind='export_prepared'"))
      .n,
    1,
    "One prepared-file identity across repeat contexts.",
  );
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM events WHERE kind='studio_export_linked' AND json_extract(details,'$.sourceId')=?",
        source.id,
      )
    ).n,
    2,
    "The prepared file is linked independently to each actual draft use.",
  );
  report = await call("admin/studio-report?mode=internal");
  const mature = report.rows.find((row) => row.mature && !row.guest);
  const pending = report.rows.find((row) => !row.mature && row.guest);
  assert.deepEqual([mature.sources, mature.useful_proxy], [2, 1]);
  assert.deepEqual(
    [pending.sources, pending.reused, pending.requested, pending.useful_proxy],
    [1, 1, 0, 1],
  );
  assert.equal(sum(report, "sources"), 3);
  await call("creation-events", {
    kind: "handoff_started",
    entityId: resultId,
    details: { draftId, sourceId: replacement.id, destination: "post" },
    eventKey: id(),
  });
  assert.equal(
    sum(await call("admin/studio-report?mode=internal"), "useful_proxy"),
    2,
    "An unrelated original cannot claim another source's output or a late handoff.",
  );
  const legacyId = id();
  await run(
    "INSERT INTO creation_drafts (id,restaurant_id,kind,draft,updated_at) VALUES (?,?,'studio',?,?)",
    legacyId,
    state.restaurant.id,
    JSON.stringify(draft),
    present - 100 * day,
  );
  await call("creation-drafts", {
    id: legacyId,
    revision: 1,
    kind: "studio",
    draft: { ...draft, note: "New note on old work" },
  });
  assert.equal(
    sum(await call("admin/studio-report?mode=internal"), "sources"),
    3,
    "Resaving legacy work does not invent a new source-ready timestamp.",
  );
  const editDraftId = id();
  await call("creation-drafts", {
    id: editDraftId,
    revision: 0,
    kind: "studio",
    draft: { ...draft, sourceId: replacement.id },
  });
  let editParent = replacement.id;
  for (let version = 0; version < 2; version++) {
    const editId = id(),
      form = new FormData();
    form.set("parentId", editParent);
    form.set(
      "file",
      new File([jpg], "edited-fixture.jpg", { type: "image/jpeg" }),
    );
    form.set("requestKey", editId);
    form.set("edits", JSON.stringify({ brightness: 110 + version }));
    await call("photo-edits", form);
    await call(`assets/${editId}/approve`, { accurate: true });
    await call("creation-events", {
      kind: "handoff_started",
      entityId: editId,
      details: {
        draftId: editDraftId,
        sourceId: replacement.id,
        destination: "post",
      },
      eventKey: id(),
    });
    editParent = editId;
  }
  const edited = await call("admin/studio-report?mode=internal");
  const editedRow = edited.rows.find((row) => !row.guest && !row.mature);
  assert.deepEqual(
    [
      editedRow.sources,
      editedRow.requested,
      editedRow.result,
      editedRow.approved,
      editedRow.useful_proxy,
    ],
    [1, 0, 0, 1, 1],
    "Two reviewed edit generations remain one source outcome without inventing an AI result.",
  );
  await call("admin/studio-report?days=91", undefined, 400);
  await call("admin/studio-report?mode=all", undefined, 400);
  await run("PRAGMA optimize");
  const plan = await all(
    "EXPLAIN QUERY PLAN SELECT id FROM events WHERE kind='studio_source_ready' AND created_at>=? AND created_at<=?",
    present - 30 * day,
    present,
  );
  assert(
    plan.some((row) => row.detail.includes("idx_events_kind_created")),
    "The cohort window uses its range index.",
  );
  await run("UPDATE users SET role='owner' WHERE id=?", state.user.id);
  await call("admin/studio-report", undefined, 403);
  console.log(
    `Photo Studio progress: ${checks} API checks plus source-version, seven-day cohort, exact-export, cached-reuse, legacy and access assertions passed.`,
  );
} finally {
  Date.now = actualNow;
  rmSync(root, { recursive: true, force: true });
}
