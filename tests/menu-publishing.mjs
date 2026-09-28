import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-publishing-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.APP_ORIGIN = "http://localhost";
const { handle } = await import("../lib/server/api.ts");
const { bucket, one, run } = await import("../lib/server/core.ts");
const { reportedPhotoNotice } = await import("../lib/photo-use.ts");
const { newMenuDocument, newMenuEntry, menuPrice } =
  await import("../lib/menu-document.ts");
const {
  menuPublishChecks,
  blockingChecks,
  applyDishUpdate,
  dishFacts,
  withDishFacts,
  withDishSafety,
  withLibraryLinks,
  restaurantSettingsChanged,
} = await import("../lib/menu-checks.ts");
const {
  isPlaceholderRestaurantName,
  isPlaceholderDishName,
  dishNameMessage,
  slugify,
  menuAddressProblem,
} = await import("../lib/restaurant-identity.ts");
const { courseIndex, parsePastedMenu } = await import("../lib/menu-paste.ts");
const { printedMenuAddress } = await import("../lib/qr-card.ts");
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
  // A photo added without a name makes an "Untitled dish"; guests never see it.
  for (const name of ["Untitled dish", " untitled  dish ", "Untitled", "New dish"])
    assert(isPlaceholderDishName(name), name);
  for (const name of ["Margherita", "Untitled No. 5 (house special)", ""])
    assert(!isPlaceholderDishName(name), name);
  assert.equal(slugify("Café Olé & Grill"), "cafe-ole-and-grill");
  assert.equal(slugify("Joe's Pizza"), "joes-pizza");
  assert.equal(slugify("Joe’s Diner"), "joes-diner");
  assert.equal(menuAddressProblem("ab"), "Use at least 3 characters.");
  assert.match(menuAddressProblem("Bad Address"), /lowercase/);
  assert.match(menuAddressProblem("double--hyphen"), /single hyphens/);
  assert.equal(menuAddressProblem("corner-house"), "");
  // Addresses guests could take for Menu Material's own pages are reserved.
  for (const address of ["support", "admin", "menu-material", "menumaterial-eats"])
    assert.match(menuAddressProblem(address), /reserved/, address);
  assert.equal(menuAddressProblem("joes-support"), "");

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

  // Pasted menus: common layouts the reader used to misread.
  const shape = (sections) =>
    sections.map((s) => [s.name, s.items.map((i) => i.name)]);
  const pasted = (text, options) => parsePastedMenu(text, options);
  const findDish = (sections, name) =>
    sections.flatMap((s) => s.items).find((i) => i.name === name);
  const titled = pasted(
    "Starters\nSoup of the day 8\nGarlic bread 5\nMains\nBurger 14\nHouse made\nDesserts\nChocolate cake 7\nSmall plates\nWings 9",
  );
  assert.deepEqual(shape(titled), [
    ["Starters", ["Soup of the day", "Garlic bread"]],
    ["Mains", ["Burger"]],
    ["Desserts", ["Chocolate cake"]],
    ["Small plates", ["Wings"]],
  ]);
  assert.equal(findDish(titled, "Burger").description, "House made");
  const capitals = pasted(
    "MAINS\nBURGER 14\nBEEF, CHEDDAR, PICKLES\nWITH FRIES\nSTEAK\n32\nDESSERTS\nCAKE 7\nV",
  );
  assert.deepEqual(shape(capitals), [
    ["MAINS", ["BURGER", "STEAK"]],
    ["DESSERTS", ["CAKE"]],
  ]);
  assert.equal(
    findDish(capitals, "BURGER").description,
    "BEEF, CHEDDAR, PICKLES WITH FRIES",
    "an ingredient line in capitals describes the dish above",
  );
  assert.equal(
    findDish(capitals, "STEAK").price,
    3200,
    "price on the next line",
  );
  assert.equal(findDish(capitals, "CAKE").description, "V");
  // A name, then its description and price on the next line.
  const described = pasted(
    "Mains\nRoast Chicken\npotato purée, charred leeks, jus 26\nHanger Steak\nchimichurri, fries 32\nSoup of the Day\nwith bread MP\nFish tacos 14",
  );
  assert.deepEqual(shape(described), [
    ["Mains", ["Roast Chicken", "Hanger Steak", "Soup of the Day", "Fish tacos"]],
  ]);
  const chicken = findDish(described, "Roast Chicken");
  assert.deepEqual(
    [chicken.description, chicken.price, chicken.sourceUncertain],
    ["potato purée, charred leeks, jus", 2600, ["price"]],
    "the description and price join the dish, and the price is checked",
  );
  assert.equal(findDish(described, "Hanger Steak").price, 3200);
  const soup = findDish(described, "Soup of the Day");
  assert.deepEqual(
    [soup.description, soup.priceMode, soup.priceLabel],
    ["with bread", "label", "Market price"],
  );
  assert.deepEqual(findDish(described, "Fish tacos").sourceUncertain, []);
  // A dish name starting in lowercase is checked, never taken as certain.
  assert.deepEqual(
    findDish(pasted("Mains\nBurger 14\nfries 5"), "fries").sourceUncertain,
    ["name"],
  );
  const wines = pasted(
    "RED WINE\nChateau Margaux 2015\nBordeaux, France 450\nOpus One 2018 520\nEst. 1998",
  );
  const margaux = findDish(wines, "Chateau Margaux 2015");
  assert.equal(margaux.price, 45000, "the year stays in the name");
  assert.equal(margaux.description, "Bordeaux, France");
  assert.deepEqual(margaux.sourceUncertain, ["price"]);
  assert.equal(findDish(wines, "Bordeaux, France"), undefined);
  assert.equal(findDish(wines, "Opus One 2018").price, 52000);
  assert.equal(findDish(wines, "Est. 1998").price, null);
  assert.equal(
    findDish(
      pasted("Tonkotsu ramen 1980\nGyoza 680", { currency: "JPY" }),
      "Tonkotsu ramen",
    ).price,
    198000,
    "a yen price isn't a year",
  );
  assert.equal(
    findDish(
      pasted("Chateau Margaux 2015\n80000", { currency: "JPY" }),
      "Chateau Margaux 2015",
    ).price,
    8000000,
  );
  const lobster = findDish(
    pasted("Lobster 38-45\nOysters 3 – 4\nRoute 66 12"),
    "Lobster",
  );
  assert.deepEqual(
    [lobster.priceMode, lobster.priceLabel, lobster.sourceUncertain],
    ["label", "38–45", ["price"]],
    "a price range is kept as written and marked",
  );
  const unnamed = pasted("12.50\nBurger 14")[0].items[0];
  assert.deepEqual(
    [unnamed.name, unnamed.price, unnamed.sourceUncertain],
    ["", 1250, ["name"]],
    "a price with no dish above it is kept",
  );
  assert(
    [...titled, ...capitals, ...wines]
      .flatMap((s) => s.items)
      .every((i) => !i.sourceReviewed),
    "the owner checks every pasted dish",
  );

  // A table card for a specific menu prints that menu's address.
  const brunchId = crypto.randomUUID();
  assert.equal(
    printedMenuAddress(
      `https://menumaterial.test/m/corner-house?menu=${brunchId}&src=table`,
    ),
    `menumaterial.test/m/corner-house?menu=${brunchId}`,
  );
  assert.equal(
    printedMenuAddress("https://menumaterial.test/m/corner-house?src=table"),
    "menumaterial.test/m/corner-house",
  );

  // Prices use the currency's own decimal places.
  assert.equal(menuPrice(120000, "JPY"), "¥1,200");
  assert.equal(menuPrice(120000, "JPY", "numbers"), "1,200");
  assert.equal(menuPrice(1250, "USD"), "$12.50");
  assert.equal(menuPrice(1200, "USD", "whole"), "12");
  assert.equal(menuPrice(1250, "GBP", "whole"), "12.50");
  assert.equal(menuPrice(120050, "JPY", "whole"), "1,201");

  // API: a placeholder name blocks publishing until the owner names it.
  await call("auth/dev", {});
  // This suite exercises Pro features: comp the workspace (never images).
  {
    const own = (await call("state")).restaurant;
    await call("admin/restaurant", {
      id: own.id,
      allowance: own.allowance,
      paused: false,
      proUntil: Date.now() + 10 * 365 * 86400000,
    });
  }
  const state = await call("state");
  const rid = state.restaurant.id;
  assert.equal(state.restaurant.name, "Your restaurant");
  {
    // Menu links and QR codes use the site's public address, not whichever
    // address the owner is working from; local development uses its own.
    const { menuLinkOrigin } = await import("../lib/server/menu-sharing.ts");
    const { env } = await import("../lib/local-runtime.ts");
    assert.equal(state.menuOrigin, "http://localhost");
    const saved = { local: env.LOCAL_DEVELOPMENT, origin: env.APP_ORIGIN };
    delete env.LOCAL_DEVELOPMENT;
    try {
      env.APP_ORIGIN = "https://menus.example.com/";
      assert.equal(
        menuLinkOrigin("https://preview.example.dev"),
        "https://menus.example.com",
      );
      env.APP_ORIGIN = "not an address";
      assert.equal(
        menuLinkOrigin("https://preview.example.dev"),
        "https://preview.example.dev",
      );
    } finally {
      env.LOCAL_DEVELOPMENT = saved.local;
      env.APP_ORIGIN = saved.origin;
    }
    checks += 3;
  }
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
  // A dish still called "Untitled dish" can't go live either.
  const untitledEntry = newMenuEntry({
    name: "Untitled dish",
    description: "Burger",
    price: 1200,
  });
  const untitledChecks = menuPublishChecks(
    newMenuDocument({ sections: [section([untitledEntry])] }),
    { restaurantName: "Corner House" },
  ).filter((c) => c.fix === "dish-name");
  assert.deepEqual(
    untitledChecks.map((c) => [c.id, c.level, c.message, c.entryId]),
    [[`dish-name:${untitledEntry.id}`, "block", dishNameMessage, untitledEntry.id]],
  );
  const untitledMenu = await call("menus", {
    id: crypto.randomUUID(),
    draft: newMenuDocument({ sections: [section([untitledEntry])] }),
  });
  assert.equal(
    (
      await call(
        `menus/${untitledMenu.id}/publish`,
        { revision: untitledMenu.revision },
        400,
      )
    ).error,
    dishNameMessage,
  );
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
  await call("restaurant/address", { address: "support" }, 400);

  // A guest can report a page; administrators see it under Guest reports.
  cookie = "";
  const reportedSlug = (await one("SELECT slug FROM restaurants WHERE id=?", rid))
    .slug;
  await call(
    `public/${reportedSlug}/report`,
    { reason: "impersonation", details: "Not the real Corner House" },
    202,
  );
  await call(`public/${reportedSlug}/report`, { reason: "spam" }, 400);
  cookie = ownerCookie;
  const [report] = (await call("admin")).menuReports;
  assert.equal(report.restaurant_id, rid);
  assert.equal(report.public_suspended, 0);
  const reportDetails = JSON.parse(report.details);
  assert.deepEqual(
    [reportDetails.reason, reportDetails.details, reportDetails.address],
    ["impersonation", "Not the real Corner House", reportedSlug],
  );

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
    ["contains-peanuts", "Spicy"],
    "tags set on the menu stay, and the dish's allergens join them",
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
  // Published before linked dishes had to show their dish's allergens, which
  // publishing now requires.
  await run(
    "UPDATE menu_documents SET published=draft,published_revision=revision,published_at=? WHERE id=?",
    Date.now(),
    olderMenu.id,
  );
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

  // Allergens and diets are safety facts. A menu dish with tags of its own
  // still gains the allergens its dish gains and loses diets its dish drops,
  // live menus included, even when the edit comes from one menu's builder.
  const menuWith = (name, entries, category) =>
    call("menus", {
      id: crypto.randomUUID(),
      draft: newMenuDocument({
        name,
        title: name,
        sections: [section(entries, category)],
      }),
    });
  const brownie = await call("dishes", {
    name: "Brownie",
    description: "Dark chocolate",
    category: "Desserts",
    price: 8,
    confirmed: true,
    dietary: ["gluten-free", "vegetarian"],
  });
  const dessert = await menuWith(
    "Desserts",
    [
      newMenuEntry({
        dishId: brownie.id,
        name: "Brownie",
        description: "Dark chocolate",
        price: 800,
        dietary: ["gluten-free", "vegetarian", "Served warm"],
      }),
    ],
    "Desserts",
  );
  const dessertLive = await call(`menus/${dessert.id}/publish`, {
    revision: dessert.revision,
  });
  const recipe = await call(`dishes/${brownie.id}`, {
    name: "Brownie",
    description: "Dark chocolate",
    category: "Desserts",
    price: 8,
    confirmed: true,
    dietary: ["vegetarian", "contains-gluten", "contains-egg"],
  });
  assert.deepEqual(
    recipe.menus.map((m) => [m.id, m.live]),
    [[dessert.id, true]],
  );
  const dessertAfter = await call(`menus/${dessert.id}`);
  for (const copy of [dessertAfter.draft, dessertAfter.published])
    assert.deepEqual(
      copy.sections[0].items[0].dietary,
      ["vegetarian", "contains-gluten", "contains-egg", "Served warm"],
      "gluten-free is gone and the new allergens show",
    );
  const brownieSlug = (await one("SELECT slug FROM restaurants WHERE id=?", rid))
    .slug;
  assert.deepEqual(
    (await call(`public/${brownieSlug}?menu=${dessert.id}`)).menu.sections[0]
      .items[0].dietary,
    ["vegetarian", "contains-gluten", "contains-egg", "Served warm"],
  );
  // Restoring the older version keeps its wording, not its stale tags.
  const dessertHistory = (await call(`menus/${dessert.id}/history`)).history;
  const restoredDessert = await call(`menus/${dessert.id}/restore`, {
    revision: dessertAfter.revision,
    historyId: dessertHistory[dessertHistory.length - 1].id,
  });
  assert.equal(dessertLive.published.sections[0].items[0].price, 800);
  assert.deepEqual(restoredDessert.draft.sections[0].items[0].dietary, [
    "vegetarian",
    "contains-gluten",
    "contains-egg",
    "Served warm",
  ]);

  // From the menu builder: other menus keep their price, but gain allergens.
  const padThai = await call("dishes", {
    name: "Pad Thai",
    description: "Rice noodles",
    category: "Noodles",
    price: 15,
    confirmed: true,
    dietary: ["vegetarian"],
  });
  const padEntry = (price, dietary) =>
    newMenuEntry({
      dishId: padThai.id,
      name: "Pad Thai",
      description: "Rice noodles",
      price,
      dietary,
    });
  const padLunch = await menuWith(
    "Pad lunch",
    [padEntry(1500, ["vegetarian", "Spicy"])],
    "Noodles",
  );
  await call(`menus/${padLunch.id}/publish`, { revision: padLunch.revision });
  const fromBuilder = await call(`dishes/${padThai.id}`, {
    name: "Pad Thai",
    description: "Rice noodles",
    category: "Noodles",
    price: 16,
    confirmed: true,
    dietary: ["vegetarian", "contains-peanuts", "contains-egg"],
    syncMenus: false,
  });
  assert.deepEqual(
    fromBuilder.menus.map((m) => [m.id, m.live]),
    [[padLunch.id, true]],
  );
  const padLunchAfter = await call(`menus/${padLunch.id}`);
  for (const copy of [padLunchAfter.draft, padLunchAfter.published]) {
    assert.deepEqual(copy.sections[0].items[0].dietary, [
      "vegetarian",
      "contains-egg",
      "contains-peanuts",
      "Spicy",
    ]);
    assert.equal(copy.sections[0].items[0].price, 1500, "its own price stays");
  }

  // A linked dish can't go live without its allergens, or with a diet My
  // Dishes doesn't give it. "Match My Dishes" fixes both.
  const padFacts = ["vegetarian", "contains-peanuts", "contains-egg"];
  const stale = padEntry(1600, ["vegan"]);
  const staleMenu = await menuWith("Pad dinner", [stale], "Noodles");
  const staleChecks = menuPublishChecks(staleMenu.draft, {
    restaurantName: "Corner House",
    dishes: [{ id: padThai.id, dietary: padFacts }],
  }).filter((c) => c.id.startsWith("dish-tags:"));
  assert.equal(staleChecks.length, 1);
  assert.equal(staleChecks[0].level, "block");
  assert.equal(staleChecks[0].fix, "dish-tags");
  assert.equal(
    staleChecks[0].message,
    "Pad Thai doesn’t match My Dishes: it contains egg and peanuts, and it isn’t marked Vegan there.",
  );
  const refused = await call(
    `menus/${staleMenu.id}/publish`,
    { revision: staleMenu.revision },
    400,
  );
  assert.equal(refused.error, staleChecks[0].message);
  assert.deepEqual(withDishSafety(stale.dietary, padFacts), [
    "contains-egg",
    "contains-peanuts",
  ]);
  assert.deepEqual(
    withDishSafety(["vegetarian"], ["vegan"]),
    ["vegetarian"],
    "a vegan dish suits vegetarians",
  );
  const matched = await call(
    `menus/${staleMenu.id}`,
    {
      revision: staleMenu.revision,
      draft: {
        ...staleMenu.draft,
        sections: [
          {
            ...staleMenu.draft.sections[0],
            items: [
              {
                ...staleMenu.draft.sections[0].items[0],
                dietary: withDishSafety(stale.dietary, padFacts),
              },
            ],
          },
        ],
      },
    },
    200,
    "PUT",
  );
  await call(`menus/${staleMenu.id}/publish`, { revision: matched.revision });
  // The notice names menus that kept their own details.
  const priced = await call(`dishes/${padThai.id}`, {
    name: "Pad Thai",
    description: "Rice noodles",
    category: "Noodles",
    price: 17,
    confirmed: true,
    dietary: padFacts,
  });
  assert.deepEqual(
    priced.menus.map((m) => m.id),
    [staleMenu.id],
    "the menu showing the old price follows",
  );
  assert.deepEqual(priced.kept, [
    { id: padLunch.id, name: "Pad lunch", fields: ["price"] },
  ]);

  // Linking a live menu dish to My Dishes shows its allergens to guests at once.
  const sesameDish = await call("dishes", {
    name: "Sesame noodles",
    description: "Cold",
    category: "Noodles",
    price: 11,
    confirmed: true,
    dietary: ["contains-sesame"],
  });
  const looseEntry = newMenuEntry({
    name: "Sesame noodles",
    description: "Cold",
    price: 1100,
    dietary: ["Spicy"],
  });
  const looseMenu = await menuWith("Noodle bar", [looseEntry], "Noodles");
  await call(`menus/${looseMenu.id}/publish`, { revision: looseMenu.revision });
  const { links: sesameLinks } = await call(`menus/${looseMenu.id}/library`, {
    entries: [
      {
        id: looseEntry.id,
        name: "Sesame noodles",
        description: "Cold",
        category: "Noodles",
        price: 1100,
        available: true,
        dietary: ["Spicy"],
      },
    ],
  });
  assert.equal(sesameLinks[0].dishId, sesameDish.id);
  const looseLive = (await call(`menus/${looseMenu.id}`)).published;
  assert.equal(looseLive.sections[0].items[0].dishId, sesameDish.id);
  assert.deepEqual(looseLive.sections[0].items[0].dietary, [
    "contains-sesame",
    "Spicy",
  ]);

  // "No listed allergens" (the dish was checked and has none) follows My
  // Dishes like a diet claim: menus showing the dish's tags take it, a menu
  // may leave it out, and none may claim it unless My Dishes does. A listed
  // allergen always outranks it.
  assert.deepEqual(
    withDishSafety(["vegan", "no-listed-allergens"], ["vegan"]),
    ["vegan"],
    "My Dishes no longer says none, so the menu stops saying it",
  );
  assert.deepEqual(
    withDishSafety(["Spicy"], ["vegan", "no-listed-allergens"]),
    ["Spicy"],
    "a menu may leave the claim out",
  );
  assert.deepEqual(
    withDishSafety(
      ["no-listed-allergens", "Spicy"],
      ["no-listed-allergens", "contains-sesame"],
    ),
    ["contains-sesame", "Spicy"],
  );
  const riceFacts = (dietary) =>
    dishFacts({
      id: "4f0e7b1e-8a5d-4c52-9d1e-7a7c1f6a2b10",
      name: "Jasmine rice",
      description: "Steamed",
      price: 400,
      available: 1,
      dietary,
    });
  const riceMenu = (dietary) =>
    newMenuDocument({
      sections: [
        section([
          newMenuEntry({
            dishId: riceFacts([]).id,
            name: "Jasmine rice",
            description: "Steamed",
            price: 400,
            dietary,
          }),
        ]),
      ],
    });
  const riceTags = (result) => result.menu.sections[0].items[0].dietary;
  assert.deepEqual(
    riceTags(
      applyDishUpdate(
        riceMenu([]),
        riceFacts([]),
        riceFacts(["no-listed-allergens"]),
      ),
    ),
    ["no-listed-allergens"],
    "a menu dish showing the dish's tags takes it",
  );
  for (const safetyOnly of [false, true])
    assert.deepEqual(
      riceTags(
        applyDishUpdate(
          riceMenu(["no-listed-allergens", "Spicy"]),
          riceFacts(["no-listed-allergens"]),
          riceFacts([]),
          { safetyOnly },
        ),
      ),
      ["Spicy"],
      `dropped in My Dishes, it goes from every menu (safetyOnly: ${safetyOnly})`,
    );
  const unbacked = menuPublishChecks(riceMenu(["no-listed-allergens"]), {
    restaurantName: "Corner House",
    dishes: [{ id: riceFacts([]).id, dietary: ["vegan"] }],
  }).find((c) => c.id.startsWith("dish-tags:"));
  assert.equal(unbacked?.level, "block");
  assert.equal(
    unbacked.message,
    "Jasmine rice is marked “No listed allergens” here, but not in My Dishes.",
  );
  const rice = await call("dishes", {
    name: "Jasmine rice",
    description: "Steamed",
    category: "Sides",
    price: 4,
    confirmed: true,
    dietary: ["vegan", "no-listed-allergens"],
  });
  const sides = await menuWith(
    "Sides",
    [
      newMenuEntry({
        dishId: rice.id,
        name: "Jasmine rice",
        description: "Steamed",
        price: 400,
        dietary: ["vegan", "no-listed-allergens"],
      }),
    ],
    "Sides",
  );
  await call(`menus/${sides.id}/publish`, { revision: sides.revision });
  // Sesame oil goes in: guests see sesame, and no longer "none".
  await call(`dishes/${rice.id}`, {
    name: "Jasmine rice",
    description: "Steamed",
    category: "Sides",
    price: 4,
    confirmed: true,
    dietary: ["vegan", "no-listed-allergens", "contains-sesame"],
  });
  const sidesAfter = await call(`menus/${sides.id}`);
  for (const copy of [sidesAfter.draft, sidesAfter.published])
    assert.deepEqual(copy.sections[0].items[0].dietary, [
      "vegan",
      "contains-sesame",
    ]);
  const claimed = await menuWith(
    "Sides again",
    [
      newMenuEntry({
        dishId: rice.id,
        name: "Jasmine rice",
        description: "Steamed",
        price: 400,
        dietary: ["vegan", "no-listed-allergens"],
      }),
    ],
    "Sides",
  );
  const refusedClaim = await call(
    `menus/${claimed.id}/publish`,
    { revision: claimed.revision },
    400,
  );
  assert.match(
    refusedClaim.error,
    /My Dishes says Jasmine rice contains sesame/,
  );

  // The publish review lists linked dishes whose price or availability
  // differ from My Dishes, each with "Use My Dishes". Menus may mean it (a
  // lunch price), so these never block, here or on the server.
  const libraryDish = (price, available = 1) => ({
    id: crypto.randomUUID(),
    dietary: [],
    price,
    available,
  });
  const library = {
    padThai: libraryDish(1600),
    satay: libraryDish(900, 0),
    laksa: libraryDish(1400),
    roti: libraryDish(0),
    icedTea: libraryDish(500),
    mango: libraryDish(800),
  };
  const linked = (dish, entry) =>
    newMenuEntry({ dishId: dish.id, description: "House recipe", ...entry });
  const factsMenu = newMenuDocument({
    sections: [
      section([
        linked(library.padThai, { name: "Pad Thai", price: 1500 }),
        linked(library.satay, { name: "Satay", price: 900 }),
        linked(library.laksa, { name: "Laksa", price: null, available: false }),
        // No price yet in My Dishes: the menu's own is the only one.
        linked(library.roti, { name: "Roti", price: 600 }),
        // Priced by size: no single price to compare.
        linked(library.icedTea, {
          name: "Iced tea",
          priceMode: "variants",
          variants: [{ id: "s", label: "Small", price: 400 }],
        }),
        // Hidden from this menu: guests never see it.
        linked(library.mango, {
          name: "Mango rice",
          price: 700,
          visible: false,
        }),
      ]),
    ],
  });
  const factsChecks = (menu, currency) =>
    menuPublishChecks(menu, {
      restaurantName: "Corner House",
      dishes: Object.values(library),
      currency,
    }).filter((c) => c.id.startsWith("dish-facts:"));
  const differences = factsChecks(factsMenu);
  assert.deepEqual(
    differences.map((c) => [c.level, c.fix, c.message]),
    [
      ["warn", "dish-facts", "Pad Thai: $15.00 here, $16.00 in My Dishes."],
      [
        "warn",
        "dish-facts",
        "Satay: available here, unavailable in My Dishes.",
      ],
      [
        "warn",
        "dish-facts",
        "Laksa: no price and unavailable here, $14.00 and available in My Dishes.",
      ],
    ],
  );
  assert.equal(
    factsChecks(factsMenu, "EUR")[0].message,
    "Pad Thai: €15.00 here, €16.00 in My Dishes.",
  );
  assert(
    !blockingChecks(
      menuPublishChecks(factsMenu, {
        restaurantName: "Corner House",
        dishes: Object.values(library),
      }),
    ).some((c) => c.id.startsWith("dish-facts:")),
    "never blocking",
  );
  // "Use My Dishes" takes the library's price and availability, and only those.
  const used = {
    ...factsMenu,
    sections: factsMenu.sections.map((s) => ({
      ...s,
      items: s.items.map((i) =>
        withDishFacts(
          i,
          Object.values(library).find((d) => d.id === i.dishId),
        ),
      ),
    })),
  };
  assert.deepEqual(
    used.sections[0].items.map((i) => [i.name, i.price, i.available]),
    [
      ["Pad Thai", 1600, true],
      ["Satay", 900, false],
      ["Laksa", 1400, true],
      ["Roti", 600, true],
      ["Iced tea", null, true],
      ["Mango rice", 800, true],
    ],
  );
  assert.deepEqual(factsChecks(used), [], "nothing left to list");
  // The server's own checks leave them to the owner.
  const lunchPrice = await menuWith(
    "Rice lunch",
    [
      newMenuEntry({
        dishId: rice.id,
        name: "Jasmine rice",
        description: "Steamed",
        price: 300,
        dietary: ["vegan", "contains-sesame"],
      }),
    ],
    "Sides",
  );
  await call(`menus/${lunchPrice.id}/publish`, {
    revision: lunchPrice.revision,
  });

  // A dish made from a photo has no price; linking a pasted menu to it gives
  // it the menu's price and description, so later edits reach that menu.
  const photographed = await call("dishes", {
    name: "Margherita",
    confirmed: true,
  });
  const pastedPizza = newMenuEntry({
    name: "Margherita",
    description: "Tomato, mozzarella",
    price: 1400,
  });
  const pizzaMenu = await menuWith("Pizza", [pastedPizza], "Pizza");
  const { links: pizzaLinks } = await call(`menus/${pizzaMenu.id}/library`, {
    entries: [
      {
        id: pastedPizza.id,
        name: "Margherita",
        description: "Tomato, mozzarella",
        category: "Pizza",
        price: 1400,
        available: true,
        dietary: [],
      },
    ],
  });
  assert.equal(pizzaLinks[0].dishId, photographed.id);
  const pizzaDish = await one(
    "SELECT price,description FROM dishes WHERE id=?",
    photographed.id,
  );
  assert.deepEqual(
    [pizzaDish.price, pizzaDish.description],
    [1400, "Tomato, mozzarella"],
  );
  const pizzaLinked = await call(
    `menus/${pizzaMenu.id}`,
    {
      revision: pizzaMenu.revision,
      draft: withLibraryLinks(pizzaMenu.draft, pizzaLinks),
    },
    200,
    "PUT",
  );
  await call(`menus/${pizzaMenu.id}/publish`, {
    revision: pizzaLinked.revision,
  });
  const repriced = await call(`dishes/${photographed.id}`, {
    name: "Margherita",
    description: "Tomato, mozzarella",
    category: "Pizza",
    price: 15,
    confirmed: true,
  });
  assert.deepEqual(
    repriced.menus.map((m) => [m.id, m.live]),
    [[pizzaMenu.id, true]],
  );
  assert.equal(
    (await call(`menus/${pizzaMenu.id}`)).published.sections[0].items[0].price,
    1500,
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

  // A live menu keeps the restaurant details it was published with, so a
  // change in settings is reported until the menu is published again.
  const livePublished = (await call(`menus/${lunchMenu.id}`)).published;
  const settings = (await call("state")).restaurant;
  assert.equal(restaurantSettingsChanged(livePublished, settings), false);
  for (const change of [
    { name: "Corner House Kitchen" },
    { currency: "EUR" },
    { cuisine: "Diner" },
    { ordering_url: "https://order.example.test" },
    { logo_id: crypto.randomUUID() },
    { style: { ...settings.style, primary: "#123456" } },
    { style: { ...settings.style, typography: "bold" } },
  ])
    assert(
      restaurantSettingsChanged(livePublished, { ...settings, ...change }),
      JSON.stringify(change),
    );
  assert.equal(
    restaurantSettingsChanged(
      { ...livePublished, showLogo: false },
      { ...settings, logo_id: crypto.randomUUID() },
    ),
    false,
    "a menu that hides the logo doesn't need it",
  );
  await call("restaurant/name", { name: "Corner House Kitchen" });
  const renamed = (await call("state")).restaurant;
  assert(restaurantSettingsChanged(livePublished, renamed));
  const lunchLatest = await call(`menus/${lunchMenu.id}`);
  const lunchRepublished = await call(`menus/${lunchMenu.id}/publish`, {
    revision: lunchLatest.revision,
  });
  assert.equal(
    restaurantSettingsChanged(lunchRepublished.published, renamed),
    false,
  );

  // A photo reported as inaccurate leaves what guests see at once, as a
  // deleted one does: live menus, specials and its public copies. Drafts and
  // history keep it, and publishing again leaves it out.
  const peachDish = await call("dishes", {
    name: "Grilled peach",
    description: "Honey and thyme",
    price: 9,
    confirmed: true,
  });
  const peachSource = crypto.randomUUID(),
    peachPhoto = crypto.randomUUID(),
    peachJob = crypto.randomUUID(),
    photoBytes = readFileSync("public/pasta.jpg");
  for (const [assetId, kind] of [
    [peachSource, "source"],
    [peachPhoto, "generated"],
  ]) {
    await bucket().put(`private/${rid}/${kind}/${assetId}`, photoBytes, {
      httpMetadata: { contentType: "image/jpeg" },
    });
    await run(
      "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,mime,name,approved_at,created_at) VALUES (?,?,?,?,?,'image/jpeg','peach.jpg',?,?)",
      assetId,
      rid,
      peachDish.id,
      kind,
      `private/${rid}/${kind}/${assetId}`,
      Date.now(),
      Date.now(),
    );
  }
  // The request that made the AI photo, which a report is about.
  await run(
    "INSERT INTO jobs (id,restaurant_id,dish_id,request_key,fingerprint,prompt,details,input_method,source_id,status,created_at) VALUES (?,?,?,?,'fixture','','{}','photo',?,'completed',?)",
    peachJob,
    rid,
    peachDish.id,
    crypto.randomUUID(),
    peachSource,
    Date.now(),
  );
  await run(
    "INSERT INTO outputs (id,job_id,restaurant_id,slot,status,asset_id,created_at) VALUES (?,?,?,0,'completed',?,?)",
    crypto.randomUUID(),
    peachJob,
    rid,
    peachPhoto,
    Date.now(),
  );
  const peachEntry = () =>
    newMenuEntry({
      dishId: peachDish.id,
      name: "Grilled peach",
      description: "Honey and thyme",
      price: 900,
      photoId: peachPhoto,
    });
  // On the main menu, Lunch, and on a menu of its own.
  const lunchNow = await call(`menus/${lunchMenu.id}`);
  const lunchPeach = await call(
    `menus/${lunchMenu.id}`,
    {
      revision: lunchNow.revision,
      draft: {
        ...lunchNow.draft,
        sections: [
          ...lunchNow.draft.sections,
          section([peachEntry()], "Desserts"),
        ],
      },
    },
    200,
    "PUT",
  );
  await call(`menus/${lunchMenu.id}/publish`, {
    revision: lunchPeach.revision,
  });
  const dessertMenu = await call("menus", {
    id: crypto.randomUUID(),
    draft: newMenuDocument({
      name: "Desserts",
      title: "Desserts",
      sections: [section([peachEntry()], "Desserts")],
    }),
  });
  await call(`menus/${dessertMenu.id}/publish`, {
    revision: dessertMenu.revision,
  });
  // And as tonight's special.
  const zone = (await call("state")).restaurant.timezone;
  const { localTime } = await import("../lib/promotions.ts");
  let special = (
    await call("promotions", {
      type: "special",
      title: "Peach night",
      price: 1200,
      startsLocal: localTime(Date.now() - 3600000, zone),
      endsLocal: localTime(Date.now() + 3600000, zone),
      items: [{ dishId: peachDish.id, quantity: 1, photoId: peachPhoto }],
      style: {},
    })
  ).promotion;
  await call(`promotions/${special.id}/approve`, {
    revision: special.revision,
    accurate: true,
  });
  await call(`promotions/${special.id}/publish`, {
    revision: special.revision,
  });
  // A smaller copy made for phones, and a menu draft from before Menus.
  await bucket().put(`public/${rid}/${peachPhoto}-w480`, photoBytes);
  const legacyDraft = JSON.stringify({
    sections: [
      {
        id: "old",
        name: "Old",
        items: [{ dishId: peachDish.id, photoId: peachPhoto }],
      },
    ],
  });
  await run("UPDATE restaurants SET menu_draft=? WHERE id=?", legacyDraft, rid);
  const peachImage = async () =>
    (
      await handle(
        new Request(
          `http://localhost/api/public/${slugNow}/assets/${peachPhoto}`,
        ),
      )
    ).status;
  const hasPeach = (menu) =>
    menu.sections.some((s) => s.items.some((i) => i.photoId === peachPhoto));
  let guestMenu = (await call(`public/${slugNow}`)).menu;
  assert(hasPeach(guestMenu));
  assert(guestMenu.specials.some((s) => s.id === special.id));
  assert.equal(await peachImage(), 200);

  const peachReport = await call(`photo-corrections/${peachPhoto}`, {
    reason: "ingredients",
    detail: "The peach is a nectarine.",
  });
  assert.deepEqual(
    peachReport.withdrawn.menus.map((m) => [m.id, m.name]).sort(),
    [
      [lunchMenu.id, "Lunch"],
      [dessertMenu.id, "Desserts"],
    ].sort(),
    "the owner hears which menus changed",
  );
  assert.deepEqual(peachReport.withdrawn.specials, [
    { id: special.id, title: "Peach night" },
  ]);
  const notice = reportedPhotoNotice(peachReport.withdrawn);
  assert.match(notice, /^Guests no longer see this photo on your live menus “/);
  assert.match(notice, /“Lunch”/);
  assert.match(notice, /“Desserts”/);
  assert.match(
    notice,
    /Your special “Peach night” is hidden from guests until it has another photo\.$/,
  );
  assert.equal(reportedPhotoNotice({ menus: [], specials: [] }), "");
  assert.equal(
    reportedPhotoNotice({
      menus: [{ id: "brunch", name: "Brunch" }],
      specials: [{ title: "Tacos" }, { title: "" }],
    }),
    "Guests no longer see this photo on your live menu “Brunch”. Choose another photo in Menus and publish again. Your specials “Tacos” and “Special” are hidden from guests until they have another photo.",
  );
  assert.equal(
    reportedPhotoNotice({ menus: [{ id: null, name: "" }] }),
    "Guests no longer see this photo on your live menu. Choose another photo in Menus and publish again.",
    "a live menu from before Menus",
  );
  for (const id of [lunchMenu.id, dessertMenu.id]) {
    const menu = await call(`menus/${id}`);
    assert(!hasPeach(menu.published), "the live copy loses the photo");
    assert(hasPeach(menu.draft), "the draft keeps it for a replacement");
    const history = await one(
      "SELECT snapshot FROM menu_publication_history WHERE menu_id=? ORDER BY created_at DESC LIMIT 1",
      id,
    );
    assert(hasPeach(JSON.parse(history.snapshot)), "history keeps it");
  }
  const main = await one(
    "SELECT published,menu_draft FROM restaurants WHERE id=?",
    rid,
  );
  assert.equal(
    main.published,
    (await one("SELECT published FROM menu_documents WHERE id=?", lunchMenu.id))
      .published,
    "the main menu's copy still mirrors its document",
  );
  assert.equal(main.menu_draft, legacyDraft);
  assert.equal(await bucket().head(`public/${rid}/${peachPhoto}`), null);
  assert.equal(await bucket().head(`public/${rid}/${peachPhoto}-w480`), null);
  assert(await bucket().head(`private/${rid}/generated/${peachPhoto}`));
  guestMenu = (await call(`public/${slugNow}`)).menu;
  assert(!hasPeach(guestMenu));
  assert(
    !guestMenu.specials.some((s) => s.id === special.id),
    "the special waits for another photo",
  );
  assert.equal(await peachImage(), 404);
  // Publishing again leaves it out; the draft still shows it, with a warning.
  const dessertAgain = await call(`menus/${dessertMenu.id}`);
  const republishedDessert = await call(`menus/${dessertMenu.id}/publish`, {
    revision: dessertAgain.revision,
  });
  assert(!hasPeach(republishedDessert.published));
  assert(hasPeach(republishedDessert.draft));
  assert.equal(await peachImage(), 404);
  // Nor is one served that a live copy still names, as when a publication
  // races the report.
  const withOriginal = await call(
    `menus/${dessertMenu.id}`,
    {
      revision: republishedDessert.revision,
      draft: newMenuDocument({
        ...republishedDessert.draft,
        sections: [section([{ ...peachEntry(), photoId: peachSource }])],
      }),
    },
    200,
    "PUT",
  );
  await call(`menus/${dessertMenu.id}/publish`, {
    revision: withOriginal.revision,
  });
  const originalImage = async () =>
    (
      await handle(
        new Request(
          `http://localhost/api/public/${slugNow}/assets/${peachSource}?menu=${dessertMenu.id}`,
        ),
      )
    ).status;
  assert.equal(await originalImage(), 200);
  await run("UPDATE assets SET needs_correction=1 WHERE id=?", peachSource);
  assert.equal(await originalImage(), 404);
  // A campaign can't go out again with the reported photo.
  special = (await call(`promotions/${special.id}`)).promotion;
  const refusedSpecial = await call(
    `promotions/${special.id}/publish`,
    { revision: special.revision },
    400,
  );
  assert.match(refusedSpecial.error, /reported the photo of Grilled peach/);
  console.log(
    `PASS: ${checks} menu publishing checks: placeholder names, sample dishes, zero prices, automatic checks without an I-checked box, first-publication menu address, address changes with redirects, dish edits reaching draft and live menus, "No listed allergens" following My Dishes, linked dishes whose price or availability differ from My Dishes listed without blocking, and reported photos leaving live menus, specials and public copies.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
