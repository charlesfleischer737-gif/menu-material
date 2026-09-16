import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Deterministic time advance for the persisted polling backoff; no real sleeps.
const realNow = Date.now;
let clockAdvance = 0;
Date.now = () => realNow() + clockAdvance;
const root = mkdtempSync(join(tmpdir(), "plateworthy-core-"));
process.env.DISHLIGHT_DATA_DIR = root;
process.env.LOCAL_DEVELOPMENT = "true";
process.env.OPENAI_API_KEY = "fixture-only";
delete process.env.OPENAI_IMAGE_MODEL;
delete process.env.OPENAI_IMAGE_QUALITY;
const { handle } = await import("../lib/server/api.ts");
const { all, one, run } = await import("../lib/server/core.ts");
const {
  recommendedPhotoStyles,
  photoAnalysisRecommendation,
  recommendationsForPhoto,
  studioRenderProgress,
} = await import("../lib/studio-onboarding.ts");
const { foodFamilies, photoBrief } = await import("../lib/studio.ts");
const { imagePrompt } = await import("../lib/server/generation.ts");
const { restaurantPhotoDefaults, restaurantPhotoSelection, brandPostFields } =
  await import("../lib/restaurant-look.ts");
const { applyPostTemplate } = await import("../lib/post-templates.ts");
const brand = {
  autoApply: true,
  primary: "#235b48",
  accent: "#eddcc0",
  typography: "editorial",
  photoPreset: "menu-stone",
  photoDefaults: { lighting: "Soft daylight", surface: "Pale stone" },
};
const automatic = restaurantPhotoDefaults({ style: brand });
const chosenStyle = {
  ...photoBrief(),
  look: "bar-velvet",
  lookCategory: "bar",
  styleChosen: true,
  surface: "Warm wood",
  lighting: "Warm & cozy",
  angle: "overhead",
  plate: "keep",
  composition: "Room around the plate",
  sourceId: "uploaded-photo",
  note: "Keep the logo visible",
};
const restaurantSelection = {
  ...chosenStyle,
  ...restaurantPhotoSelection(chosenStyle, { style: brand }, true),
};
assert.equal(restaurantSelection.look, "restaurant");
assert.equal(restaurantSelection.surface, "Pale stone");
assert.equal(restaurantSelection.sourceId, "uploaded-photo");
assert.equal(restaurantSelection.note, "Keep the logo visible");
const restoredStyle = {
  ...restaurantSelection,
  ...restaurantPhotoSelection(restaurantSelection, { style: brand }, false),
};
assert.deepEqual(
  restoredStyle,
  { ...chosenStyle, previousPhotoStyle: null },
  "Turning restaurant matching off restores the user's style and custom settings",
);
assert.deepEqual(
  restaurantPhotoSelection(restaurantSelection, { style: brand }, true)
    .previousPhotoStyle,
  restaurantSelection.previousPhotoStyle,
  "Reapplying restaurant matching does not replace the previous style",
);
assert.equal(
  restaurantPhotoSelection(automatic, { style: brand }, false).look,
  "menu-stone",
  "An automatically applied restaurant look can also be switched off",
);
assert.equal(
  restaurantPhotoSelection(
    { ...automatic, previousPhotoStyle: { look: "removed-style" } },
    { style: { photoPreset: "removed-style" } },
    false,
  ).look,
  "menu-stone",
  "Older drafts fall back to an available catalog style",
);
assert.equal(automatic.look, "restaurant");
assert.equal(automatic.lighting, "Soft daylight");
assert.equal(automatic.plate, "style");
assert.equal(photoBrief().plate, "style");
assert.equal(
  restaurantPhotoDefaults({
    style: { ...brand, photoDefaults: { plate: "keep" } },
  }).plate,
  "keep",
  "An explicit saved plate choice is still respected",
);
const promptDetails = {
  name: "Three dumplings",
  description: "Three steamed dumplings with chili oil",
  portion: "3 pieces",
  plating: "On a red plate",
  style: { photoStyle: "Dark slate, charcoal ceramics, directional sidelight" },
  controls: { surface: "As shown", lighting: "As shown", plate: "style" },
  pipelineVersion: "internal-pipeline",
  rendering: { model: "internal-model" },
};
const stylePrompt = imagePrompt(promptDetails);
assert.match(stylePrompt, /Replace the source surroundings/);
assert.match(stylePrompt, /Match the serving ware to the selected style/);
assert.match(
  stylePrompt,
  /Dark slate, charcoal ceramics, directional sidelight/,
);
assert.match(stylePrompt, /"portion":"3 pieces"/);
assert.match(stylePrompt, /Never add or remove ingredients/);
assert(
  !stylePrompt.includes("As shown"),
  "Default controls cannot anchor to the upload",
);
assert(
  !stylePrompt.includes("internal-model"),
  "Model metadata is not photo direction",
);
assert(!stylePrompt.includes("internal-pipeline"));
const controlledPrompt = imagePrompt(
  {
    ...promptDetails,
    controls: {
      plate: "white",
      angle: "overhead",
      surface: "Warm wood",
      lighting: "Soft daylight",
    },
  },
  "Remove the napkin",
);
assert.match(
  controlledPrompt,
  /replace the original plate with a simple white/,
);
assert.match(controlledPrompt, /requested overhead camera angle/);
assert.match(controlledPrompt, /chosen "Warm wood" surface/);
assert.match(controlledPrompt, /chosen "Soft daylight" lighting/);
assert.match(controlledPrompt, /Requested adjustment: "Remove the napkin"/);
assert(!controlledPrompt.includes("Keep the original plate"));
const drinkPrompt = imagePrompt(
  {
    ...promptDetails,
    name: "Guinness",
    description: "Dark stout with a creamy head in its branded pint glass",
    style: { photoStyle: "Amber light, walnut bar and a dark background" },
  },
  "Restore the logo from my original photo",
);
assert.match(drinkPrompt, /preserve the exact original glass/);
assert.match(drinkPrompt, /existing visible logos, brand marks/);
assert.match(drinkPrompt, /foam or head shape and thickness/);
assert.match(drinkPrompt, /restore those details from the original upload/);
assert.match(
  drinkPrompt,
  /fully rebuilding the background, tabletop and lighting/,
);
assert.match(
  drinkPrompt,
  /Without an original drink photo, do not invent a brand logo/,
);
assert.doesNotMatch(
  drinkPrompt,
  /watermarks, logos or/,
  "The finish instructions must not ban existing product logos",
);
assert.doesNotMatch(
  drinkPrompt,
  /plate, bowl, board or glass/,
  "Matching a style must not authorize replacing drink glassware",
);
assert.match(
  controlledPrompt,
  /drink-identity rule overrides any plate control/,
  "White-plate overrides apply to food, not a branded drink",
);
assert.deepEqual(
  restaurantPhotoDefaults({ style: { ...brand, autoApply: false } }),
  {},
  "owners can turn automatic styling off",
);
const brandedPost = { ...brandPostFields(brand), items: [] };
assert.equal(
  applyPostTemplate(brandedPost, "editorial").color,
  brand.primary,
  "changing layouts keeps the restaurant palette",
);
assert.equal(applyPostTemplate(brandedPost, "editorial").accent, brand.accent);
assert.notEqual(
  applyPostTemplate({ items: [] }, "editorial").accent,
  brand.accent,
  "legacy posts keep template behavior",
);
for (const family of foodFamilies) {
  for (const destination of ["menu", "delivery", "social", "print"]) {
    const recommended = recommendedPhotoStyles(family, destination);
    assert.equal(recommended.length, 3, "first-use always offers three styles");
    assert.equal(new Set(recommended.map((look) => look.id)).size, 3);
    assert.equal(
      new Set(recommended.map((look) => look.image)).size,
      3,
      "each recommendation has a different example",
    );
    for (const look of recommended) {
      assert(readFileSync("public" + look.image).length > 0);
      if (
        destination === "delivery" &&
        !["Drinks", "Desserts"].includes(family)
      )
        assert.equal(look.category, "delivery");
    }
  }
}
const drinkChoices = recommendedPhotoStyles("Drinks");
assert(
  drinkChoices.every((style) => ["beverage", "bar"].includes(style.category)),
);
const vision = {
  family: "Drinks",
  subject: "A pint of stout",
  confidence: "high",
  drinkKind: "beer",
  menuDocument: false,
  issue: "none",
  advice: "",
};
const currentPhoto = {
  ...photoBrief(),
  sourceId: "original",
  styleChosen: true,
  look: "studio-dark",
};
const classified = photoAnalysisRecommendation(
  currentPhoto,
  vision,
  "original",
);
assert.equal(classified.recommendationFamily, "Drinks");
assert.equal(classified.recommendationDrink, "beer");
assert(!("look" in classified), "Analysis never replaces the chosen style");
assert(!("styleChosen" in classified));
const suggestions = recommendationsForPhoto({
  ...currentPhoto,
  ...classified,
  destination: "delivery",
});
assert.equal(suggestions.length, 3);
assert(
  suggestions.every(
    (s) => ["bar", "beverage"].includes(s.category) && s.id !== "bar-candle",
  ),
  "A beer gets only drink examples, including for delivery",
);
assert.equal(suggestions[0].id, "bar-brass");
assert.equal(
  recommendedPhotoStyles("Drinks", "menu", "coffee")[0].id,
  "beverage-cafe",
);
assert.deepEqual(
  recommendedPhotoStyles(),
  [],
  "There are no generic fallback recommendations",
);
assert.deepEqual(
  recommendationsForPhoto(photoBrief()),
  [],
  "No upload means no photo recommendations",
);
assert.deepEqual(
  recommendationsForPhoto({
    ...currentPhoto,
    ...classified,
    sourceId: "replacement",
  }),
  [],
  "Old recommendations cannot follow a replacement upload",
);
assert.deepEqual(
  photoAnalysisRecommendation({ ...currentPhoto, step: 4 }, vision, "original"),
  {},
  "Analysis cannot relabel a submitted image",
);
assert.deepEqual(
  photoAnalysisRecommendation(currentPhoto, vision, "other-photo"),
  {},
  "Late analysis is bound to its upload",
);
assert.deepEqual(
  photoAnalysisRecommendation(
    { ...currentPhoto, analysisSourceId: "original", analysisStatus: "manual" },
    vision,
    "original",
  ),
  {},
  "Late vision cannot overwrite a manual correction",
);
for (const patch of [
  { confidence: "low" },
  { confidence: "medium" },
  { menuDocument: true },
  { issue: "multiple" },
]) {
  const uncertain = photoAnalysisRecommendation(
    currentPhoto,
    { ...vision, ...patch },
    "original",
  );
  assert.deepEqual(
    recommendationsForPhoto({ ...currentPhoto, ...uncertain }),
    [],
    "Ambiguous and menu photos do not get pretend recommendations",
  );
}
assert.equal(
  studioRenderProgress(60, true).value,
  6,
  "Queued work never pretends to be rendering",
);
assert(
  studioRenderProgress(30, false).value > studioRenderProgress(5, false).value,
);
assert(
  studioRenderProgress(600, false).value < 100,
  "Only the real output completes the waiting screen",
);
assert(studioRenderProgress(60, false).takingLonger);

