import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "menu-plate-choice-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.LOCAL_DEVELOPMENT = "true";
process.env.OPENAI_API_KEY = "fixture-only";
const { handle } = await import("../lib/server/api.ts");
const { one } = await import("../lib/server/core.ts");
const { imagePrompt, tick } = await import("../lib/server/generation.ts");
const { photoBrief, styleFor, PIPELINE_VERSION } =
  await import("../lib/studio.ts");
const { studioLookPatch } = await import("../lib/studio-discovery.ts");
const { capturedPhotoRecipe, photoLookContext } =
  await import("../lib/photo-recipe.ts");
const jpeg = readFileSync("public/pasta.jpg");
const requests = [];
let cookie = "";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  assert.equal(url, "https://api.openai.com/v1/images/edits");
  requests.push({
    prompt: init.body.get("prompt"),
    images: [...init.body.getAll("image"), ...init.body.getAll("image[]")],
  });
  return Response.json({ data: [{ b64_json: jpeg.toString("base64") }] });
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
  assert.equal(response.status, status, path + ": " + JSON.stringify(body));
  if (response.headers.has("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  return body;
}
async function upload(kind, dishId) {
  const form = new FormData();
  form.set("file", new File([jpeg], "photo.jpg", { type: "image/jpeg" }));
  form.set(
    "normalized",
    new File([jpeg], "working.jpg", { type: "image/jpeg" }),
  );
  form.set("kind", kind);
  if (dishId) form.set("dishId", dishId);
  return call("assets", form, 201);
}
try {
  // Even atmosphere-only, beverage and old saved styles must honor an explicit
  // food plate replacement. Their defaults may still preserve serving ware.
  for (const id of [
    "fine-slate",
    "delivery-takeout",
    "dark",
    "keep",
    "bar-velvet",
  ]) {
    const draft = {
      ...photoBrief(),
      ...studioLookPatch(photoBrief(), id),
      plate: "style",
    };
    const prompt = imagePrompt({
      style: styleFor(draft, {}),
      controls: draft,
      plating: "Original white plate",
    });
    assert.match(prompt, /required food-vessel replacement/);
    assert.match(prompt, /material, color, shape and rim/);
    assert.doesNotMatch(
      prompt,
      /When the style specifies no food serving ware, keep the original/,
    );
    assert.doesNotMatch(prompt, /applied to food, retain the original/);
    assert.match(prompt, /preserve the exact original glass/);
    assert.match(prompt, /Never put solid food in a drinking glass/);
    assert(
      prompt.indexOf("REQUIRED SERVING-DISH EDIT") <
        prompt.indexOf("FOOD IDENTITY"),
    );
  }
  const described = imagePrompt({ controls: { plate: "style" } }, "", 0, true);
  assert.doesNotMatch(described, /Remove the original food plate/);

  await call("auth/dev", {});
  const restaurant = (await call("state")).restaurant;
  await call("admin/restaurant", {
    id: restaurant.id,
    allowance: restaurant.allowance,
    paused: false,
    proUntil: Date.now() + 86400000,
  });
  const dish = await call("dishes", {
    name: "Pasta",
    description: "Pasta on a white plate",
    plating: "Original white plate",
    confirmed: true,
  });
  const source = await upload("source", dish.id);
  const reference = await upload("reference");
  const base = {
    ...photoBrief(),
    ...studioLookPatch(photoBrief(), "fine-slate"),
  };
  const ids = {};
  for (const plate of ["keep", "style", "white"]) {
    // A reopened saved photo's plate choice must survive capture and resubmission,
    // even if restaurant defaults still say to keep its original plate.
    const recipe = capturedPhotoRecipe({
      jobId: "saved-photo",
      sourceId: source.id,
      details: {
        controls: { ...base, plate },
        style: { ...styleFor(base, {}), referenceIds: [reference.id] },
        lookContext: photoLookContext(base),
      },
    });
    assert.equal(recipe.plate, plate);
    const request = {
      dishId: dish.id,
      sourceId: source.id,
      requestKey: crypto.randomUUID(),
      controls: recipe,
      style: styleFor(recipe, { style: { photoDefaults: { plate: "keep" } } }),
      lookContext: photoLookContext(recipe),
    };
    const job = await call("jobs", request, 202);
    ids[plate] = job.id;
    const details = JSON.parse(job.details);
    assert.equal(details.controls.plate, plate);
    assert.equal(details.pipelineVersion, PIPELINE_VERSION);
    await tick();
    const sent = requests.at(-1);
    assert.equal(sent.images.length, 2);
    if (plate === "style") {
      assert.match(sent.prompt, /required food-vessel replacement/);
      assert.match(
        sent.prompt,
        /STYLE INSPIRATION ONLY:.*food serving ware as the replacement/,
      );
      assert.match(sent.prompt, /matte charcoal ceramic serving ware/);
      assert.doesNotMatch(sent.prompt, /Serving ware: Keep the original plate/);
    } else {
      assert.match(
        sent.prompt,
        /owner's serving-dish choice takes priority over this reference/,
      );
      assert.doesNotMatch(
        sent.prompt,
        /Also use its food serving ware as the replacement/,
      );
      assert.match(
        sent.prompt,
        plate === "keep"
          ? /Serving ware: Keep the original plate/
          : /replace the original plate with a simple white ceramic plate/,
      );
    }
    assert.equal(
      (await call("jobs", { ...request, requestKey: crypto.randomUUID() }, 202))
        .id,
      job.id,
    );
  }
  assert.equal(
    new Set(Object.values(ids)).size,
    3,
    "Different plate choices never reuse one another's result",
  );
  const originalResult = await one(
    "SELECT asset_id FROM outputs WHERE job_id=?",
    ids.keep,
  );
  await call(
    "jobs",
    {
      dishId: dish.id,
      sourceId: source.id,
      parentId: originalResult.asset_id,
      requestKey: crypto.randomUUID(),
      controls: { plate: "style" },
      style: styleFor(base, {}),
      revision: "Use this style's plate",
    },
    202,
  );
  await tick();
  assert.match(
    requests.at(-1).prompt,
    /PREVIOUS RESULT: apply the selected style, serving-dish choice/,
  );
  assert.match(requests.at(-1).prompt, /required food-vessel replacement/);
  assert.equal(
    requests.length,
    4,
    "Each distinct request renders once; cached repeats do not render",
  );
  console.log(
    "PASS: plate choice reaches generation through presets, saved recipes, references, revisions and caching; drinks stay protected.",
  );
} finally {
  globalThis.fetch = originalFetch;
  rmSync(root, { recursive: true, force: true });
}
