import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-publishing-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.APP_ORIGIN = "http://localhost";
const { handle } = await import("../lib/server/api.ts");
const { one, run } = await import("../lib/server/core.ts");
const { newMenuDocument, newMenuEntry } =
  await import("../lib/menu-document.ts");
const {
  menuPublishChecks,
  blockingChecks,
  applyDishUpdate,
  dishFacts,
  withLibraryLinks,
} = await import("../lib/menu-checks.ts");
const { isPlaceholderRestaurantName, slugify, menuAddressProblem } =
  await import("../lib/restaurant-identity.ts");
const { courseIndex } = await import("../lib/menu-paste.ts");
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

  // Course order matches whole words: "Steaks" isn't tea, "Barbecue" isn't
  // the bar.
  const course = (name) => courseIndex(name);
  for (const name of ["Steaks", "Philly cheesesteaks", "Steamed buns"])
    assert.equal(course(name), -1, name);
  assert.equal(course("Barbecue"), -1);
  assert(course("Starters") < course("Mains"));
  assert(course("Mains") < course("Desserts"));
  assert(course("Desserts") < course("Teas & coffee"));
  assert(course("Teas & coffee") < course("Wine bar"));
  assert.equal(course("Pastries"), course("Bakery"));
  assert.equal(course("Sharing plates"), course("Small plates"));
  assert.equal(course("Kids’ menu"), course("Kids"));
  assert.equal(course("Entrées"), course("Main courses"));

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
  assert.equal(
    updated.publishedRevision,
    updated.revision,
    "the live copy is still current after a synced edit",
  );
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
    (await call("public/corner-house-kitchen")).menu.sections[0].items[0].price,
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

  // "Update My Dishes" in the menu builder never publishes a draft edit: the
  // dish library changes, while other menus and every live copy keep theirs.
  const burgerDish = await call("dishes", {
    name: "Burger",
    description: "Cheddar, pickles",
    price: 12,
    confirmed: true,
  });
  const burgerEntry = () =>
    newMenuEntry({
      dishId: burgerDish.id,
      name: "Burger",
      description: "Cheddar, pickles",
      price: 1200,
    });
  const burgerMenus = [];
  for (const name of ["Dinner", "Lunch"]) {
    const saved = await call("menus", {
      id: crypto.randomUUID(),
      draft: newMenuDocument({
        name,
        title: name,
        sections: [section([burgerEntry()], "Burgers")],
      }),
    });
    burgerMenus.push(
      await call(`menus/${saved.id}/publish`, { revision: saved.revision }),
    );
  }
  const [dinnerMenu, lunchMenu] = burgerMenus;
  const dinnerDraft = await call(
    `menus/${dinnerMenu.id}`,
    {
      revision: dinnerMenu.revision,
      draft: {
        ...dinnerMenu.draft,
        sections: [
          {
            ...dinnerMenu.draft.sections[0],
            items: [{ ...dinnerMenu.draft.sections[0].items[0], price: 1400 }],
          },
        ],
      },
    },
    200,
    "PUT",
  );
  const builderSave = await call(`dishes/${burgerDish.id}`, {
    name: "Burger",
    description: "Cheddar, pickles",
    category: "Burgers",
    price: 14,
    confirmed: true,
    syncMenus: false,
  });
  assert.deepEqual(builderSave.menus, [], "no other menu is touched");
  assert.equal(
    (await one("SELECT price FROM dishes WHERE id=?", burgerDish.id)).price,
    1400,
    "My Dishes has the new price",
  );
  const dinnerAfter = await call(`menus/${dinnerMenu.id}`),
    lunchAfter = await call(`menus/${lunchMenu.id}`);
  const burgerPrice = (menu) => menu.sections[0].items[0].price;
  assert.equal(burgerPrice(dinnerAfter.published), 1200, "draft stays private");
  assert.equal(burgerPrice(lunchAfter.published), 1200, "other live menus too");
  assert.equal(burgerPrice(lunchAfter.draft), 1200, "other drafts keep theirs");
  assert.equal(burgerPrice(dinnerAfter.draft), 1400);
  assert.equal(
    dinnerAfter.revision,
    dinnerDraft.revision,
    "the edited menu's draft is left to the editor",
  );
  const slugNow = (await one("SELECT slug FROM restaurants WHERE id=?", rid))
    .slug;
  assert.equal(
    burgerPrice((await call(`public/${slugNow}?menu=${dinnerMenu.id}`)).menu),
    1200,
    "guests still see the published price",
  );

  // A price of 0 saved in My Dishes never reaches guests: the draft takes it
  // (so publishing flags it) and the live menu keeps its last price.
  const friesDish = await call("dishes", {
    name: "Fries",
    description: "Sea salt",
    price: 5,
    confirmed: true,
  });
  const friesSaved = await call("menus", {
    id: crypto.randomUUID(),
    draft: newMenuDocument({
      name: "Sides",
      title: "Sides",
      sections: [
        section(
          [
            newMenuEntry({
              dishId: friesDish.id,
              name: "Fries",
              description: "Sea salt",
              price: 500,
            }),
          ],
          "Sides",
        ),
      ],
    }),
  });
  const friesLive = await call(`menus/${friesSaved.id}/publish`, {
    revision: friesSaved.revision,
  });
  assert.equal(friesLive.publishedRevision, friesLive.revision);
  const zeroed = await call(`dishes/${friesDish.id}`, {
    name: "Skin-on fries",
    description: "Sea salt",
    price: 0,
    confirmed: true,
  });
  assert.deepEqual(
    zeroed.menus.map((m) => [m.id, m.live]),
    [[friesSaved.id, true]],
  );
  const friesAfter = await call(`menus/${friesSaved.id}`);
  const fries = (menu) => menu.sections[0].items[0];
  assert.equal(fries(friesAfter.draft).price, 0, "the draft takes the price");
  assert.equal(fries(friesAfter.published).price, 500, "guests keep theirs");
  assert.equal(
    fries(friesAfter.published).name,
    "Skin-on fries",
    "other details still follow",
  );
  assert.notEqual(
    friesAfter.publishedRevision,
    friesAfter.revision,
    "the live menu is now behind its draft",
  );
  assert(
    blockingChecks(
      menuPublishChecks(friesAfter.draft, { restaurantName: "Corner House" }),
    ).some((c) => c.id.startsWith("zero:")),
    "publishing flags the price",
  );
  assert.equal(
    fries((await call(`public/${slugNow}?menu=${friesSaved.id}`)).menu).price,
    500,
  );

  // Allergen tags in My Dishes reach imported menu dishes linked to them.
  const satayDish = await call("dishes", {
    name: "Satay Skewers",
    description: "Peanut sauce",
    category: "Small plates",
    price: 9,
    confirmed: true,
    dietary: ["contains-peanuts"],
  });
  const pastedSatay = newMenuEntry({
    name: "Satay skewers",
    description: "Peanut sauce",
    price: 900,
  });
  const pastedMenu = await call("menus", {
    id: crypto.randomUUID(),
    draft: newMenuDocument({
      name: "Pasted",
      title: "Pasted",
      sections: [section([pastedSatay], "Small plates")],
    }),
  });
  const { links: satayLinks } = await call(`menus/${pastedMenu.id}/library`, {
    entries: [
      {
        id: pastedSatay.id,
        name: "Satay skewers",
        description: "Peanut sauce",
        category: "Small plates",
        price: 900,
        available: true,
        dietary: [],
      },
    ],
  });
  assert.equal(satayLinks[0].dishId, satayDish.id, "linked by name");
  assert.deepEqual(satayLinks[0].dietary, ["contains-peanuts"]);
  const linkedDraft = withLibraryLinks(pastedMenu.draft, satayLinks);
  assert.equal(linkedDraft.sections[0].items[0].dishId, satayDish.id);
  assert.deepEqual(
    linkedDraft.sections[0].items[0].dietary,
    ["contains-peanuts"],
    "a linked dish without tags takes the dish's allergens",
  );
  assert.deepEqual(
    withLibraryLinks(
      {
        ...pastedMenu.draft,
        sections: [
          {
            ...pastedMenu.draft.sections[0],
            items: [{ ...pastedSatay, dietary: ["Spicy"] }],
          },
        ],
      },
      satayLinks,
    ).sections[0].items[0].dietary,
    ["Spicy"],
    "tags set on the menu stay",
  );
  const pastedSaved = await call(
    `menus/${pastedMenu.id}`,
    { revision: pastedMenu.revision, draft: linkedDraft },
    200,
    "PUT",
  );
  const pastedLive = await call(`menus/${pastedMenu.id}/publish`, {
    revision: pastedSaved.revision,
  });
  assert.deepEqual(pastedLive.published.sections[0].items[0].dietary, [
    "contains-peanuts",
  ]);
  // A dish linked before tags were copied (none of its own) follows tag edits.
  const olderMenu = await call("menus", {
    id: crypto.randomUUID(),
    draft: newMenuDocument({
      name: "Older",
      title: "Older",
      sections: [
        section(
          [
            newMenuEntry({
              dishId: satayDish.id,
              name: "Satay skewers",
              description: "Peanut sauce",
              price: 900,
            }),
          ],
          "Small plates",
        ),
      ],
    }),
  });
  await call(`menus/${olderMenu.id}/publish`, {
    revision: olderMenu.revision,
  });
  const sesame = await call(`dishes/${satayDish.id}`, {
    name: "Satay Skewers",
    description: "Peanut sauce",
    category: "Small plates",
    price: 9,
    confirmed: true,
    dietary: ["contains-peanuts", "contains-sesame"],
  });
  assert.deepEqual(
    sesame.menus.map((m) => [m.id, m.live]).sort(),
    [
      [olderMenu.id, true],
      [pastedMenu.id, true],
    ].sort(),
  );
  for (const id of [pastedMenu.id, olderMenu.id]) {
    const menu = await call(`menus/${id}`);
    for (const copy of [menu.draft, menu.published])
      assert.deepEqual(copy.sections[0].items[0].dietary, [
        "contains-peanuts",
        "contains-sesame",
      ]);
  }
  const untagged = dishFacts({
    id: satayDish.id,
    name: "Satay",
    description: "",
    price: 900,
    available: 1,
    dietary: '["contains-peanuts"]',
  });
  assert.deepEqual(
    applyDishUpdate(
      newMenuDocument({
        sections: [
          section([
            newMenuEntry({ dishId: satayDish.id, name: "Satay", price: 900 }),
          ]),
        ],
      }),
      untagged,
      { ...untagged, dietary: ["contains-peanuts", "contains-sesame"] },
    ).menu.sections[0].items[0].dietary,
    ["contains-peanuts", "contains-sesame"],
    "an empty tag list counts as not set",
  );

  // A photo the owner reported as inaccurate never joins a menu on its own,
  // and a menu showing one gets a warning before publishing.
  const accurate = crypto.randomUUID(),
    reported = crypto.randomUUID();
  for (const [assetId, flagged, age] of [
    [accurate, 0, 2000],
    [reported, 1, 1000],
  ])
    await run(
      "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,mime,name,approved_at,needs_correction,created_at) VALUES (?,?,?,'source',?,'image/png','satay.png',?,?,?)",
      assetId,
      rid,
      satayDish.id,
      `restaurants/${rid}/${assetId}.png`,
      Date.now() - age,
      flagged,
      Date.now() - age,
    );
  await run(
    "UPDATE dishes SET preferred_photo_id=? WHERE id=?",
    reported,
    satayDish.id,
  );
  const photoEntry = newMenuEntry({ name: "Satay skewers", price: 900 });
  const photoMenu = await call("menus", {
    id: crypto.randomUUID(),
    draft: newMenuDocument({
      sections: [section([photoEntry], "Small plates")],
    }),
  });
  const { links: photoLinks } = await call(`menus/${photoMenu.id}/library`, {
    entries: [
      {
        id: photoEntry.id,
        name: "Satay skewers",
        category: "Small plates",
        price: 900,
      },
    ],
  });
  assert.equal(
    photoLinks[0].photoId,
    accurate,
    "the reported photo is skipped, even as the dish's main photo",
  );
  const reportedMenu = newMenuDocument({
    sections: [section([{ ...photoEntry, photoId: reported }])],
  });
  const photoCheck = menuPublishChecks(reportedMenu, {
    restaurantName: "Corner House",
    correctionPhotoIds: [reported],
  }).find((c) => c.id === `photo-reported:${photoEntry.id}`);
  assert.equal(photoCheck?.level, "warn");
  assert.match(photoCheck.message, /reported as inaccurate/);
  assert(
    !menuPublishChecks(reportedMenu, { restaurantName: "Corner House" }).some(
      (c) => c.id.startsWith("photo-reported"),
    ),
  );

  // Taking the main menu offline and publishing it again makes it the main
  // menu again; meanwhile another live menu keeps the main QR code working.
  const mainNow = async () => (await call(`public/${slugNow}`)).menu.documentId;
  const mainMenu = await call(`menus/${created.id}`);
  assert(mainMenu.isPrimary);
  assert.equal(await mainNow(), created.id);
  await call(`menus/${created.id}/unpublish`, {
    revision: mainMenu.revision,
    confirmed: true,
  });
  const standIn = await mainNow();
  assert.notEqual(standIn, created.id, "another live menu stands in");
  const offlineMain = await call(`menus/${created.id}`);
  assert.equal(offlineMain.isPrimary, false, "an offline menu isn't main");
  assert((await call(`menus/${standIn}`)).isPrimary);
  const backOnline = await call(`menus/${created.id}/publish`, {
    revision: offlineMain.revision,
  });
  assert(backOnline.isPrimary, "republished, it's the main menu again");
  assert.equal(await mainNow(), created.id);
  assert.equal((await call(`menus/${standIn}`)).isPrimary, false);
  // A main menu chosen while it was offline stays the main menu.
  await call(`menus/${created.id}/unpublish`, {
    revision: backOnline.revision,
    confirmed: true,
  });
  const chosen = await call(`menus/${lunchMenu.id}`);
  await call(`menus/${lunchMenu.id}/primary`, { revision: chosen.revision });
  const offlineAgain = await call(`menus/${created.id}`);
  const republished = await call(`menus/${created.id}/publish`, {
    revision: offlineAgain.revision,
  });
  assert.equal(republished.isPrimary, false);
  assert.equal(await mainNow(), lunchMenu.id, "the owner's newer choice wins");
  console.log(
    `PASS: ${checks} menu publishing checks: placeholder names, sample dishes, zero prices, automatic checks without an I-checked box, first-publication menu address, address changes with redirects, and dish edits reaching draft and live menus.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