const jpeg = readFileSync("public/pasta.jpg"),
  png = readFileSync("public/og.png");
let cookie = "",
  checks = 0,
  calls = 0;
const requests = [];
let fail = false;
globalThis.fetch = async (url, init = {}) => {
  assert(String(url).startsWith("https://api.openai.com/v1/"));
  if (init.method === "POST") {
    const b = JSON.parse(init.body);
    if (!b.tools) {
      if (b.text?.format?.type === "json_object") {
        assert(
          b.input.some((message) =>
            message.content.some(
              (item) => item.type === "input_text" && /json/i.test(item.text),
            ),
          ),
          "JSON mode requires JSON in the input message, not only in instructions",
        );
        assert(
          b.input.some((message) =>
            message.content.some((item) => item.type === "input_image"),
          ),
          "Photo recommendations must inspect the actual uploaded image",
        );
      }
      calls++;
      return Response.json({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  ...vision,
                }),
              },
            ],
          },
        ],
        usage: { input_tokens: 42, output_tokens: 16 },
      });
    }
    requests.push(b);
    calls++;
    return Response.json({ id: "fixture-" + calls, status: "queued" });
  }
  return Response.json(
    fail
      ? { status: "failed" }
      : {
          status: "completed",
          output: [
            { type: "image_generation_call", result: jpeg.toString("base64") },
          ],
          usage: { input_tokens: 15, output_tokens: 22 },
        },
  );
};
async function call(path, b, expected = 200) {
  if (path === "jobs/tick") clockAdvance += 31000;
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method: b === undefined ? "GET" : "POST",
      headers: {
        cookie,
        ...(b instanceof FormData
          ? {}
          : { "content-type": "application/json" }),
      },
      body:
        b === undefined
          ? undefined
          : b instanceof FormData
            ? b
            : JSON.stringify(b),
    }),
  );
  let data;
  try {
    data = await res.clone().json();
  } catch {}
  assert.equal(res.status, expected, path + ": " + JSON.stringify(data));
  checks++;
  if (res.headers.has("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return data;
}
const upload = async (dishId) => {
  const f = new FormData();
  f.set("file", new File([jpeg], "phone.jpg", { type: "image/jpeg" }));
  f.set("normalized", new File([jpeg], "working.jpg", { type: "image/jpeg" }));
  f.set("dishId", dishId);
  return call("assets", f, 201);
};
try {
  await call("auth/dev", {});
  let state = await call("state");
  const restaurant = state.restaurant;
  const dish = await call("dishes", {
    name: "Untitled dish",
    description: "",
    confirmed: true,
  });
  const original = await upload(dish.id);
  const did = crypto.randomUUID(),
    brief = {
      step: 3,
      dishId: dish.id,
      sourceId: original.id,
      look: "white",
      requestKey: crypto.randomUUID(),
    };
  await call("creation-drafts", {
    id: did,
    kind: "studio",
    revision: 0,
    draft: brief,
  });
  await call("creation-drafts", {
    id: did,
    kind: "studio",
    revision: 0,
    draft: brief,
  });
  await call("creation-drafts", {
    id: did,
    kind: "studio",
    revision: 1,
    draft: { ...brief, look: "cafe" },
  });
  await call(
    "creation-drafts",
    { id: did, kind: "studio", revision: 1, draft: { ...brief, look: "dark" } },
    409,
  );
  assert.equal((await call("creation-drafts")).drafts[0].draft.look, "cafe");
  assert.equal(calls, 0, "Browsing and autosaving never call the image model");
  const input = {
    dishId: dish.id,
    sourceId: original.id,
    requestKey: crypto.randomUUID(),
    controls: { format: "doordash", plate: "keep", angle: "keep", cropX: 35 },
  };
  const [a, b] = await Promise.all([
    call("jobs", input, 202),
    call("jobs", input, 202),
  ]);
  assert.equal(a.id, b.id);
  assert.equal(
    (await all("SELECT * FROM outputs WHERE job_id=?", a.id)).length,
    1,
    "one default result",
  );
  assert.equal((await call("state")).remaining, 19);
  await call("jobs", { ...input, controls: { format: "menu" } }, 409);
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-2";
  process.env.OPENAI_IMAGE_QUALITY = "low";
  await call("jobs/tick", {});
  await call("jobs/tick", {});
  delete process.env.OPENAI_IMAGE_MODEL;
  delete process.env.OPENAI_IMAGE_QUALITY;
  assert.equal(calls, 1);
  const job = await one("SELECT * FROM jobs WHERE id=?", a.id);
  assert.equal(job.status, "completed", "a single result completes a job");
  assert.equal(requests[0].tools[0].size, "2048x1152");
  assert.equal(
    requests[0].tools[0].model,
    "gpt-image-2.5-flare",
    "queued jobs retain their model",
  );
  assert.equal(
    requests[0].tools[0].quality,
    "high",
    "queued jobs retain their quality",
  );
  assert.equal(requests[0].tools[0].output_format, "jpeg");
  assert.equal(requests[0].tools[0].output_compression, 95);
  assert.equal(requests[0].tools[0].action, "edit");
  assert(
    requests[0].input[0].content[0].text.includes("Keep the original plate"),
  );
  assert.match(
    requests[0].input[0].content[0].text,
    /Retain its existing visible logos/,
    "Drink identity protection reaches the provider even for legacy requests",
  );
  const result = await one("SELECT * FROM outputs WHERE job_id=?", a.id);
  const storedImage = await one(
    "SELECT * FROM assets WHERE id=?",
    result.asset_id,
  );
  assert.equal(storedImage.mime, "image/jpeg");
  assert(storedImage.key.endsWith(".jpg"));
  const cached = await call(
    "jobs",
    { ...input, requestKey: crypto.randomUUID() },
    202,
  );
  assert.equal(cached.id, a.id);
  assert.equal(
    (await call("state")).remaining,
    19,
    "cache does not reserve again",
  );
  await call("assets/" + result.asset_id + "?download=1", undefined, 403);
  await call("assets/" + result.asset_id + "/approve", { accurate: true });
  await call("assets/" + result.asset_id + "?download=1");
  const download = await handle(
    new Request(
      "http://localhost/api/assets/" + result.asset_id + "?download=1",
      { headers: { cookie } },
    ),
  );
  assert.equal(download.headers.get("content-type"), "image/jpeg");
  assert(download.headers.get("content-disposition").includes(".jpg"));
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), jpeg);
  const editId = crypto.randomUUID(),
    editForm = () => {
      const f = new FormData();
      f.set("parentId", result.asset_id);
      f.set("file", new File([jpeg], "adjusted.jpg", { type: "image/jpeg" }));
      f.set("requestKey", editId);
      f.set("edits", JSON.stringify({ brightness: 110 }));
      return f;
    };
  await call("photo-edits", editForm());
  await call("photo-edits", editForm());
  assert.equal(calls, 1, "Quick edits never call the image model");
  assert.equal(
    (await one("SELECT * FROM asset_edits WHERE asset_id=?", editId)).source_id,
    original.id,
  );
  assert.equal(
    (await one("SELECT approved_at FROM assets WHERE id=?", editId))
      .approved_at,
    null,
  );
  await call("assets/" + editId + "?download=1", undefined, 403);
  await call("assets/" + editId + "/approve", { accurate: true });
  await call(
    "jobs",
    {
      dishId: dish.id,
      parentId: editId,
      requestKey: crypto.randomUUID(),
      revision: "Remove napkin",
      controls: { plate: "style" },
    },
    202,
  );
  await call("jobs/tick", {});
  assert.equal(
    requests.at(-1).tools[0].size,
    "1536x1536",
    "Flare retains full menu dimensions",
  );
  assert.equal(
    requests.at(-1).input[0].content.length,
    3,
    "Original identity plus edited parent are passed",
  );
  assert.match(
    requests.at(-1).input[0].content[0].text,
    /Match the serving ware to the selected style/,
    "The style plate control reaches the provider on a revision",
  );
  await call("jobs/tick", {});
  assert(
    await one(
      "SELECT id FROM assets WHERE id=? AND deleted_at IS NULL",
      original.id,
    ),
  );
  assert(
    await one(
      "SELECT id FROM assets WHERE id=? AND deleted_at IS NULL",
      result.asset_id,
    ),
  );
  const blank = await call("dishes", {
    name: "From description",
    description: "",
    confirmed: true,
  });
  await call(
    "jobs",
    { dishId: blank.id, requestKey: crypto.randomUUID() },
    400,
  );
  const second = await call("dishes", {
    name: "Second dish",
    description: "",
    confirmed: true,
  });
  const secondPhoto = await upload(second.id);
  const third = await call("dishes", {
    name: "Third dish",
    description: "",
    confirmed: true,
  });
  const thirdPhoto = await upload(third.id);
  const batchId = crypto.randomUUID(),
    style = {
      primary: "#235b48",
      accent: "#e7efb7",
      tone: "Warm",
      photoStyle: "Soft window light",
      referenceIds: [],
    };
  const batch = await call("photo-batches", {
    batchId,
    items: [
      { dishId: second.id, sourceId: secondPhoto.id },
      { dishId: third.id, sourceId: thirdPhoto.id },
    ],
    style,
  });
  await call(
    "photo-batches/" + batchId + "/continue",
    { remainingCount: 1 },
    400,
  );
  assert.equal(
    (await all("SELECT * FROM batch_items WHERE batch_id=?", batchId)).length,
    0,
  );
  fail = true;
  await call("jobs/tick", {});
  await call("jobs/tick", {});
  assert.equal(
    (await one("SELECT status FROM jobs WHERE id=?", batch.batch.sampleJobId))
      .status,
    "failed",
  );
  await call("photo-batches/" + batchId + "/retry-sample", {});
  fail = false;
  await call("jobs/tick", {});
  await call("jobs/tick", {});
  const sample = await one(
    "SELECT asset_id FROM outputs WHERE job_id=?",
    batch.batch.sampleJobId,
  );
  await call("assets/" + sample.asset_id + "/approve", { accurate: true });
  await call(
    "photo-batches/" + batchId + "/continue",
    { remainingCount: 2 },
    400,
  );
  await call("restaurant", {
    name: restaurant.name,
    cuisine: "",
    brand: "",
    currency: "USD",
    style: { ...style, photoStyle: "Different restaurant setting" },
  });
  const before = calls;
  await call("photo-batches/" + batchId + "/continue", { remainingCount: 1 });
  await call("photo-batches/" + batchId + "/continue", { remainingCount: 1 });
  const entries = await all(
    "SELECT * FROM batch_items WHERE batch_id=?",
    batchId,
  );
  assert.equal(entries.length, 1, "Only selected remaining dish is queued");
  assert.equal(entries[0].dish_id, third.id);
  assert.equal(
    JSON.parse(entries[0].settings).style.photoStyle,
    "Soft window light",
    "Batch uses approved sample settings",
  );
  await call("jobs/tick", {});
  await call("jobs/tick", {});
  assert.equal(calls - before, 1, "First sample is not regenerated");
  const menu = {
    layout: "featured",
    appearance: "dark",
    paper: "a4",
    sections: [
      {
        id: "mains",
        name: "Mains",
        items: [{ dishId: dish.id, photoId: editId }],
      },
    ],
  };
  await call("menu", menu);
  await call("menu/publish", {});
  state = await call("state");
  assert.equal(state.restaurant.published.layout, "featured");
  assert.equal(state.restaurant.published.appearance, "dark");
  await call("dishes/" + dish.id, {
    name: "Renamed dish",
    description: "",
    price: 21,
    confirmed: true,
  });
  state = await call("state");
  assert.equal(
    state.restaurant.published.sections[0].items[0].name,
    "Untitled dish",
    "Price and name changes remain unpublished",
  );
  const beforeLayouts = calls;
  await call("creation-drafts", {
    id: crypto.randomUUID(),
    kind: "post",
    revision: 0,
    draft: { price: 12, caption: "Confirmed details", template: "photo" },
  });
  await call("menu", { ...menu, layout: "classic" });
  assert.equal(calls, beforeLayouts);
  const other = crypto.randomUUID();
  await run(
    "INSERT INTO users (id,email,password,role,created_at) VALUES (?, ?, ?, ?, ?)",
    other,
    "other@example.test",
    "unused",
    "owner",
    Date.now(),
  );
  const otherRestaurant = crypto.randomUUID();
  await run(
    "INSERT INTO restaurants (id,user_id,name,slug,created_at) VALUES (?,?,?,?,?)",
    otherRestaurant,
    other,
    "Other",
    "other-test",
    Date.now(),
  );
  const foreignDraft = crypto.randomUUID();
  await run(
    "INSERT INTO creation_drafts (id,restaurant_id,kind,draft,updated_at) VALUES (?,?,?,?,?)",
    foreignDraft,
    otherRestaurant,
    "studio",
    "{}",
    Date.now(),
  );
  await call(
    "creation-drafts",
    {
      id: foreignDraft,
      kind: "studio",
      revision: 1,
      draft: { name: "No access" },
    },
    404,
  );
  assert(
    !(await call("creation-drafts")).drafts.some((d) => d.id === foreignDraft),
  );
  const beforeAnalysis = calls;
  const analysis = await call("photo-analysis", { sourceId: original.id });
  assert.equal(analysis.menuDocument, false);
  assert.equal(analysis.family, "Drinks");
  assert.equal(analysis.confidence, "high");
  assert.equal(analysis.drinkKind, "beer");
  assert.equal(analysis.subject, "A pint of stout");
  await call("photo-analysis", { sourceId: original.id });
  assert.equal(
    calls - beforeAnalysis,
    1,
    "Photo guidance is cached per source",
  );
  assert.equal(
    (
      await one("SELECT details FROM events WHERE kind='source_analysis'")
    ).details.includes("42"),
    true,
    "Analysis usage is recorded",
  );
  await call("photo-analysis", { sourceId: foreignDraft }, 404);
  assert(
    (await call("creation-drafts")).drafts.every((d) =>
      ["studio", "menu", "post"].includes(d.kind),
    ),
  );
  delete process.env.OPENAI_API_KEY;
  (await import("../lib/local-runtime.ts")).env.OPENAI_API_KEY = "";
  await call("jobs", { ...input, requestKey: crypto.randomUUID() }, 503);
  await call(
    "post-caption",
    {
      dishIds: [dish.id],
      title: "Dish",
      description: "",
      price: null,
      validity: "",
      occasion: "showcase",
    },
    503,
  );
  console.log(
    `PASS: ${checks} core-creation API checks plus one-result default, zero-call previews/edits, cache, draft conflicts, identity lineage, immutable versions, sample-first batches, print settings and tenant-boundary assertions.`,
  );
  console.log(
    "Provider responses are explicit isolated fixtures. Live image fidelity and billing require the service connection.",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}

