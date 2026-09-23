import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-studio-recents-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.LOCAL_DEVELOPMENT = "true";
process.env.OPENAI_API_KEY = "fixture-only";
const realNow = Date.now;
let clock = realNow();
Date.now = () => clock;
const { handle } = await import("../lib/server/api.ts");
const { run, one, id, digest } = await import("../lib/server/core.ts");
const { photoBrief, photoStyles, styleFor } = await import("../lib/studio.ts");
let cookie = "",
  checks = 0;
globalThis.fetch = () => {
  throw Error("Recent-look tests must not contact a provider");
};
async function call(
  path,
  data,
  expected = 200,
  method = data === undefined ? "GET" : "POST",
) {
  clock += 1000;
  const response = await handle(
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
  const result = await response.json();
  if (Array.isArray(expected))
    assert(
      expected.includes(response.status),
      `${path}: ${JSON.stringify(result)}`,
    );
  else
    assert.equal(
      response.status,
      expected,
      `${path}: ${JSON.stringify(result)}`,
    );
  checks++;
  if (response.headers.has("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  return Array.isArray(expected) ? { status: response.status, result } : result;
}
try {
  await call("auth/dev", {});
  const firstCookie = cookie,
    state = await call("state"),
    rid = state.restaurant.id;
  const dish = await call("dishes", {
    name: "Recent look fixture",
    confirmed: true,
  });
  const jpg = readFileSync("public/pasta.jpg"),
    form = new FormData();
  form.set("file", new File([jpg], "pasta.jpg", { type: "image/jpeg" }));
  form.set(
    "normalized",
    new File([jpg], "working.jpg", { type: "image/jpeg" }),
  );
  form.set("dishId", dish.id);
  const source = await call("assets", form, 201);
  const request = (look, requestKey = id()) => ({
    dishId: dish.id,
    sourceId: source.id,
    requestKey,
    style: styleFor({ ...photoBrief(), look }, state.restaurant),
    controls: { plate: "keep" },
    lookContext: { presetId: look },
  });
  let library = await call("studio-library");
  library = await call(
    "studio-library",
    {
      revision: library.revision,
      library: {
        ...library,
        recent: ["studio-dark"],
        favorites: ["studio-dark"],
      },
    },
    200,
    "PUT",
  );
  assert.deepEqual(
    library.recent,
    [],
    "Client selection/history cannot fabricate recent use",
  );
  assert.deepEqual(library.favorites, ["studio-dark"]);
  await run(
    "UPDATE studio_libraries SET content=json_set(content,'$.recent',json(?)) WHERE restaurant_id=?",
    JSON.stringify(["retired-selection-only"]),
    rid,
  );
  assert.deepEqual(
    (await call("studio-library")).recent,
    [],
    "Old click-based or retired recent IDs cannot break the library",
  );
  library = await call(
    "studio-library",
    {
      revision: library.revision,
      library: { ...library, recent: ["retired-selection-only"] },
    },
    200,
    "PUT",
  );
  assert.deepEqual(
    library.recent,
    [],
    "Legacy clients cannot restore selection-based recency",
  );
  const aRequest = request("menu-wood"),
    a = await call("jobs", aRequest, 202);
  assert.deepEqual((await call("studio-library")).recent, ["menu-wood"]);
  const bRequest = request("delivery-white"),
    b = await call("jobs", bRequest, 202);
  assert.deepEqual((await call("studio-library")).recent, [
    "delivery-white",
    "menu-wood",
  ]);
  const aUsed = await one(
    "SELECT used_at FROM studio_look_uses WHERE restaurant_id=? AND request_key=?",
    rid,
    aRequest.requestKey,
  );
  assert.equal((await call("jobs", aRequest, 202)).id, a.id);
  assert.equal(
    (
      await one(
        "SELECT used_at FROM studio_look_uses WHERE restaurant_id=? AND request_key=?",
        rid,
        aRequest.requestKey,
      )
    ).used_at,
    aUsed.used_at,
  );
  assert.deepEqual(
    (await call("studio-library")).recent,
    ["delivery-white", "menu-wood"],
    "A lost-response replay does not reorder prior use",
  );

  // The completed image below is a local fixture, not provider output.
  const imageId = id();
  await run(
    "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,mime,name,created_at) VALUES (?,?,?,'generated','fixture-result','image/jpeg','Fixture result',?)",
    imageId,
    rid,
    dish.id,
    clock,
  );
  await run(
    "UPDATE outputs SET status='completed',asset_id=? WHERE job_id=?",
    imageId,
    a.id,
  );
  await run("UPDATE jobs SET status='completed' WHERE id=?", a.id);
  const balance = (await call("state")).remaining;
  const reuseRequest = { ...aRequest, requestKey: id() };
  const reused = await call("jobs", reuseRequest, 202);
  assert.equal(reused.id, a.id);
  assert.equal(reused.reused, true);
  assert.equal(
    (await call("state")).remaining,
    balance,
    "Cached use consumes no extra allowance",
  );
  assert.deepEqual((await call("studio-library")).recent, [
    "menu-wood",
    "delivery-white",
  ]);
  const reusedAt = (
    await one(
      "SELECT used_at FROM studio_look_uses WHERE restaurant_id=? AND request_key=?",
      rid,
      reuseRequest.requestKey,
    )
  ).used_at;
  await call("jobs", request("studio-dark"), 202);
  assert.equal((await call("jobs", reuseRequest, 202)).id, a.id);
  assert.equal(
    (
      await one(
        "SELECT used_at FROM studio_look_uses WHERE restaurant_id=? AND request_key=?",
        rid,
        reuseRequest.requestKey,
      )
    ).used_at,
    reusedAt,
  );
  assert.deepEqual((await call("studio-library")).recent, [
    "studio-dark",
    "menu-wood",
    "delivery-white",
  ]);
  await call("jobs", request("delivery-white", reuseRequest.requestKey), 409);
  const concurrent = { ...aRequest, requestKey: id() };
  const replies = await Promise.all([
    call("jobs", concurrent, 202),
    call("jobs", concurrent, 202),
  ]);
  assert(replies.every((reply) => reply.id === a.id && reply.reused));
  assert.equal(
    (
      await one(
        "SELECT COUNT(*) n FROM studio_look_uses WHERE restaurant_id=? AND request_key=?",
        rid,
        concurrent.requestKey,
      )
    ).n,
    1,
  );

  library = await call("studio-library");
  const same = await call(
    "studio-library",
    {
      revision: library.revision,
      library: { ...library, recent: ["beverage-cafe"], favorites: [] },
    },
    200,
    "PUT",
  );
  assert.deepEqual(
    same.recent,
    ["menu-wood", "studio-dark", "delivery-white"],
    "A later library write cannot clobber server-owned recency",
  );
  assert.deepEqual(same.favorites, []);
  await run("UPDATE restaurants SET allowance=0 WHERE id=?", rid);
  const receiptCount = (
    await one(
      "SELECT COUNT(*) n FROM studio_look_uses WHERE restaurant_id=?",
      rid,
    )
  ).n;
  await call("jobs", request("beverage-cafe"), 402);
  assert.equal(
    (
      await one(
        "SELECT COUNT(*) n FROM studio_look_uses WHERE restaurant_id=?",
        rid,
      )
    ).n,
    receiptCount,
    "Rejected creation must not record use",
  );

  // Backfill is repeatable and uses jobs/events rather than old click-based recents.
  await run(
    "DELETE FROM studio_look_uses WHERE restaurant_id=? AND request_key=?",
    rid,
    bRequest.requestKey,
  );
  const backfill = readFileSync(
    "drizzle/0013_nebulous_black_panther.sql",
    "utf8",
  )
    .split("--> statement-breakpoint")
    .slice(2);
  for (let pass = 0; pass < 2; pass++)
    for (const sql of backfill) await run(sql);
  assert.equal(
    (
      await one(
        "SELECT COUNT(*) n FROM studio_look_uses WHERE restaurant_id=? AND request_key=?",
        rid,
        bRequest.requestKey,
      )
    ).n,
    1,
  );
  assert.equal(
    (
      await one(
        "SELECT used_at FROM studio_look_uses WHERE restaurant_id=? AND request_key=?",
        rid,
        bRequest.requestKey,
      )
    ).used_at,
    b.created_at,
  );

  await run("UPDATE restaurants SET allowance=20 WHERE id=?", rid);
  const many = photoStyles.slice(4, 18).map((style) => style.id);
  for (const style of many) await call("jobs", request(style), 202);
  assert.deepEqual(
    (await call("studio-library")).recent,
    many.slice().reverse().slice(0, 12),
    "The collection keeps the twelve newest distinct styles",
  );

  const otherUser = id(),
    otherRestaurant = id(),
    session = id();
  await run(
    "INSERT INTO users (id,email,password,created_at) VALUES (?,?,?,?)",
    otherUser,
    "other-recents@example.test",
    "unused",
    clock,
  );
  await run(
    "INSERT INTO restaurants (id,user_id,name,slug,created_at) VALUES (?,?,?,?,?)",
    otherRestaurant,
    otherUser,
    "Other restaurant",
    "other-recents",
    clock,
  );
  await run(
    "INSERT INTO sessions (hash,user_id,expires_at) VALUES (?,?,?)",
    digest(session),
    otherUser,
    clock + 3600000,
  );
  cookie = "menu_material_session=" + session;
  assert.deepEqual(
    (await call("studio-library")).recent,
    [],
    "Recent use is private to a restaurant",
  );
  cookie = firstCookie;
  assert((await call("studio-library")).recent.includes("menu-wood"));
  const clashKey = id(),
    beforeClash = (await call("state")).remaining;
  const clash = await Promise.all([
    call("jobs", { ...aRequest, requestKey: clashKey }, [202, 409]),
    call("jobs", request("beverage-cafe", clashKey), [202, 409]),
  ]);
  assert.deepEqual(
    clash.map((reply) => reply.status).sort(),
    [202, 409],
    "A cached/new request-key collision has one winner",
  );
  assert.equal(
    (
      await one(
        "SELECT COUNT(*) n FROM studio_look_uses WHERE restaurant_id=? AND request_key=?",
        rid,
        clashKey,
      )
    ).n,
    1,
  );
  const acceptedNew = (
    await one(
      "SELECT COUNT(*) n FROM jobs WHERE restaurant_id=? AND request_key=?",
      rid,
      clashKey,
    )
  ).n;
  assert.equal(
    (await call("state")).remaining,
    beforeClash - acceptedNew,
    "The losing request cannot reserve allowance",
  );

  await run(
    "CREATE TRIGGER qa_recent_write_failure BEFORE INSERT ON studio_look_uses WHEN NEW.preset_id='beverage-citrus' BEGIN SELECT RAISE(ABORT,'Fixture use-receipt failure'); END",
  );
  const failedKey = id(),
    beforeFailure = (await call("state")).remaining;
  await call("jobs", request("beverage-citrus", failedKey), 500);
  await run("DROP TRIGGER qa_recent_write_failure");
  assert.equal(
    (
      await one(
        "SELECT COUNT(*) n FROM jobs WHERE restaurant_id=? AND request_key=?",
        rid,
        failedKey,
      )
    ).n,
    0,
  );
  assert.equal(
    (await call("state")).remaining,
    beforeFailure,
    "Receipt storage failure rolls back the job and quota together",
  );
  console.log(
    `Studio recents: ${checks} API checks; accepted/rejected creation, cache/replay, concurrent retry, server-owned ordering, repeatable backfill and isolation passed. No provider calls.`,
  );
} finally {
  Date.now = realNow;
  rmSync(root, { recursive: true, force: true });
}
