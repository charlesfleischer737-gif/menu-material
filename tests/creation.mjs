import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "plateworthy-core-"));
process.env.DISHLIGHT_DATA_DIR = root;
process.env.LOCAL_DEVELOPMENT = "true";
process.env.OPENAI_API_KEY = "fixture-only";
delete process.env.OPENAI_IMAGE_MODEL;
delete process.env.OPENAI_IMAGE_QUALITY;
const { handle } = await import("../lib/server/api.ts");
const { all, one, run } = await import("../lib/server/core.ts");
const { recommendedPhotoStyles, photoAnalysisRecommendation } =
  await import("../lib/studio-onboarding.ts");
const { foodFamilies, photoBrief } = await import("../lib/studio.ts");
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
      assert.equal(
        look.angle,
        "keep",
        "onboarding does not reconstruct the food from another angle",
      );
      assert(readFileSync("public" + look.image).length > 0);
      if (destination === "delivery") assert.equal(look.category, "delivery");
    }
  }
}
const drinkChoices = recommendedPhotoStyles("Drinks");
assert(
  drinkChoices.every((style) => ["beverage", "bar"].includes(style.category)),
);
assert.deepEqual(
  photoAnalysisRecommendation(
    { step: 2, styleChosen: true, look: "menu-stone" },
    "Drinks",
  ),
  {},
  "late analysis preserves a user's selected style or fine-tuning",
);
assert.deepEqual(
  photoAnalysisRecommendation({ step: 4, styleChosen: false }, "Drinks"),
  {},
  "analysis cannot relabel a submitted image",
);
const suggested = photoAnalysisRecommendation(
  { ...photoBrief(), step: 2 },
  "Drinks",
);
assert.equal(
  suggested.look,
  drinkChoices[0].id,
  "a new upload gets relevant suggestions without an extra step",
);

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
      calls++;
      return Response.json({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  family: "Pizza",
                  menuDocument: true,
                  issue: "cropped",
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
  assert.equal(analysis.menuDocument, true);
  assert.equal(analysis.family, "Pizza");
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