// Brand bundles and print/share metadata must preserve a restaurant's actual saved choices.
const {
  restaurantLooks,
  restaurantLookFields,
  normalizeBrandColor,
  readableBrandInk,
} = await import("../lib/restaurant-look.ts");
const { styleSchema } = await import("../lib/server/promotions.ts");
const { postVisualState, publishedRestaurant } =
  await import("../lib/sharing.ts");
for (const look of restaurantLooks) {
  const fields = restaurantLookFields(look.id);
  const valid = styleSchema.parse(fields);
  assert.equal(valid.photoPreset, look.photoPreset);
  assert.equal(valid.autoApply, true);
  assert.equal(valid.photoDefaults.plate, "style");
  assert(valid.photoStyle.length > 30);
}
assert.equal(normalizeBrandColor(" ABC "), "#aabbcc");
assert.equal(normalizeBrandColor("#244638"), "#244638");
assert.equal(normalizeBrandColor("hello"), null);
assert.equal(readableBrandInk("#ffffff"), "#000000");
assert.equal(readableBrandInk("#000000"), "#ffffff");
const visualDraft = {
  items: [{ name: "Pasta", photoId: "approved" }],
  template: "chef",
  typography: "editorial",
  caption: "First caption",
  reviewed: true,
  layouts: { feed: { x: 25 }, story: { x: 75 } },
};
const visualRestaurant = {
  name: "The Kitchen",
  slug: "kitchen",
  currency: "USD",
};
assert.deepEqual(
  postVisualState(visualDraft, visualRestaurant),
  postVisualState(
    { ...visualDraft, caption: "Another caption", reviewed: false },
    visualRestaurant,
  ),
  "caption and review changes do not rerender the image",
);
assert.notDeepEqual(
  postVisualState(visualDraft, visualRestaurant, "feed"),
  postVisualState(visualDraft, visualRestaurant, "story"),
  "each format preserves its own crop",
);
assert.notDeepEqual(
  postVisualState(visualDraft, visualRestaurant),
  postVisualState({ ...visualDraft, typography: "bold" }, visualRestaurant),
  "visual style changes invalidate exports",
);
const savedBrand = publishedRestaurant({
  name: "Private rename",
  style: { primary: "#123456" },
  published: JSON.stringify({
    restaurant: {
      name: "Published name",
      style: {
        primary: "#244638",
        photoStyle: "private prompt",
        referenceIds: ["private"],
      },
    },
  }),
});
assert.equal(savedBrand.name, "Published name");
assert.equal(savedBrand.style.primary, "#244638");
assert.equal(savedBrand.style.photoStyle, undefined);
assert.equal(savedBrand.style.referenceIds, undefined);
console.log(
  "PASS: coordinated restaurant looks, visual export identity, and published-only sharing metadata.",
);
