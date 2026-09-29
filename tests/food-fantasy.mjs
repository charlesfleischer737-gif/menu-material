import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-food-fantasy-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.LOCAL_DEVELOPMENT = "true";
process.env.OPENAI_API_KEY = "fixture-only";
process.env.PLAN_LIMITS_ENABLED = "true";
const { handle } = await import("../lib/server/api.ts");
const { run, one, id } = await import("../lib/server/core.ts");
const { imagePrompt } = await import("../lib/server/generation.ts");
const { photoStyles, foodFantasyStyle } =
  await import("../lib/photo-styles.ts");
const { photoBrief, styleFor } = await import("../lib/studio.ts");
const { capturedPhotoRecipe, failedImageRequest } =
  await import("../lib/photo-recipe.ts");
globalThis.fetch = () => {
  throw Error("Food Fantasy checks must not contact a provider");
};
let cookie = "";
async function call(path, data, expected = 200) {
  const response = await handle(
    new Request("http://localhost/api/" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: { cookie, "content-type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  );
  const result = await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(result)}`);
  if (response.headers.has("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  return result;
}
try {
  await call("auth/dev", {});
  const state = await call("state"),
    rid = state.restaurant.id;
  await run(
    "UPDATE restaurants SET pro_until=NULL,allowance=20 WHERE id=?",
    rid,
  );
  const dish = await call("dishes", {
    name: "Cheese burger",
    description: "One bun, beef patty, cheese, lettuce and pickles.",
    confirmed: true,
  });
  const styles = photoStyles.filter((style) => style.treatment === "fantasy");
  assert.equal(styles.length, 3);
  assert(styles.every((style) => style.pro));
  const request = (style) => ({
    dishId: dish.id,
    requestKey: id(),
    controls: { format: "feed", plate: "keep" },
    style: styleFor({ ...photoBrief(), look: style.id }, state.restaurant),
    lookContext: { presetId: style.id },
  });
  const before = (await call("state")).remaining;
  for (const style of styles) {
    const denied = await call("jobs", request(style), 402);
    assert.equal(denied.code, "pro_required");
    assert.equal(denied.feature, "foodFantasy");
    const promptOnly = request(style);
    delete promptOnly.lookContext;
    delete promptOnly.style.photoPreset;
    assert.equal(
      (await call("jobs", promptOnly, 402)).feature,
      "foodFantasy",
      "Saved prompt cannot bypass Pro",
    );
  }
  assert.equal(
    (await call("state")).remaining,
    before,
    "Blocked styles reserve no credits",
  );
  assert.equal(
    (await one("SELECT count(*) n FROM jobs WHERE restaurant_id=?", rid)).n,
    0,
  );
  await run(
    "UPDATE restaurants SET pro_until=? WHERE id=?",
    Date.now() + 86400000,
    rid,
  );
  const submitted = request(styles[0]);
  const accepted = await call("jobs", submitted, 202);
  const stored = await one("SELECT * FROM jobs WHERE id=?", accepted.id);
  const details = JSON.parse(stored.details);
  assert.equal(details.creativeStyleId, styles[0].id);
  assert.match(details.generationPrompts[0], /intentionally exaggerated/);
  assert.match(details.generationPrompts[0], /only source of ingredients/);
  assert.doesNotMatch(
    details.generationPrompts[0],
    /retain its ingredients, counts, portion size/,
  );
  for (const style of styles) {
    const prompt = imagePrompt({
      ...details,
      creativeStyleId: style.id,
      controls: { plate: "keep", surface: "Warm wood", angle: "side" },
    });
    assert.match(prompt, /original dish photo/);
    assert.match(prompt, /Do not invent ingredient types/);
    assert.match(prompt, /Warm wood/);
    assert.match(prompt, /Camera: "side"/);
    assert(prompt.includes(style.prompt));
  }
  const recipe = capturedPhotoRecipe({ jobId: accepted.id, details });
  assert.equal(recipe.look, styles[0].id);
  assert.equal(styleFor(recipe, state.restaurant).photoPreset, styles[0].id);
  assert.equal(
    foodFantasyStyle(failedImageRequest(stored).style)?.id,
    styles[0].id,
  );
  await run("UPDATE restaurants SET pro_until=NULL WHERE id=?", rid);
  assert.equal(
    (await call("jobs", submitted, 202)).id,
    accepted.id,
    "Accepted requests survive a downgrade",
  );
  assert.equal(
    (await call("jobs", { ...submitted, requestKey: id() }, 402)).feature,
    "foodFantasy",
  );
  const standard = request(
    photoStyles.find((style) => style.id === "bold-crimson"),
  );
  standard.creativeStyleId = styles[0].id;
  standard.treatment = "fantasy";
  const normalJob = await call("jobs", standard, 202);
  const normalDetails = JSON.parse(
    (await one("SELECT details FROM jobs WHERE id=?", normalJob.id)).details,
  );
  assert.equal(
    normalDetails.creativeStyleId,
    undefined,
    "Client flags cannot enable creative treatment",
  );
  assert.match(
    imagePrompt(normalDetails),
    /retain its ingredients, counts, portion size/,
  );
  assert.match(imagePrompt(normalDetails), /photorealistic/);
  assert.doesNotMatch(imagePrompt(normalDetails), /FOOD FANTASY/);
  // Completed artwork remains reusable after a downgrade without charging again.
  const assetId = id();
  await run(
    "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,mime,name,created_at) VALUES (?,?,?,'generated','fixture-art','image/webp','Artwork',?)",
    assetId,
    rid,
    dish.id,
    Date.now(),
  );
  await run(
    "UPDATE outputs SET status='completed',asset_id=? WHERE job_id=?",
    assetId,
    accepted.id,
  );
  await run("UPDATE jobs SET status='completed' WHERE id=?", accepted.id);
  const balance = (await call("state")).remaining;
  const reused = await call("jobs", { ...submitted, requestKey: id() }, 202);
  assert.equal(reused.id, accepted.id);
  assert.equal(reused.reused, true);
  assert.equal((await call("state")).remaining, balance);
  console.log(
    "Food Fantasy: Pro gate, no blocked charges, saved/retry recipes, downgrade replay, cached artwork and isolated creative prompts passed.",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
