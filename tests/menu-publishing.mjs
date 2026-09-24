import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-publishing-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.APP_ORIGIN = "http://localhost";
const { handle } = await import("../lib/server/api.ts");
const { one } = await import("../lib/server/core.ts");
const { newMenuDocument, newMenuEntry } =
  await import("../lib/menu-document.ts");
const { menuPublishChecks, blockingChecks, applyDishUpdate, dishFacts } =
  await import("../lib/menu-checks.ts");
const { isPlaceholderRestaurantName, slugify, menuAddressProblem } =
  await import("../lib/restaurant-identity.ts");
let cookie = "",
  checks = 0;
async function call(path, data, expected = 200, method) {
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method: method || (data === undefined ? "GET" : "POST"),
      headers: { cookie, "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  );
  const value = await res.json();
  assert.equal(res.status, expected, `${path}: ${JSON.stringify(value)}`);
  checks++;
  if (res.headers.get("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return value;
}
const section = (items, name = "Mains") => ({
  id: crypto.randomUUID(),
  name,
  description: "",
  pageBreakBefore: false,
  items,
});
try {
  // Restaurant names and menu addresses.
  for (const name of ["My restaurant", "Your restaurant", " restaurant ", ""])
    assert(isPlaceholderRestaurantName(name), name);
  for (const name of ["Corner House", "Bo", "Café Olé"])
    assert(!isPlaceholderRestaurantName(name), name);
  assert.equal(slugify("Café Olé & Grill"), "cafe-ole-and-grill");
  assert.equal(menuAddressProblem("ab"), "Use at least 3 characters.");
  assert.match(menuAddressProblem("Bad Address"), /lowercase/);
  assert.match(menuAddressProblem("double--hyphen"), /single hyphens/);
  assert.equal(menuAddressProblem("corner-house"), "");

  // Automatic checks replace "I checked" boxes.
  const burger = newMenuEntry({
    dishId: crypto.randomUUID(),
    name: "Smash Burger",
    description: "Two patties",
    price: 1600,
  });
  const sample = newMenuEntry({
    dishId: crypto.randomUUID(),
    name: "Sample burger",
    description: "",
    price: 0,
  });
  const menu = newMenuDocument({ sections: [section([burger, sample])] });
  const found = menuPublishChecks(menu, {
    restaurantName: "My restaurant",
    sampleDishIds: [sample.dishId],
  });
  const blocking = blockingChecks(found).map((c) => c.id.split(":")[0]);
  assert.deepEqual(blocking.sort(), ["restaurant-name", "sample", "zero"]);
  assert(
    found.some((c) => c.id === "descriptions" && c.level === "warn"),
    "missing descriptions are a warning, not a blocker",
  );
  const duplicate = newMenuDocument({
    sections: [section([burger, { ...burger, id: crypto.randomUUID() }])],
  });
  assert.deepEqual(
    blockingChecks(
      menuPublishChecks(duplicate, { restaurantName: "Corner House" }),
    ),
    [],
  );
  assert(
    menuPublishChecks(duplicate, { restaurantName: "Corner House" }).some(
      (c) => c.id.startsWith("duplicate") && c.level === "warn",
    ),
  );
  const included = newMenuDocument({
    sections: [section([{ ...sample, dishId: null, priceMode: "included" }])],
  });
  assert.deepEqual(
    blockingChecks(
      menuPublishChecks(included, { restaurantName: "Corner House" }),
    ),
    [],
    "a free item marked Included is fine",
  );

  // Dish edits follow into menus unless the menu tailored that detail.
  const before = dishFacts({
    id: burger.dishId,
    name: "Smash Burger",
    description: "Two patties",
    price: 1600,
    available: 1,
  });
  const after = { ...before, price: 1700, available: false };
  const tailored = { ...burger, id: crypto.randomUUID(), price: 1400 };
  const synced = applyDishUpdate(
    newMenuDocument({ sections: [section([burger, tailored])] }),
    before,
    after,
  );
  assert.equal(synced.changed, 2);
  assert.equal(synced.menu.sections[0].items[0].price, 1700);
  assert.equal(synced.menu.sections[0].items[1].price, 1400);
  assert.equal(synced.menu.sections[0].items[1].available, false);

  // API: a placeholder name blocks publishing until the owner names it.
  await call("auth/dev", {});
  const state = await call("state");
  const rid = state.restaurant.id;
  assert.equal(state.restaurant.name, "Your restaurant");
  const dish = await call("dishes", {
    name: "Smash Burger",
    description: "Two patties",
    price: 16,
    confirmed: true,
  });
  const sampleDish = await call("dishes", {
    name: "Sample burger",
    price: 0,
    confirmed: true,
    sample: true,
  });
  assert.equal(
    (await one("SELECT sample FROM dishes WHERE id=?", sampleDish.id)).sample,
    1,
  );
  const draft = newMenuDocument({
    sections: [
      section([
        newMenuEntry({
          dishId: dish.id,
          name: "Smash Burger",
          description: "Two patties",
          price: 1600,
        }),
        newMenuEntry({
          dishId: sampleDish.id,
          name: "Sample burger",
          price: 0,
        }),
      ]),
    ],
  });
  const created = await call("menus", { id: crypto.randomUUID(), draft });
  const nameBlocked = await call(
    `menus/${created.id}/publish`,
    { revision: created.revision },
    400,
  );
  assert.match(nameBlocked.error, /restaurant’s name/);
  await call("restaurant/name", { name: "My restaurant" }, 400);
  await call("restaurant/name", { name: "Corner House" });
  const sampleBlocked = await call(
    `menus/${created.id}/publish`,
    { revision: created.revision },
    400,
  );
  assert.match(sampleBlocked.error, /sample dish/);
  assert.equal(
    (await one("SELECT slug FROM restaurants WHERE id=?", rid)).slug,
    "local-pilot",
    "a blocked publish never changes the menu address",
  );
  const cleaned = await call(
    `menus/${created.id}`,
    {
      revision: created.revision,
      draft: {
        ...draft,
        sections: [
          { ...draft.sections[0], items: [draft.sections[0].items[0]] },
        ],
      },
    },
    200,
    "PUT",
  );
  // The first publication gives the menu an address from the real name.
  const suggestion = await call("restaurant/address?check=corner-house");
  assert.equal(suggestion.available, true);
  const published = await call(`menus/${created.id}/publish`, {
    revision: cleaned.revision,
  });
  assert(published.published, "published without an I-checked box");
  assert.equal(
    (await one("SELECT slug FROM restaurants WHERE id=?", rid)).slug,
    "corner-house",
  );
  // The old automatic address still resolves for anything already shared.
  const viaOld = await call("public/local-pilot");
  assert.equal(viaOld.menu.restaurant.name, "Corner House");
  await call("public/corner-house");

  // Renaming the address keeps earlier addresses working.
  await call("restaurant/address", { address: "Not Valid!" }, 400);
  await call("restaurant/address", { address: "corner-house-kitchen" });
  assert.equal(
    (await call("public/corner-house")).menu.restaurant.name,
    "Corner House",
  );
  assert.equal(
    (await one("SELECT slug FROM restaurants WHERE id=?", rid)).slug,
    "corner-house-kitchen",
  );
  // Later publications never move the address on their own.
  const again = await call(`menus/${created.id}`);
  await call(`menus/${created.id}/publish`, {
    revision: again.revision,
    address: "somewhere-else",
  });
  assert.equal(
    (await one("SELECT slug FROM restaurants WHERE id=?", rid)).slug,
    "corner-house-kitchen",
  );
  await call("public/nobody-here", undefined, 404);

  // Another restaurant can't claim an address in use or kept as a redirect.
  const ownerCookie = cookie;
  cookie = "";
  await call("auth/signup", {
    email: "second@example.test",
    password: "correct horse battery staple",
    restaurant: "Second Kitchen",
  });
  await call("restaurant/address", { address: "corner-house" }, 409);
  await call("restaurant/address", { address: "corner-house-kitchen" }, 409);
  assert.equal(
    (await call("restaurant/address?check=corner-house")).available,
    false,
  );
  cookie = ownerCookie;

  // A My Dishes price change reaches the draft and the live menu.
  const current = await call(`menus/${created.id}`);
  const saved = await call(`dishes/${dish.id}`, {
    name: "Smash Burger",
    description: "Two patties",
    price: 17.5,
    confirmed: true,
  });
  assert.deepEqual(
    saved.menus.map((m) => [m.id, m.live]),
    [[created.id, true]],
  );
  const updated = await call(`menus/${created.id}`);
  assert.equal(updated.revision, current.revision + 1);
  assert.equal(updated.draft.sections[0].items[0].price, 1750);
  assert.equal(updated.published.sections[0].items[0].price, 1750);
  assert.equal(
    JSON.parse(
      (await one("SELECT published FROM restaurants WHERE id=?", rid))
        .published,
    ).sections[0].items[0].price,
    1750,
    "the main menu's live copy follows",
  );
  assert.equal(
    (await call("public/corner-house-kitchen")).menu.sections[0].items[0]
      .price,
    1750,
  );
  // A tailored menu price stays put.
  await call(
    `menus/${created.id}`,
    {
      revision: updated.revision,
      draft: {
        ...updated.draft,
        sections: [
          {
            ...updated.draft.sections[0],
            items: [{ ...updated.draft.sections[0].items[0], price: 1500 }],
          },
        ],
      },
    },
    200,
    "PUT",
  );
  const unchanged = await call(`dishes/${dish.id}`, {
    name: "Smash Burger",
    description: "Two patties",
    price: 18,
    confirmed: true,
  });
  const tailoredMenu = await call(`menus/${created.id}`);
  assert.equal(tailoredMenu.draft.sections[0].items[0].price, 1500);
  assert.equal(
    tailoredMenu.published.sections[0].items[0].price,
    1800,
    "the live copy still showed the dish price, so it follows",
  );
  assert.equal(unchanged.menus.length, 1);
  // Existing dish rows (sample stored as 0/1) still save.
  const row = await one("SELECT * FROM dishes WHERE id=?", dish.id);
  await call(`dishes/${dish.id}`, {
    ...row,
    price: row.price / 100,
    available: !!row.available,
    confirmed: true,
  });
  console.log(
    `PASS: ${checks} menu publishing checks: placeholder names, sample dishes, zero prices, automatic checks without an I-checked box, first-publication menu address, address changes with redirects, and dish edits reaching draft and live menus.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
