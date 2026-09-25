import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-studio-experience-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.LOCAL_DEVELOPMENT = "true";
process.env.OPENAI_API_KEY = "fixture-only";
const { handle } = await import("../lib/server/api.ts");
const { PUT } = await import("../app/api/[...path]/route.ts");
assert.equal(
  PUT,
  handle,
  "The deployed route must expose the library update method",
);
const { run, one, digest, id } = await import("../lib/server/core.ts");
const {
  photoBrief,
  photoStyles,
  styleFor,
  studioDishRequest,
  adjustedPhotoSize,
} = await import("../lib/studio.ts");
const { findStyles, studioLookPatch, startingLooks, lookExpectations } =
  await import("../lib/studio-discovery.ts");
const { emptyStudioLibrary, recipeFromDraft, applySavedLook } =
  await import("../lib/studio-library.ts");
const { activeInspirationId, inspirationPatch } =
  await import("../lib/studio-reference.ts");
const { failedImageRequest } = await import("../lib/photo-recipe.ts");
let cookie = "",
  checks = 0;
globalThis.fetch = () => {
  throw Error("This suite must not call an external service.");
};
async function call(
  path,
  data,
  status = 200,
  method = data === undefined ? "GET" : "POST",
) {
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method,
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
  // Photo Studio never renames or rewrites a saved dish (and so its live
  // menu items); only a new dish takes the studio's name and description.
  for (const brief of [
    { ...photoBrief(), dishId: "saved-dish" },
    {
      ...photoBrief(),
      dishId: "saved-dish",
      mode: "description",
      name: "Studio wording",
      description: "On slate, 45° angle",
    },
  ])
    assert.equal(studioDishRequest(brief, {}), null);
  assert.deepEqual(studioDishRequest(photoBrief(), {}), {
    name: "Untitled dish",
    description: "",
    confirmed: true,
    setting: styleFor(photoBrief(), {}).photoStyle,
  });
  assert.equal(
    studioDishRequest(
      {
        ...photoBrief(),
        mode: "description",
        name: " Roasted tomato pasta ",
        description: "Penne, roasted tomatoes and basil",
      },
      {},
    ).description,
    "Penne, roasted tomatoes and basil",
    "A new described dish keeps the owner's description",
  );
  const freshSample = studioDishRequest(
    { ...photoBrief(), dishId: "saved-dish", name: "Margherita" },
    {},
    { name: "Sample burger", sample: true },
  );
  assert.equal(freshSample.name, "Sample burger");
  assert.equal(freshSample.sample, true, "A sample always starts a new dish");
  assert.equal(freshSample.description, "");
  // Quick adjustments save only the crop's real pixels. A 1.6× wide crop of
  // a 1536 px square has 960 × 540 pixels of detail, below DoorDash's
  // minimum, and must not be enlarged into a version that passes it.
  const square = { width: 1536, height: 1536 };
  assert.deepEqual(
    adjustedPhotoSize("doordash", square, { fit: false, zoom: 1.6 }),
    { width: 960, height: 540 },
  );
  assert.deepEqual(adjustedPhotoSize("doordash", square, { fit: false }), {
    width: 1536,
    height: 864,
  });
  assert.deepEqual(
    adjustedPhotoSize("story", square, { fit: true }),
    { width: 1152, height: 2048 },
    "A fitted photo keeps its full size inside a taller frame, up to 2048 px",
  );
  assert.deepEqual(
    adjustedPhotoSize("menu", { width: 3000, height: 2000 }, { fit: false }),
    { width: 2000, height: 2000 },
  );
  assert.deepEqual(adjustedPhotoSize("menu", { width: 4000, height: 4000 }), {
    width: 2048,
    height: 2048,
  });
  for (const format of ["menu", "feed", "story", "doordash", "uber", "toast"])
    for (const zoom of [1, 1.3, 2])
      for (const fit of [true, false]) {
        const size = adjustedPhotoSize(format, square, { fit, zoom });
        const scale =
          (fit ? Math.min : Math.max)(size.width / 1536, size.height / 1536) *
          zoom;
        assert(scale <= 1 + 1e-9, `${format} ${zoom}× is never enlarged`);
        assert(Math.max(size.width, size.height) <= 2048);
      }
  const referenceBase = {
    ...photoBrief(),
    ...studioLookPatch(photoBrief(), "menu-wood"),
    sourceId: "original-source",
    dishId: "original-dish",
    resultId: "approved-result",
    jobId: "historical-job",
    surface: "Pale stone",
    plate: "white",
    angle: "overhead",
    studioOverrides: ["surface", "plate", "angle"],
    note: "Leave room on the left",
    adjustments: { ...photoBrief().adjustments, brightness: 120 },
    savedLookId: "saved-recipe",
    photoStyleSnapshot: "Saved style wording",
    photoReferenceIds: ["old-reference"],
    requestKey: "old-request",
  };
  const beforeReference = structuredClone(referenceBase);
  const referencePatch = inspirationPatch(referenceBase, "new-reference");
  const withReference = { ...referenceBase, ...referencePatch };
  assert.equal(withReference.look, "reference");
  assert.equal(activeInspirationId(withReference), "new-reference");
  assert.deepEqual(styleFor(withReference, {}).referenceIds, ["new-reference"]);
  assert.equal(withReference.photoStyleSnapshot, null);
  assert.equal(withReference.savedLookId, "");
  assert.equal(withReference.requestKey, "");
  for (const key of [
    "surface",
    "plate",
    "angle",
    "note",
    "adjustments",
    "studioOverrides",
  ])
    assert.deepEqual(
      withReference[key],
      referenceBase[key],
      `Inspiration preserves explicit ${key}`,
    );
  for (const key of ["sourceId", "dishId", "resultId", "jobId"])
    assert.equal(
      key in referencePatch,
      false,
      `Inspiration never overwrites ${key}`,
    );
  assert.deepEqual(
    referenceBase,
    beforeReference,
    "Reviewing inspiration does not mutate the starting recipe",
  );
  referencePatch.studioOverrides.push("lighting");
  referencePatch.adjustments.brightness = 90;
  assert.deepEqual(
    referenceBase,
    beforeReference,
    "The temporary reference recipe owns its editable arrays and crop",
  );
  const removed = {
    ...withReference,
    ...inspirationPatch(withReference, null),
  };
  assert.equal(activeInspirationId(removed), "");
  assert.deepEqual(styleFor(removed, {}).referenceIds, []);
  assert.equal(removed.referenceId, "");
  assert.equal(removed.sourceId, "original-source");
  assert.equal(removed.resultId, "approved-result");
  const restaurantReference = {
    style: { referenceIds: ["restaurant-reference"] },
  };
  const restaurantDraft = { ...photoBrief(), look: "restaurant" };
  assert.equal(
    activeInspirationId(restaurantDraft, restaurantReference),
    "restaurant-reference",
  );
  assert.equal(
    activeInspirationId(
      { ...restaurantDraft, photoReferenceIds: [] },
      restaurantReference,
    ),
    "",
    "Explicit removal never falls back to a restaurant reference",
  );
  assert.equal(
    activeInspirationId({ ...photoBrief(), referenceId: "unused-reference" }),
    "",
    "An attached but unused reference is not displayed as active",
  );
  const detachedSaved = {
    ...referenceBase,
    ...inspirationPatch(referenceBase, null),
  };
  assert.equal(detachedSaved.look, referenceBase.look);
  assert.equal(
    detachedSaved.photoStyleSnapshot,
    referenceBase.photoStyleSnapshot,
    "Removing a reference keeps the saved style's lighting and setting",
  );
  assert.equal(activeInspirationId(detachedSaved), "");
  const reviewedExisting = {
    ...referenceBase,
    ...inspirationPatch(referenceBase, "old-reference", true),
  };
  assert.equal(
    reviewedExisting.look,
    referenceBase.look,
    "Reviewing an unchanged reference does not replace the selected look",
  );
  assert.equal(
    reviewedExisting.photoStyleSnapshot,
    referenceBase.photoStyleSnapshot,
  );
  assert.equal(reviewedExisting.savedLookId, referenceBase.savedLookId);
  assert.equal(photoBrief().look, "keep");
  assert.equal(photoBrief().plate, "keep");
  assert.equal(
    startingLooks(
      photoBrief(),
      [],
      {
        id: "named",
        name: "Our look",
        cue: "",
        group: "Saved",
        image: "",
        prompt: "",
      },
      ["menu-wood"],
    ).length,
    3,
    "A named look keeps three distinct recommendations after excluding its base preset",
  );
  assert.equal(findStyles("Neighborhood table")[0].id, "menu-wood");
  assert(findStyles("warm wood").some((look) => look.id === "menu-wood"));
  assert(
    !findStyles("warm wood").some((look) => look.id === "beverage-sunshine"),
    "Wood must not typo-match food when literal wood results exist",
  );
  assert(findStyles("café").some((look) => look.id === "beverage-cafe"));
  assert(findStyles("charcol").some((look) => look.id === "studio-dark"));
  assert.deepEqual(findStyles("nonexistent-penguin-style"), []);
  assert.deepEqual(
    findStyles("warm wood").map((look) => look.id),
    findStyles("warm wood").map((look) => look.id),
  );
  assert.deepEqual(
    startingLooks(photoBrief(), []).map((look) => look.id),
    ["keep", "menu-wood", "delivery-white"],
  );
  assert(
    startingLooks({ ...photoBrief(), family: "Drinks" }, [])
      .slice(1)
      .every((look) => ["bar", "beverage"].includes(look.category)),
  );
  const draft = {
    ...photoBrief(),
    plate: "white",
    surface: "Warm wood",
    lighting: "Warm & cozy",
    studioOverrides: ["plate", "surface"],
  };
  const changed = studioLookPatch(draft, "studio-dark");
  assert.equal(changed.plate, "white");
  assert.equal(changed.surface, "Warm wood");
  assert.equal(changed.lighting, "As shown");
  assert.equal(changed.angle, "keep");
  assert.equal(
    studioLookPatch({ ...draft, studioOverrides: [] }, "delivery-overhead")
      .angle,
    "keep",
  );
  assert.equal(studioLookPatch(draft, "studio-dark").photoStyleSnapshot, null);
  for (const id of [
    "delivery-takeout",
    "delivery-paper",
    "delivery-graphite",
    "studio-chrome",
    "bakery-rustic",
    "fine-linen",
  ]) {
    assert.equal(
      studioLookPatch(photoBrief(), id).plate,
      "style",
      `${id} must apply its explicit food serving ware to a plate upload`,
    );
    for (const plate of ["keep", "white"]) {
      assert.equal(
        studioLookPatch(
          { ...photoBrief(), plate, studioOverrides: ["plate"] },
          id,
        ).plate,
        plate,
        `${id} must retain a deliberate serving-ware override`,
      );
    }
  }
  for (const style of photoStyles) {
    const expectation = lookExpectations(photoBrief(), style.id);
    assert.equal(
      expectation.rows.find((row) => row.label === "Serving dish").value,
      style.plate === "style" ? "Follow this look" : "Keep your serving dish",
      `${style.id} must describe its effective serving-ware choice`,
    );
    assert.equal(
      expectation.rows.find((row) => row.label === "Camera angle").value,
      "Keep your original angle",
      `${style.id} must not imply that an example angle is applied by default`,
    );
    assert.equal(expectation.angleChanged, false);
    assert.equal(
      studioLookPatch({ ...photoBrief(), family: "Drinks" }, style.id).plate,
      "keep",
      `${style.id} must not replace an uploaded drink's vessel by default`,
    );
    if (["bar", "beverage"].includes(style.category)) {
      assert.equal(
        studioLookPatch({ ...photoBrief(), plate: "style" }, style.id).plate,
        "keep",
        `${style.id} on food must preserve the food's original plate`,
      );
    }
  }
  const expectationDraft = structuredClone(draft);
  const expectation = lookExpectations(draft, "delivery-overhead");
  assert.deepEqual(
    expectation.rows
      .filter((row) => row.custom)
      .map((row) => [row.label, row.value]),
    [
      ["Setting", "Warm wood"],
      ["Serving dish", "Simple white serving dish"],
    ],
  );
  assert.equal(
    expectation.rows.find((row) => row.label === "Light").value,
    "Follow this look",
    "Uncommitted/implicit values must not appear as retained overrides",
  );
  assert.deepEqual(
    draft,
    expectationDraft,
    "Inspecting a style must not change the current draft",
  );
  const drinkExpectation = lookExpectations(
    { ...draft, family: "Drinks" },
    "studio-dark",
  );
  assert.equal(
    drinkExpectation.rows.find((row) => row.label === "Glass").value,
    "Keep your glass",
  );
  assert.equal(
    drinkExpectation.vesselConflict,
    true,
    "Retained incompatible ware must be explained before creating",
  );
  const angleExpectation = lookExpectations(
    {
      ...draft,
      angle: "overhead",
      composition: "Space above for a headline",
      studioOverrides: ["angle", "composition"],
    },
    "menu-wood",
  );
  assert.equal(angleExpectation.angleChanged, true);
  assert.equal(angleExpectation.framing, "Space above for a headline");
  const illustrationExpectation = lookExpectations(
    { ...photoBrief(), mode: "description" },
    "menu-wood",
  );
  assert.equal(illustrationExpectation.fromPhoto, false);
  assert.equal(
    illustrationExpectation.rows.find((row) => row.label === "Serving dish")
      .value,
    "Follow this look",
    "Description mode must not claim to preserve a supplied photo",
  );
  await call("studio-library", undefined, 401);
  await call("auth/dev", {});
  const state = await call("state");
  const initial = await call("studio-library");
  assert.equal(initial.revision, 0);
  assert.deepEqual(initial.favorites, []);
  const named = {
    id: id(),
    name: "Evening menu",
    recipe: recipeFromDraft({ ...draft, look: "menu-wood" }, state.restaurant),
    previewAssetId: null,
    archived: false,
  };
  const library = {
    ...emptyStudioLibrary(),
    favorites: ["menu-wood", "menu-wood"],
    looks: [named],
  };
  let saved = await call(
    "studio-library",
    { revision: 0, library },
    200,
    "PUT",
  );
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.favorites, ["menu-wood"]);
  assert.equal(saved.defaultLookId, null);
  const applied = applySavedLook(named);
  assert.equal(applied.plate, "white");
  assert.equal(
    styleFor(applied, { style: { photoStyle: "Different restaurant default" } })
      .photoStyle,
    named.recipe.photoStyleSnapshot,
  );
  assert.equal(
    (await call("studio-library", { revision: 0, library }, 200, "PUT"))
      .revision,
    1,
    "Lost-response retry must not create another version",
  );
  await call(
    "studio-library",
    { revision: 0, library: { ...library, defaultLookId: named.id } },
    409,
    "PUT",
  );
  saved = await call(
    "studio-library",
    { revision: 1, library: { ...library, defaultLookId: named.id } },
    200,
    "PUT",
  );
  assert.equal(saved.defaultLookId, named.id);
  await call(
    "studio-library",
    {
      revision: 2,
      library: {
        ...library,
        defaultLookId: named.id,
        looks: [{ ...named, archived: true }],
      },
    },
    400,
    "PUT",
  );
  saved = await call(
    "studio-library",
    {
      revision: 2,
      library: { ...library, looks: [{ ...named, archived: true }] },
    },
    200,
    "PUT",
  );
  assert.equal(saved.looks[0].archived, true);
  assert.equal(saved.defaultLookId, null);
  saved = await call("studio-library", { revision: 3, library }, 200, "PUT");
  assert.equal(saved.looks[0].archived, false);
  await call(
    "studio-library",
    { revision: 4, library: { ...library, looks: [named, named] } },
    400,
    "PUT",
  );
  await call(
    "studio-library",
    {
      revision: 4,
      library: {
        ...library,
        looks: [
          { ...named, recipe: { ...named.recipe, photoReferenceIds: [id()] } },
        ],
      },
    },
    400,
    "PUT",
  );
  await call(
    "studio-library",
    {
      revision: 4,
      library: { ...library, looks: [{ ...named, name: "   " }] },
    },
    400,
    "PUT",
  );
  const ownerCookie = cookie,
    secondUser = id(),
    secondRestaurant = id(),
    session = id();
  await run(
    "INSERT INTO users (id,email,password,created_at) VALUES (?,?,?,?)",
    secondUser,
    "second@studio.test",
    "unused-fixture",
    Date.now(),
  );
  await run(
    "INSERT INTO restaurants (id,user_id,name,slug,created_at) VALUES (?,?,?,?,?)",
    secondRestaurant,
    secondUser,
    "Other restaurant",
    "other-studio",
    Date.now(),
  );
  await run(
    "INSERT INTO sessions (hash,user_id,expires_at) VALUES (?,?,?)",
    digest(session),
    secondUser,
    Date.now() + 60000,
  );
  cookie = "menu_material_session=" + session;
  assert.deepEqual(
    (await call("studio-library")).looks,
    [],
    "Saved looks are isolated by authenticated restaurant",
  );
  await call(
    "studio-library",
    {
      revision: 0,
      library: { ...emptyStudioLibrary(), favorites: ["studio-dark"] },
    },
    200,
    "PUT",
  );
  cookie = ownerCookie;
  assert.equal((await call("studio-library")).looks[0].name, "Evening menu");
  assert.deepEqual((await call("studio-library")).favorites, ["menu-wood"]);
  const dish = await call("dishes", {
    name: "Fixture pasta",
    description: "Pasta",
    confirmed: true,
  });
  const form = new FormData(),
    bytes = readFileSync("public/pasta.jpg");
  form.set("file", new File([bytes], "pasta.jpg", { type: "image/jpeg" }));
  form.set(
    "normalized",
    new File([bytes], "working.jpg", { type: "image/jpeg" }),
  );
  form.set("dishId", dish.id);
  const asset = await call("assets", form, 201);
  let correctionSourceId = "";
  for (const format of ["toast", "door"]) {
    const job = await call(
      "jobs",
      {
        dishId: dish.id,
        sourceId: asset.id,
        requestKey: id(),
        candidateCount: 1,
        controls: { format, plate: format === "door" ? "style" : "keep" },
        style: styleFor({ look: "delivery-takeout" }, {}),
      },
      202,
    );
    const details = JSON.parse(
      (await one("SELECT details FROM jobs WHERE id=?", job.id)).details,
    );
    assert.equal(
      details.controls.format,
      format === "door" ? "doordash" : "toast",
    );
    if (format === "door") correctionSourceId = job.id;
  }
  const correctionState = await call("state");
  const { updateJob } = await import("../lib/server/generation.ts");
  const { restoreCorrectionCredit } =
    await import("../lib/server/correction-policy.ts");
  const { preferredPhoto } = await import("../lib/dish-library.ts");
  const originalJob = correctionState.jobs.find(
      (job) => job.id === correctionSourceId,
    ),
    resultAsset = id();
  await run(
    "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,mime,name,created_at,approved_at) VALUES (?,?,?,'generated',?,'image/jpeg','Result',?,?)",
    resultAsset,
    correctionState.restaurant.id,
    dish.id,
    "fixture-result",
    Date.now(),
    Date.now(),
  );
  await run(
    "UPDATE outputs SET status='completed',asset_id=? WHERE job_id=?",
    resultAsset,
    originalJob.id,
  );
  await updateJob(originalJob.id);
  // Each photo arrives with its own history, so the page never depends on
  // the recent-requests list to tell a real DoorDash photo from an
  // illustration.
  const withHistory = (await call("state")).assets.find(
    (entry) => entry.id === resultAsset,
  );
  assert.equal(withHistory.from_photo, true);
  assert.equal(withHistory.photo_format, "doordash");
  assert.equal(withHistory.look_id, "delivery-takeout");
  assert.equal(
    (await call("state")).assets.find((entry) => entry.id === asset.id).look_id,
    "keep",
  );
  await run(
    "UPDATE restaurants SET allowance=2 WHERE id=?",
    correctionState.restaurant.id,
  );
  assert.equal((await call("state")).remaining, 0);
  assert.equal(
    (await call(`photo-corrections/${resultAsset}`)).status,
    "eligible",
  );
  await call(`photo-corrections/${resultAsset}`, {
    reason: "branding",
    detail: "Keep the label on the original.",
  });
  const report = await call(`photo-corrections/${resultAsset}/create`, {});
  const replay = await call(`photo-corrections/${resultAsset}/create`, {});
  assert.equal(
    report.jobId,
    replay.jobId,
    "A correction request must be idempotent",
  );
  assert.equal(
    (await call("state")).remaining,
    0,
    "A complimentary correction works with zero ordinary allowance",
  );
  const correctionJob = await one(
    "SELECT * FROM jobs WHERE id=?",
    report.jobId,
  );
  assert.equal(correctionJob.source_id, asset.id);
  assert.equal(correctionJob.parent_id, null);
  assert(correctionJob.credit_period.startsWith("complimentary:"));
  const correctedDetails = JSON.parse(correctionJob.details);
  assert.equal(
    correctedDetails.controls.plate,
    "style",
    "A food correction must not silently put a takeout meal back on its source plate",
  );
  assert.match(correctedDetails.style.photoStyle, /kraft takeout box/);
  const rejected = await one("SELECT * FROM assets WHERE id=?", resultAsset);
  assert.equal(rejected.needs_correction, 1);
  assert(
    rejected.approved_at,
    "Reporting must retain published asset approval",
  );
  assert.equal(
    preferredPhoto({ id: dish.id }, [
      rejected,
      { id: asset.id, dish_id: dish.id, kind: "source" },
    ]).id,
    asset.id,
  );
  cookie = "menu_material_session=" + session;
  await call(`photo-corrections/${resultAsset}`, undefined, 404);
  cookie = ownerCookie;
  await run("UPDATE outputs SET status='failed' WHERE job_id=?", report.jobId);
  await updateJob(report.jobId);
  assert.equal(
    (await call(`photo-corrections/${resultAsset}`)).status,
    "credited",
  );
  assert.equal(
    (await call("state")).remaining,
    1,
    "Failed correction restores the original allowance once",
  );
  await restoreCorrectionCredit(originalJob.id);
  await updateJob(report.jobId);
  assert.equal(
    (await call("state")).remaining,
    1,
    "Repeated recovery cannot duplicate credit",
  );
  await call(`photo-corrections/${resultAsset}/create`, {}, 409);
  const { retryFailed } = await import("../lib/server/menu-tools.ts");
  await assert.rejects(
    () => retryFailed(correctionState.restaurant, report.jobId),
    /complimentary correction/,
  );
  for (let i = 0; i < 3; i++) {
    const rootJob = id();
    await run(
      "INSERT INTO jobs (id,restaurant_id,dish_id,request_key,fingerprint,prompt,details,input_method,source_id,status,created_at) VALUES (?,?,?,?,?,'','{}','photo',?,'completed',?)",
      rootJob,
      correctionState.restaurant.id,
      dish.id,
      id(),
      id(),
      asset.id,
      Date.now(),
    );
    await run(
      "INSERT INTO outputs (id,job_id,restaurant_id,slot,status,asset_id,created_at) VALUES (?,?,?,0,'completed',?,?)",
      id(),
      rootJob,
      correctionState.restaurant.id,
      resultAsset,
      Date.now(),
    );
    await run(
      "INSERT INTO photo_corrections (original_job_id,restaurant_id,reported_asset_id,reason,status,created_at,updated_at) VALUES (?,?,?,'ingredients','ready',?,?)",
      rootJob,
      correctionState.restaurant.id,
      resultAsset,
      Date.now(),
      Date.now(),
    );
    const restored = await restoreCorrectionCredit(rootJob);
    assert.equal(
      restored.status,
      i < 2 ? "credited" : "review",
      "The fourth recovery in 30 days enters real review",
    );
  }
  await call(
    "creation-events",
    {
      kind: "export_download_started",
      entityId: resultAsset,
      details: { destination: "menu" },
    },
    400,
  ); // A reported inaccurate result cannot enter the export-success funnel.
  await call("studio-library/import-favorites", {
    favorites: ["studio-dark", "menu-wood"],
  });
  await call("studio-library/import-favorites", { favorites: ["studio-dark"] });
  assert.deepEqual(
    new Set((await call("studio-library")).favorites),
    new Set(["menu-wood", "studio-dark"]),
  );
  const beforeRecipe = await call("studio-library");
  const originalRecipe = structuredClone(beforeRecipe.looks[0].recipe);
  const updatedLook = {
    ...beforeRecipe.looks[0],
    recipe: { ...originalRecipe, surface: "Pale stone" },
  };
  const versioned = await call(
    "studio-library",
    {
      revision: beforeRecipe.revision,
      library: { ...beforeRecipe, looks: [updatedLook] },
    },
    200,
    "PUT",
  );
  assert.equal(versioned.looks[0].version, beforeRecipe.looks[0].version + 1);
  assert.equal(
    originalRecipe.surface,
    "Warm wood",
    "Editing a look cannot mutate an existing captured recipe",
  );
  const replayVersion = await call(
    "studio-library",
    {
      revision: beforeRecipe.revision,
      library: { ...beforeRecipe, looks: [updatedLook] },
    },
    200,
    "PUT",
  );
  assert.equal(
    replayVersion.revision,
    versioned.revision,
    "Lost-response replay does not create another look version",
  );
  const { studioOccasions } = await import("../lib/studio-occasions.ts");
  assert.equal(studioOccasions.length, 4);
  assert(findStyles("foodball sunday").some((look) => look.id === "menu-wood"));
  for (const occasion of studioOccasions) {
    assert.equal(new Set(occasion.looks).size, 3);
    for (const id of occasion.looks)
      assert(photoStyles.some((style) => style.id === id));
  }
  const transferDishId = id();
  const repeatedDishes = await Promise.all([
    call("dishes", {
      creationId: transferDishId,
      name: "Transferred soup",
      confirmed: true,
    }),
    call("dishes", {
      creationId: transferDishId,
      name: "Transferred soup",
      confirmed: true,
    }),
  ]);
  assert.equal(repeatedDishes[0].id, repeatedDishes[1].id);
  const uploadIntent = id();
  form.set("requestKey", uploadIntent);
  const uploadCopies = await Promise.all([
    call("assets", form, 201),
    call("assets", form, 201),
  ]);
  assert.equal(
    uploadCopies[0].id,
    uploadCopies[1].id,
    "Concurrent guest uploads resolve to one asset",
  );
  assert.equal(
    (await call("assets", form, 201)).id,
    uploadCopies[0].id,
    "Interrupted response replay returns the same asset",
  );
  form.set("dishId", transferDishId);
  await call("assets", form, 409);
  cookie = "menu_material_session=" + session;
  await call(
    "dishes",
    { creationId: transferDishId, name: "Cannot overwrite another restaurant" },
    404,
  );
  await run(
    "UPDATE restaurants SET style=? WHERE id=?",
    JSON.stringify({
      photoPreset: "menu-wood",
      photoStyle: photoStyles.find((look) => look.id === "menu-wood").prompt,
      autoApply: false,
    }),
    secondRestaurant,
  );
  const migrated = await call("studio-library");
  assert.equal(migrated.looks[0].name, "Original restaurant look");
  assert.equal(
    migrated.defaultLookId,
    null,
    "Migration must retain a disabled default",
  );
  assert.equal(
    (await call("studio-library")).looks.length,
    1,
    "Legacy migration runs once",
  );
  cookie = ownerCookie;
  const context = await call(`assets/${resultAsset}/context`);
  assert.equal(context.jobId, originalJob.id);
  assert.equal(context.sourceId, asset.id);
  assert.equal(
    context.details.controls.format,
    JSON.parse(originalJob.details).controls.format,
  );
  await run(
    "UPDATE restaurants SET allowance=30 WHERE id=?",
    state.restaurant.id,
  );
  // Try again after a failed "Change the setting with AI", even after a
  // reload, resends that change to that photo, not a restyle of the original.
  const failedChange = await call(
    "jobs",
    {
      dishId: dish.id,
      sourceId: asset.id,
      parentId: resultAsset,
      revision: "Remove the napkin and use softer window light.",
      requestKey: id(),
      candidateCount: 1,
      controls: { format: "doordash", plate: "keep", cropX: 30, zoom: 1.2 },
      style: styleFor({ look: "menu-wood" }, {}),
      lookContext: { presetId: "menu-wood", occasionId: "", overrides: [] },
    },
    202,
  );
  await run(
    "UPDATE outputs SET status='failed',error='Image creation failed. This image was not counted.' WHERE job_id=?",
    failedChange.id,
  );
  await updateJob(failedChange.id);
  const failedRow = (await call("state")).jobs.find(
    (job) => job.id === failedChange.id,
  );
  assert.equal(failedRow.status, "failed");
  const again = await call(
    "jobs",
    { ...failedImageRequest(failedRow), requestKey: id() },
    202,
  );
  const resent = await one("SELECT * FROM jobs WHERE id=?", again.id);
  assert.notEqual(resent.id, failedChange.id, "A new request is made");
  assert.equal(resent.parent_id, resultAsset);
  assert.equal(resent.source_id, asset.id);
  assert.equal(resent.prompt, "Remove the napkin and use softer window light.");
  assert.equal(
    resent.fingerprint,
    failedRow.fingerprint,
    "The same photo, change, style and controls are sent again",
  );
  await run("UPDATE outputs SET status='failed' WHERE job_id=?", resent.id);
  await updateJob(resent.id);
  // A failed complimentary correction is never resent as a paid image.
  assert.equal(
    failedImageRequest({
      ...failedRow,
      details: JSON.stringify({ correctionFor: originalJob.id }),
    }),
    null,
  );
  assert.equal(
    failedImageRequest({
      ...failedRow,
      credit_period: `complimentary:${originalJob.id}`,
    }),
    null,
  );
  const batchItems = [];
  for (let i = 0; i < 8; i++) {
    const dishId = id(),
      sourceId = id();
    await run(
      "INSERT INTO dishes (id,restaurant_id,name,description,confirmed_at,created_at) VALUES (?,?,?,'',?,?)",
      dishId,
      state.restaurant.id,
      `Set dish ${i}`,
      Date.now(),
      Date.now(),
    );
    await run(
      "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,mime,name,created_at) VALUES (?,?,?,'source',?,'image/jpeg','Source',?)",
      sourceId,
      state.restaurant.id,
      dishId,
      "fixture-source",
      Date.now(),
    );
    batchItems.push({ dishId, sourceId });
  }
  const batchKey = id(),
    recipe = recipeFromDraft(
      {
        ...photoBrief(),
        look: "menu-wood",
        surface: "Pale stone",
        plate: "keep",
      },
      state.restaurant,
    );
  const photoSet = await call("photo-batches", {
    batchId: batchKey,
    items: batchItems,
    style: styleFor(recipe, state.restaurant),
    recipe,
  });
  assert.equal(photoSet.batch.items.length, 8);
  assert.equal(photoSet.batch.settings.controls.surface, "Pale stone");
  assert.equal(photoSet.batch.settings.controls.plate, "keep");
  const setBalance = (await call("state")).remaining;
  assert.equal(
    (await one("SELECT COUNT(*) n FROM batch_items WHERE batch_id=?", batchKey))
      .n,
    0,
    "The remaining set cannot reserve before sample approval",
  );
  await call(`photo-batches/${batchKey}/continue`, { remainingCount: 7 }, 400);
  const sampleAsset = id();
  await run(
    "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,mime,name,created_at,approved_at) VALUES (?,?,?,'generated',?,'image/jpeg','Sample',?,?)",
    sampleAsset,
    state.restaurant.id,
    batchItems[0].dishId,
    "fixture-sample",
    Date.now(),
    Date.now(),
  );
  await run(
    "UPDATE outputs SET status='completed',asset_id=? WHERE job_id=?",
    sampleAsset,
    photoSet.batch.sampleJobId,
  );
  await updateJob(photoSet.batch.sampleJobId);
  await call(`photo-batches/${batchKey}/continue`, { remainingCount: 6 }, 400);
  await call(`photo-batches/${batchKey}/continue`, { remainingCount: 7 });
  const { advanceBatches } = await import("../lib/server/menu-tools.ts");
  await advanceBatches(state.restaurant.id);
  assert.equal(
    (await one("SELECT COUNT(*) n FROM batch_items WHERE batch_id=?", batchKey))
      .n,
    7,
  );
  assert.equal((await call("state")).remaining, setBalance - 7);
  await call(`photo-batches/${batchKey}/continue`, { remainingCount: 7 });
  assert.equal(
    (await call("state")).remaining,
    setBalance - 7,
    "Repeated continuation cannot double-charge a set",
  );
  assert.equal(
    (await call(`photo-batches/${batchKey}`)).batch.settings.controls.surface,
    "Pale stone",
  );
  assert.equal((await one("SELECT COUNT(*) n FROM studio_libraries")).n, 2);
  console.log(
    `Photo Studio: discovery, override preservation, immutable look recipes, ${checks} API checks, restaurant isolation and output-format compatibility passed.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
