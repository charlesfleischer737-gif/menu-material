import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "native-workspace-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.APP_ORIGIN = "http://localhost";
const { handle } = await import("../lib/server/api.ts");
const { run, one } = await import("../lib/server/core.ts");
let cookie = "",
  checks = 0;
async function call(path, data, expected = 200, method) {
  const result = await handle(
    new Request("http://localhost/api/" + path, {
      method: method ?? (data === undefined ? "GET" : "POST"),
      headers: { cookie, "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  );
  const json = await result.json();
  assert.equal(result.status, expected, `${path}: ${JSON.stringify(json)}`);
  checks++;
  if (result.headers.get("set-cookie"))
    cookie = result.headers.get("set-cookie").split(";")[0];
  return json;
}
try {
  await call("native/config");
  await call("native/styles");
  await call("native/profile", { profile: {} }, 401);
  await call("auth/dev", {});
  let state = await call("state");
  assert.equal(state.restaurant.nativeProfile.completed, false);
  assert.equal(state.restaurant.native_profile, undefined);
  const ownerId = state.restaurant.id;
  const before = await one(
    "SELECT style,brand,currency FROM restaurants WHERE id=?",
    ownerId,
  );
  const profile = {
    completed: true,
    firstName: "Alex",
    role: "Chef",
    goals: ["Better food photos", "Digital menus"],
    defaultLook: "studio-dark",
  };
  await call("native/profile", {
    profile,
    restaurantName: "Olive Kitchen",
    cuisine: "Italian",
  });
  state = await call("state");
  assert.equal(state.restaurant.name, "Olive Kitchen");
  assert.equal(state.restaurant.nativeProfile.defaultLook, "studio-dark");
  assert.equal(state.restaurant.nativeProfile.completed, true);
  assert.deepEqual(
    await one(
      "SELECT style,brand,currency FROM restaurants WHERE id=?",
      ownerId,
    ),
    before,
  );
  await call(
    "native/profile",
    { profile: { ...profile, goals: ["invalid"] } },
    400,
  );
  const d1 = await call("dishes", {
    name: "Tomato soup",
    price: 9,
    available: true,
    confirmed: true,
  });
  const d2 = await call("dishes", {
    name: "Market salad",
    price: 12,
    available: true,
    confirmed: true,
  });
  const request = { id: crypto.randomUUID(), name: "Lunch", dishIds: [d1.id] };
  let menu = await call("native/menus", request);
  assert.equal(menu.draft.sections.flatMap((s) => s.items).length, 1);
  assert.equal(menu.published, null);
  const retry = await call("native/menus", request);
  assert.equal(retry.id, menu.id);
  assert.equal(retry.revision, menu.revision);
  // Preserve unlinked import content, design and variant prices through mobile edits.
  const draft = structuredClone(menu.draft);
  draft.subtitle = "Kept from the web";
  draft.sections[0].items.push({
    ...draft.sections[0].items[0],
    id: "imported",
    dishId: null,
    name: "Imported dessert",
  });
  draft.sections[0].items[0].priceMode = "variants";
  draft.sections[0].items[0].variants = [
    { id: "small", label: "Small", price: 600 },
    { id: "large", label: "Large", price: 900 },
  ];
  menu = await call(
    `menus/${menu.id}`,
    { revision: menu.revision, draft },
    200,
    "PUT",
  );
  const change = {
    id: menu.id,
    revision: menu.revision,
    name: "Lunch & More",
    dishIds: [d1.id, d2.id],
  };
  menu = await call("native/menus", change);
  assert.equal(menu.draft.subtitle, "Kept from the web");
  assert.equal(menu.draft.sections.flatMap((s) => s.items).length, 3);
  assert.equal(menu.draft.sections[0].items[0].variants[1].price, 900);
  const same = await call("native/menus", change);
  assert.equal(same.revision, menu.revision);
  await call("native/menus", { ...change, name: "Stale change" }, 409);
  menu = await call("native/menus", {
    id: menu.id,
    revision: menu.revision,
    name: menu.draft.name,
    dishIds: [d2.id],
  });
  assert.equal(menu.draft.sections.flatMap((s) => s.items).length, 2);
  assert(
    menu.draft.sections
      .flatMap((s) => s.items)
      .some((i) => i.id === "imported"),
  );
  await call(
    "native/menus",
    {
      id: crypto.randomUUID(),
      name: "Foreign",
      dishIds: [crypto.randomUUID()],
    },
    400,
  );
  // The native mutations honor the version gate; public bootstrap stays open.
  process.env.IOS_MIN_VERSION = "9.0";
  const outdated = await handle(
    new Request("http://localhost/api/native/profile", {
      method: "POST",
      headers: {
        cookie,
        "Content-Type": "application/json",
        "X-Menu-Material-Client": "ios",
        "X-Menu-Material-Version": "1.0",
      },
      body: JSON.stringify({ profile }),
    }),
  );
  assert.equal(outdated.status, 426);
  console.log(
    `Native workspace: ${checks} API checks plus persistence, idempotency, ownership and draft preservation assertions passed.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
