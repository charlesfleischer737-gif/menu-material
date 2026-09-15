import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
const root = mkdtempSync(join(tmpdir(), "plated-expansion-"));
process.env.DISHLIGHT_DATA_DIR = root;
process.env.OPENAI_API_KEY = "fixture-only";
const { handle } = await import("../lib/server/api.ts");
const { all, one, run } = await import("../lib/server/core.ts");
const { publicMenu } = await import("../lib/server/promotions.ts");
const { localToInstant, localTime, defaultStyle } =
  await import("../lib/promotions.ts");
const jpg = readFileSync("public/pasta.jpg"),
  png = readFileSync("public/og.png");
let cookie = "",
  checks = 0,
  calls = 0,
  mode = "partial";
const requests = [];
globalThis.fetch = async (url, init = {}) => {
  assert(String(url).startsWith("https://api.openai.com/v1/"));
  if (init.method === "POST") {
    const b = JSON.parse(init.body);
    requests.push(b);
    if (!b.tools)
      return Response.json({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  items: [
                    {
                      category: "Mains",
                      name: "Menu pasta",
                      description: "Tomato pasta",
                      price: 12.5,
                    },
                    {
                      category: "Drinks",
                      name: "Iced tea",
                      description: "",
                      price: null,
                    },
                  ],
                }),
              },
            ],
          },
        ],
        usage: { input_tokens: 10 },
      });
    calls++;
    return Response.json({ id: "test_" + calls, status: "queued" });
  }
  const num = Number(String(url).split("_").at(-1));
  return Response.json(
    mode === "partial" && num % 2
      ? { status: "failed" }
      : {
          status: "completed",
          output: [
            { type: "image_generation_call", result: png.toString("base64") },
          ],
          usage: { input_tokens: 5 },
        },
  );
};
async function call(path, b, expected = 200, opts = {}) {
  const req = new Request("http://localhost/api/" + path, {
    method: opts.method || (b === undefined ? "GET" : "POST"),
    headers: {
      cookie,
      ...(b === undefined || b instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...opts.headers,
    },
    body:
      b === undefined
        ? undefined
        : b instanceof FormData
          ? b
          : JSON.stringify(b),
  });
  const res = await handle(req);
  let data;
  try {
    data = await res.clone().json();
  } catch {}
  assert.equal(
    res.status,
    expected,
    `${path}: ${res.status} ${JSON.stringify(data)}`,
  );
  checks++;
  if (res.headers.has("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return data;
}
function photo(dishId, kind) {
  const fd = new FormData();
  fd.set("file", new File([jpg], "actual-dish.jpg", { type: "image/jpeg" }));
  fd.set("normalized", new File([jpg], "working.jpg", { type: "image/jpeg" }));
  if (dishId) fd.set("dishId", dishId);
  if (kind) fd.set("kind", kind);
  return fd;
}
try {
  assert.equal(
    localToInstant("2026-03-08T01:30", "America/New_York"),
    Date.parse("2026-03-08T06:30Z"),
  );
  assert.throws(
    () => localToInstant("2026-03-08T02:30", "America/New_York"),
    /does not exist/,
  );
  assert.equal(
    localToInstant("2026-11-01T01:30", "America/New_York", "later") -
      localToInstant("2026-11-01T01:30", "America/New_York", "earlier"),
    3600000,
  );
  assert.equal(
    localToInstant("2026-09-15T09:15", "Asia/Kathmandu"),
    Date.parse("2026-09-15T03:30Z"),
  );
  assert.throws(() => localToInstant("2026-02-30T12:00", "UTC"));
  checks += 5;
  await call("auth/dev", {});
  const ownerCookie = cookie;
  const state = await call("state"),
    r = state.restaurant;
  const inv = await call("admin/invite", {
    email: "foreign@expansion.test",
    allowance: 10,
  });
  cookie = "";
  await call("auth/signup", {
    email: "foreign@expansion.test",
    password: "a sufficiently long password",
    invite: inv.invite,
    restaurant: "Foreign kitchen",
  });
  const foreignCookie = cookie;
  const foreignDish = (
    await call("dishes", {
      name: "Foreign",
      description: "Private",
      confirmed: true,
    })
  ).id;
  const foreignAsset = (await call("assets", photo(foreignDish), 201)).id;
  cookie = ownerCookie;
  const reference = (await call("assets", photo(null, "reference"), 201)).id;
  const logo = (await call("assets", photo(null, "logo"), 201)).id;
  const style = {
    ...defaultStyle,
    primary: "#123456",
    tone: "Short and friendly",
    referenceIds: [reference],
  };
  const hours = Array.from({ length: 7 }, (_, day) => ({
    day,
    open: "11:00",
    close: "22:00",
    closed: false,
  }));
  const profile = {
    name: "QA Kitchen",
    cuisine: "Italian",
    brand: "Simple",
    currency: "USD",
    timezone: "America/New_York",
    style,
    orderingUrl: "https://example.com/order",
    hours,
  };
  await call("restaurant", profile);
  await call(
    "restaurant",
    { ...profile, style: { ...style, referenceIds: [foreignAsset] } },
    400,
  );
  await call(
    "restaurant",
    { ...profile, orderingUrl: "javascript:alert(1)" },
    400,
  );
  await call("restaurant", { ...profile, timezone: "Invalid/Zone" }, 400);
  let fresh = await call("state");
  assert.equal(fresh.restaurant.style.tone, style.tone);
  assert.equal(fresh.restaurant.logo_id, logo);
  const dishInput = {
    name: "Pasta",
    description: "Tomatoes and basil",
    price: 14,
    category: "Pasta",
    preserve: "Exactly 3 basil leaves",
    confirmed: true,
  };
  const dish = (await call("dishes", dishInput)).id;
  const source = (await call("assets", photo(dish), 201)).id;
  const base = {
    type: "special",
    title: "Pasta tonight",
    description: "Our tomato pasta",
    price: 1250,
    caption: "Dinner is ready.",
    startsLocal: localTime(Date.now() - 3600000, r.timezone),
    endsLocal: localTime(Date.now() + 3600000, r.timezone),
    items: [{ dishId: dish, quantity: 1, photoId: source }],
    style,
    activeMs: 45000,
  };
  let promo = (await call("promotions", base)).promotion;
  const pid = promo.id;
  await call(
    "promotions/" + pid + "/publish",
    { revision: promo.revision },
    400,
  );
  await call(
    "promotions/" + pid + "/approve",
    { revision: promo.revision, accurate: true },
    400,
  );
  await call("assets/" + source + "/approve", { accurate: true });
  await call(
    "promotions/" + pid + "/approve",
    { revision: promo.revision, accurate: false },
    400,
  );
  await call("promotions/" + pid + "/approve", {
    revision: promo.revision,
    accurate: true,
  });
  await call("promotions/" + pid + "/export", {
    revision: promo.revision,
    format: "feed",
  });
  assert.equal(
    (await call("state")).restaurant.published,
    null,
    "export does not publish",
  );
  await call("promotions/" + pid + "/publish", { revision: promo.revision });
  let pub = await call("public/" + r.slug);
  assert.equal(pub.menu.specials[0].price, 1250);
  assert.equal(
    pub.menu.sections.length,
    0,
    "publish special does not publish unrelated menu draft",
  );
  const beforeCalls = calls;
  promo = (
    await call("promotions/" + pid, {
      ...base,
      price: 1395,
      revision: promo.revision,
    })
  ).promotion;
  assert.equal(promo.approved_hash, null);
  assert.equal(promo.draft.items[0].photoId, source);
  assert.equal(calls, beforeCalls, "price edit never generates");
  assert.equal(
    (await call("public/" + r.slug)).menu.specials[0].price,
    1250,
    "draft isolated",
  );
  await call(
    "promotions/" + pid + "/publish",
    { revision: promo.revision },
    400,
  );
  await call("promotions/" + pid, { ...base, revision: 1 }, 409);
  await call("promotions/" + pid + "/approve", {
    revision: promo.revision,
    accurate: true,
  });
  await call("promotions/" + pid + "/publish", { revision: promo.revision });
  pub = await call("public/" + r.slug);
  assert.equal(pub.menu.specials[0].price, 1395);
  const persisted = await one("SELECT * FROM restaurants WHERE id=?", r.id),
    publishedOffer = await one("SELECT * FROM promotions WHERE id=?", pid);
  assert.equal(
    (await publicMenu(persisted, publishedOffer.starts_at - 1)).specials.length,
    0,
  );
  assert.equal(
    (await publicMenu(persisted, publishedOffer.starts_at)).specials.length,
    1,
  );
  assert.equal(
    (await publicMenu(persisted, publishedOffer.ends_at)).specials.length,
    0,
    "expires at exact end without worker",
  );
  await call("promotions/" + pid + "/sold-out", {});
  assert.equal((await call("public/" + r.slug)).menu.specials.length, 0);
  await call("promotions/" + pid + "/publish", { revision: promo.revision });
  await call("dishes/" + dish, { ...dishInput, available: false });
  assert.equal((await call("public/" + r.slug)).menu.specials.length, 0);
  await call("dishes/" + dish, dishInput);
  cookie = foreignCookie;
  await call("promotions/" + pid, undefined, 404);
  await call(
    "promotions/" + pid + "/publish",
    { revision: promo.revision },
    404,
  );
  await call("promotions", { ...base }, 404);
  await call("assets/" + reference, undefined, 404);
  cookie = "";
  await call("promotions/" + pid, undefined, 401);
  await call("public/" + r.slug + "/assets/" + source);
  await call("public/" + r.slug + "/assets/" + reference, undefined, 404);
  const sid = crypto.randomUUID();
  await call("public/" + r.slug + "/events", {
    kind: "menu_visit",
    session: sid,
  });
  await call("public/" + r.slug + "/events", {
    kind: "menu_visit",
    session: sid,
  });
  await call("public/" + r.slug + "/events", {
    kind: "dish_view",
    entityId: dish,
    session: sid,
  });
  await call(
    "public/" + r.slug + "/events",
    { kind: "dish_view", entityId: foreignDish, session: sid },
    404,
  );
  await call("public/" + r.slug + "/events", {
    kind: "ordering_click",
    session: sid,
  });
  cookie = ownerCookie;
  let insights = await call("insights");
  assert.equal(insights.counts.menu_visit, 1);
  assert.equal(insights.counts.dish_view, 1);
  assert.equal(insights.active.average, 45000);
  assert.equal(insights.counts.promotion_exported, 1);
  const staff = (await call("staff-links", {})).path.split("/").at(-1);
  cookie = "";
  const staffInfo = await call("staff/" + staff);
  assert(staffInfo.dishes.every((d) => d.id !== foreignDish));
  assert.deepEqual(Object.keys(staffInfo.dishes[0]).sort(), ["id", "name"]);
  await call("staff/" + staff + "/upload", photo(foreignDish), 404);
  const submitted = (
    await call("staff/" + staff + "/upload", photo(dish, "logo"), 201)
  ).id;
  await call("assets/" + submitted, undefined, 401);
  await call("public/" + r.slug + "/assets/" + submitted, undefined, 404);
  cookie = foreignCookie;
  await call("assets/" + submitted + "/approve", { accurate: true }, 404);
  cookie = ownerCookie;
  await call("assets/" + submitted + "/approve", { accurate: true });
  assert.equal(
    (await one("SELECT kind FROM assets WHERE id=?", submitted)).kind,
    "source",
  );
  await call("staff-links/revoke", {});
  cookie = "";
  await call("staff/" + staff, undefined, 404);
  cookie = ownerCookie;
  const fd = new FormData();
  fd.set("file", new File([jpg], "menu.jpg", { type: "image/jpeg" }));
  const imported = (await call("imports", fd)).id;
  await call("imports/" + imported + "/extract", {});
  fresh = await call("state");
  let rows = JSON.parse(fresh.imports.find((i) => i.id === imported).draft);
  assert.equal(rows[1].price, null);
  await call(
    "imports/" + imported + "/review",
    { items: rows, confirmed: true },
    400,
  );
  rows[1].price = 3;
  await call("imports/" + imported, { items: rows });
  cookie = foreignCookie;
  await call("imports/" + imported + "/original", undefined, 404);
  await call(
    "imports/" + imported + "/review",
    { items: rows, confirmed: true },
    404,
  );
  cookie = ownerCookie;
  const countBefore = (
    await all("SELECT id FROM dishes WHERE restaurant_id=?", r.id)
  ).length;
  await Promise.all([
    call("imports/" + imported + "/review", { items: rows, confirmed: true }),
    call("imports/" + imported + "/review", { items: rows, confirmed: true }),
  ]);
  assert.equal(
    (await all("SELECT id FROM dishes WHERE restaurant_id=?", r.id)).length,
    countBefore + 2,
    "review is idempotent",
  );
  assert.equal(
    (await call("public/" + r.slug)).menu.sections.length,
    0,
    "imports never publish",
  );
  const batchId = crypto.randomUUID();
  await call("batches", {
    batchId,
    items: [{ dishId: dish, sourceId: source }],
  });
  await call("batches", {
    batchId,
    items: [{ dishId: dish, sourceId: source }],
  });
  await call("jobs/tick", {});
  await call("jobs/tick", {});
  fresh = await call("state");
  let item = fresh.batchItems.find((b) => b.batch_id === batchId);
  let outs = fresh.outputs.filter((o) => o.job_id === item.job_id);
  assert.equal(outs.filter((o) => o.status === "completed").length, 1);
  const success = outs.find((o) => o.status === "completed").asset_id;
  const callsBeforeRetry = calls;
  mode = "success";
  await call("batches/retry", { id: item.id });
  await call("jobs/tick", {});
  await call("jobs/tick", {});
  fresh = await call("state");
  outs = fresh.outputs.filter((o) => o.job_id === item.job_id);
  assert.equal(outs.filter((o) => o.status === "completed").length, 2);
  assert(outs.some((o) => o.asset_id === success));
  assert.equal(calls - callsBeforeRetry, 1, "only failed slot resubmitted");
  assert(
    requests.some((q) => q.tools && q.input[0].content.length === 3),
    "original and style reference sent",
  );
  const job = fresh.jobs.find((j) => j.id === item.job_id);
  assert.equal(JSON.parse(job.details).preserve, "Exactly 3 basil leaves");
  const suggestions = (await call("suggestions", { goal: "lunch" }))
    .suggestions;
  assert.equal(suggestions.length, 3);
  assert(suggestions.every((s) => s.items[0].photoId && s.price === 1400));
  await call("promotions/" + pid + "/unpublish", {});
  assert.equal((await call("public/" + r.slug)).menu.specials.length, 0);
  await call("public/" + r.slug + "/assets/" + source, undefined, 404);
  const disk = new DatabaseSync(join(root, "dishlight.sqlite"));
  assert.equal(
    disk.prepare("SELECT category,preserve FROM dishes WHERE id=?").get(dish)
      .preserve,
    "Exactly 3 basil leaves",
  );
  assert.equal(
    JSON.parse(
      disk.prepare("SELECT draft FROM promotions WHERE id=?").get(pid).draft,
    ).price,
    1395,
  );
  assert.equal(disk.prepare("SELECT count(*) n FROM menu_imports").get().n, 1);
  disk.close();
  console.log(
    `PASS: ${checks} expansion API/timezone checks plus persistence, price/photo isolation, publication snapshots, exact expiry, DST transitions, staff scope, import review, engagement deduplication and partial batch recovery assertions.`,
  );
  console.log(
    "All provider responses in this test are isolated fixtures. No live generation or sales results claimed.",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
