import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-guest-value-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.APP_ORIGIN = "http://localhost";
const { handle } = await import("../lib/server/api.ts");
const { one, all, digest } = await import("../lib/server/core.ts");
const { housekeeping } = await import("../lib/server/safeguards.ts");
const { newMenuDocument, newMenuEntry, menuPurposePatch, uncertainFields } =
  await import("../lib/menu-document.ts");
const {
  parsePastedMenu,
  inferMenuPurpose,
  attachAddons,
  isAddonName,
  addonLabel,
} = await import("../lib/menu-paste.ts");
const {
  menuPublishChecks,
  attachAddonToDishAbove,
  hasPriceInName,
  applyDishUpdate,
  dishFacts,
} = await import("../lib/menu-checks.ts");
const {
  normalizeDietary,
  printedDietary,
  dietaryKey,
  dietaryParts,
  containsText,
  suitsDiet,
} = await import("../lib/dietary.ts");
const { composeMenu } = await import("../lib/menu-layout.ts");
const { openingStatus, telephoneHref, directionsHref } =
  await import("../lib/restaurant-contact.ts");
const { menuStructuredData, menuPreviewImage, jsonLd } =
  await import("../lib/menu-structured-data.ts");
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
// A guest's phone: no workspace session, optionally from a given address.
async function guestCall(path, data, expected = 200, ip) {
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ip ? { "cf-connecting-ip": ip } : {}),
      },
      body: JSON.stringify(data),
    }),
  );
  const value = await res.json();
  assert.equal(res.status, expected, `${path}: ${JSON.stringify(value)}`);
  checks++;
  return value;
}
const section = (items, name = "Mains") => ({
  id: crypto.randomUUID(),
  name,
  description: "",
  pageBreakBefore: false,
  items,
});
const find = (sections, name) =>
  sections.flatMap((s) => s.items).find((i) => i.name === name);
try {
  // Pasted café menus: sizes, add-ons, market price, leaders and separators.
  const pasted = parsePastedMenu(`BREAKFAST
Avocado toast — sourdough, chili crisp, lime 12.50
Buttermilk pancakes — maple syrup, whipped butter 11.00
Add bacon 3.00
+ side of fruit 4
1/2 chicken 16.00
Fish tacos — cod / shrimp 14.00
PASTRIES
Butter croissant 4.25
Morning bun
4.75
COFFEE
Drip coffee 3.00 / 3.50
Latte 12oz 4.75 / 16oz 5.50
Espresso ........ $3.25
WINE — glass / bottle
House red — Tempranillo 12 / 48
Oysters MP
Ramen 1,200`);
  assert.deepEqual(
    pasted.map((s) => s.name),
    ["BREAKFAST", "PASTRIES", "COFFEE", "WINE"],
  );
  const pancakes = find(pasted, "Buttermilk pancakes");
  assert.deepEqual(
    pancakes.additions.map((a) => [a.label, a.price]),
    [
      ["Bacon", 300],
      ["Side of fruit", 400],
    ],
    "Add… and + lines become add-ons of the dish above",
  );
  assert.deepEqual(pancakes.sourceUncertain, ["addons"]);
  assert.equal(find(pasted, "Add bacon"), undefined);
  assert.equal(find(pasted, "1/2 chicken").price, 1600);
  assert.equal(find(pasted, "Fish tacos").description, "cod / shrimp");
  assert.equal(find(pasted, "Fish tacos").price, 1400);
  assert.equal(find(pasted, "Morning bun").price, 475, "price on its own line");
  const drip = find(pasted, "Drip coffee");
  assert.equal(drip.priceMode, "variants");
  assert.deepEqual(
    drip.variants.map((v) => [v.label, v.price]),
    [
      ["Small", 300],
      ["Large", 350],
    ],
  );
  assert.deepEqual(drip.sourceUncertain, ["sizes"], "guessed size names");
  assert.equal(uncertainFields(drip.sourceUncertain), "size names");
  const latte = find(pasted, "Latte");
  assert.deepEqual(
    latte.variants.map((v) => [v.label, v.price]),
    [
      ["12oz", 475],
      ["16oz", 550],
    ],
  );
  assert.deepEqual(latte.sourceUncertain, []);
  assert.equal(find(pasted, "Espresso").price, 325, "dot leaders");
  const red = find(pasted, "House red");
  assert.deepEqual(
    red.variants.map((v) => [v.label, v.price]),
    [
      ["Glass", 1200],
      ["Bottle", 4800],
    ],
    "size names from the section heading",
  );
  assert.deepEqual(red.sourceUncertain, []);
  assert.equal(find(pasted, "Oysters").priceMode, "label");
  assert.equal(find(pasted, "Oysters").priceLabel, "Market price");
  assert.equal(find(pasted, "Ramen").price, 120000, "thousands separator");
  for (const item of pasted.flatMap((s) => s.items))
    assert.doesNotMatch(item.name, /\d\.\d\d|\/$/, item.name);
  assert(isAddonName("Add bacon") && isAddonName("+ oat milk"));
  assert(!isAddonName("Addis platter") && !isAddonName("Extra spicy wings"));
  assert.equal(addonLabel("Add-on: avocado"), "Avocado");
  // File imports (one price per row) get the same add-on handling.
  const imported = attachAddons([
    section([
      newMenuEntry({ name: "Pancakes", price: 1100 }),
      newMenuEntry({ name: "Add bacon", price: 300 }),
    ]),
  ]);
  assert.equal(imported[0].items.length, 1);
  assert.deepEqual(imported[0].items[0].sourceUncertain, ["addons"]);

  // Menu types from section names.
  assert.equal(
    inferMenuPurpose(["BREAKFAST", "SANDWICHES", "PASTRIES", "COFFEE"]),
    "cafe",
  );
  assert.equal(inferMenuPurpose(["Brunch", "Eggs", "Sides"]), "brunch");
  assert.equal(inferMenuPurpose(["Starters", "Mains", "Wine"]), "dinner");
  assert.equal(inferMenuPurpose(["Beer", "Wine", "Cocktails"]), "drinks");
  assert.equal(inferMenuPurpose(["Cocktails", "Spirits"]), "cocktails");
  assert.equal(inferMenuPurpose(["Smoothies", "Juices", "Bowls"]), "smoothies");
  assert.equal(inferMenuPurpose(["Specials"]), null);
  assert.deepEqual(
    menuPurposePatch(
      { purpose: "dinner", name: "Dinner menu", title: "Dinner" },
      "cafe",
    ),
    { purpose: "cafe", title: "Menu", name: "Café menu" },
  );
  assert.deepEqual(
    menuPurposePatch(
      { purpose: "dinner", name: "Weekend", title: "Our kitchen" },
      "brunch",
    ),
    { purpose: "brunch" },
    "names the owner chose stay",
  );

  // Automatic checks catch what an import left behind.
  assert(hasPriceInName("Drip coffee 3.00 /"));
  assert(!hasPriceInName("Route 66") && !hasPriceInName("7.5% IPA"));
  const mangled = newMenuEntry({ name: "Drip coffee 3.00 /", price: 350 });
  const cakes = newMenuEntry({ name: "Pancakes", price: 1100 });
  const bacon = newMenuEntry({ name: "Add bacon", price: 300 });
  const breakfast = newMenuDocument({
    sections: [
      section([cakes, bacon], "Breakfast"),
      section([mangled], "Coffee"),
    ],
  });
  const found = menuPublishChecks(breakfast, { restaurantName: "Juniper" });
  const byKind = (kind) => found.filter((c) => c.id.startsWith(kind));
  assert.equal(byKind("price-name")[0].entryId, mangled.id);
  assert.equal(byKind("price-name")[0].level, "warn");
  assert.equal(byKind("addon:")[0].fix, "attach-addon");
  assert.match(byKind("addon:")[0].message, /add-on for Pancakes/);
  assert.equal(byKind("menu-type")[0].purpose, "cafe");
  assert.match(byKind("menu-type")[0].message, /titled “Dinner”.*café menu/);
  assert(
    !menuPublishChecks(
      { ...breakfast, title: "Mornings" },
      { restaurantName: "Juniper" },
    ).some((c) => c.id === "menu-type"),
    "a title the owner chose is never second-guessed",
  );
  const attached = attachAddonToDishAbove(breakfast, bacon.id, "Bacon");
  assert.deepEqual(
    attached.sections[0].items.map((i) => i.name),
    ["Pancakes"],
  );
  assert.deepEqual(
    attached.sections[0].items[0].additions.map((a) => [a.label, a.price]),
    [["Bacon", 300]],
  );

  // API: imported dishes join My Dishes (matched by name, or created).
  await call("auth/dev", {});
  await call("restaurant/name", { name: "Juniper Café" });
  const croissant = await call("dishes", {
    name: "Butter Croissant",
    category: "Pastries",
    price: 4.25,
    confirmed: true,
  });
  const toast = newMenuEntry({
    name: "Avocado toast",
    description: "Sourdough",
    price: 1250,
    dietary: ["vegetarian"],
  });
  const flaky = newMenuEntry({ name: "butter croissant", price: 450 });
  const sized = newMenuEntry({
    name: "Latte",
    priceMode: "variants",
    variants: [
      { id: "s", label: "12oz", price: 475 },
      { id: "l", label: "16oz", price: 550 },
    ],
  });
  const menuDraft = newMenuDocument({
    sections: [
      section([toast], "Breakfast"),
      section([flaky], "Pastries"),
      section([sized], "Coffee"),
    ],
  });
  const menu = await call("menus", {
    id: crypto.randomUUID(),
    draft: menuDraft,
  });
  const published = await call(`menus/${menu.id}/publish`, {
    revision: menu.revision,
  });
  assert.equal(published.published.sections[0].items[0].dishId, null);
  const entries = [
    [toast, "Breakfast", 1250],
    [flaky, "Pastries", 450],
    [sized, "Coffee", 475],
  ].map(([i, category, price]) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    category,
    price,
    available: true,
    dietary: i.dietary,
  }));
  const { links } = await call(`menus/${menu.id}/library`, { entries });
  const link = (entry) => links.find((l) => l.entryId === entry.id);
  assert.equal(link(flaky).dishId, croissant.id, "matched by name");
  assert.equal(link(flaky).created, false);
  assert(link(toast).created && link(sized).created);
  const created = await one(
    "SELECT * FROM dishes WHERE id=?",
    link(toast).dishId,
  );
  assert.equal(created.name, "Avocado toast");
  assert.equal(created.category, "Breakfast");
  assert.equal(created.price, 1250);
  assert.equal(created.dietary, '["vegetarian"]');
  assert(created.confirmed_at, "reviewed dishes are confirmed");
  assert.equal(
    (await one("SELECT price FROM dishes WHERE id=?", link(sized).dishId))
      .price,
    475,
    "sizes keep the lowest price in My Dishes",
  );
  const live = await call(`menus/${menu.id}`);
  assert.equal(
    live.published.sections[0].items[0].dishId,
    link(toast).dishId,
    "the live copy is linked, so later dish edits reach guests",
  );
  assert.equal(
    live.revision,
    published.revision,
    "the draft stays the editor's",
  );
  const retried = await call(`menus/${menu.id}/library`, { entries });
  assert.deepEqual(
    retried.links.map((l) => [l.entryId, l.dishId]),
    links.map((l) => [l.entryId, l.dishId]),
    "a retry never duplicates dishes",
  );
  assert.equal(
    (await one("SELECT count(*) AS n FROM dishes WHERE name='Avocado toast'"))
      .n,
    1,
  );
  // Another restaurant can't link into this menu or reuse its dishes.
  const ownerCookie = cookie;
  cookie = "";
  await call("auth/signup", {
    email: "other@example.test",
    password: "correct horse battery staple",
    restaurant: "Other Kitchen",
  });
  await call(`menus/${menu.id}/library`, { entries }, 404);
  assert.equal(
    (await call("menus/stats")).published,
    false,
    "stats belong to their restaurant",
  );
  cookie = ownerCookie;

  // Dietary tags: a fixed vocabulary, older free-text notes kept as written.
  assert.deepEqual(
    normalizeDietary(["Contains milk", "V", "gluten free", "Spicy", "v"]),
    ["vegetarian", "gluten-free", "contains-milk", "Spicy"],
  );
  assert.deepEqual(normalizeDietary('["vegan"]'), ["vegan"], "dish rows");
  assert.deepEqual(normalizeDietary("not json"), []);
  assert.equal(
    printedDietary(["vegetarian", "contains-milk", "contains-egg", "Spicy"]),
    "V · Contains: milk, egg · Spicy",
  );
  // Allergens are labeled as such, in one consistent case.
  assert.equal(
    containsText(dietaryParts(["contains-gluten", "contains-soy"]).allergens),
    "Contains: gluten, soy",
  );
  assert.equal(containsText([]), "");
  // A vegan dish suits vegetarians and dairy-free diets too…
  assert(suitsDiet(["vegan"], "vegan"));
  assert(suitsDiet(["vegan"], "vegetarian"), "vegan counts as vegetarian");
  assert(suitsDiet('["vegan"]', "dairy-free"), "vegan counts as dairy-free");
  assert(!suitsDiet(["vegan"], "gluten-free"));
  assert(!suitsDiet(["vegetarian"], "vegan"));
  assert(suitsDiet(["dairy-free"], "dairy-free"));
  // …unless an allergen tag says otherwise.
  assert(!suitsDiet(["vegan", "contains-milk"], "dairy-free"));
  assert(!suitsDiet(["vegan", "contains-fish"], "vegetarian"));
  assert(!suitsDiet(["Vegan option on request"], "vegetarian"), "notes");
  assert.equal(
    dietaryKey([{ dietary: ["vegan"] }, { dietary: ["contains-sesame"] }]),
    "VG vegan. Please tell us about any allergies before you order.",
  );
  assert.equal(
    dietaryKey([{ dietary: ["contains-sesame"] }], "Ask us about allergens."),
    "",
    "the owner's own allergy note isn't repeated",
  );
  assert.deepEqual(dietaryParts(["dairy-free", "Halal"]).notes, ["Halal"]);
  // The printed menu carries codes under dishes and a key at its foot.
  const tagged = newMenuDocument({
    footer: "Service not included.",
    sections: [
      section([
        newMenuEntry({
          name: "Harvest bowl",
          price: 1350,
          dietary: ["vegan", "gluten-free", "contains-sesame"],
        }),
        newMenuEntry({ name: "Turkey club", price: 1450 }),
      ]),
    ],
  });
  const layout = composeMenu(
    { ...tagged, restaurant: { name: "Juniper Café", currency: "USD" } },
    (text, font, size) => text.length * size * 0.52,
  );
  const texts = layout.pages[0].elements.filter((e) => e.kind === "text");
  assert.equal(
    texts.find((t) => t.role === "dietary").text,
    "VG · GF · Contains: sesame",
  );
  assert.equal(
    texts
      .filter((t) => t.role === "footer")
      .map((t) => t.text)
      .join(" "),
    "Service not included. VG vegan · GF gluten-free. Please tell us about any allergies before you order.",
  );
  // A My Dishes tag edit follows into menus that showed the old tags.
  const tagBefore = dishFacts({
    id: toast.dishId || crypto.randomUUID(),
    name: "Toast",
    description: "",
    price: 900,
    available: 1,
    dietary: '["vegetarian"]',
  });
  const tagMenu = newMenuDocument({
    sections: [
      section([
        newMenuEntry({
          dishId: tagBefore.id,
          name: "Toast",
          price: 900,
          dietary: ["vegetarian"],
        }),
        newMenuEntry({
          dishId: tagBefore.id,
          name: "Toast",
          price: 900,
          dietary: ["Spicy"],
        }),
      ]),
    ],
  });
  const tagSynced = applyDishUpdate(tagMenu, tagBefore, {
    ...tagBefore,
    dietary: ["vegan"],
  });
  assert.equal(tagSynced.changed, 1, "the tailored note stays");
  assert.deepEqual(tagSynced.menu.sections[0].items[0].dietary, ["vegan"]);
  assert.deepEqual(tagSynced.menu.sections[0].items[1].dietary, ["Spicy"]);

  // API: tags save on dishes, survive saves that leave them out, and sync.
  const tagged1 = await call("dishes", {
    name: "Harvest bowl",
    price: 13.5,
    category: "Salads",
    confirmed: true,
    dietary: ["Vegan", "contains-sesame"],
  });
  const withTags = (await call("state")).dishes.find(
    (d) => d.id === tagged1.id,
  );
  assert.deepEqual(withTags.dietary, ["vegan", "contains-sesame"]);
  const tagMenuSaved = await call("menus", {
    id: crypto.randomUUID(),
    draft: newMenuDocument({
      sections: [
        section(
          [
            newMenuEntry({
              dishId: tagged1.id,
              name: "Harvest bowl",
              price: 1350,
              dietary: ["vegan", "contains-sesame"],
            }),
          ],
          "Salads",
        ),
      ],
    }),
  });
  await call(`dishes/${tagged1.id}`, {
    name: "Harvest bowl",
    price: 13.5,
    category: "Salads",
    confirmed: true,
  });
  assert.equal(
    (await one("SELECT dietary FROM dishes WHERE id=?", tagged1.id)).dietary,
    '["vegan","contains-sesame"]',
    "a save without tags keeps them",
  );
  const retagged = await call(`dishes/${tagged1.id}`, {
    name: "Harvest bowl",
    price: 13.5,
    category: "Salads",
    confirmed: true,
    dietary: ["vegetarian", "contains-sesame", "contains-milk"],
  });
  assert.deepEqual(
    retagged.menus.map((m) => m.id),
    [tagMenuSaved.id],
  );
  assert.deepEqual(
    (await call(`menus/${tagMenuSaved.id}`)).draft.sections[0].items[0].dietary,
    ["vegetarian", "contains-milk", "contains-sesame"],
  );

  // Open now, from the restaurant's hours in its own timezone.
  const week = [
    { day: 0, open: "10:00", close: "14:00", closed: true },
    ...[1, 2, 3, 4, 5].map((day) => ({
      day,
      open: "09:00",
      close: "15:00",
      closed: false,
    })),
    { day: 6, open: "18:00", close: "02:00", closed: false },
  ];
  const at = (iso) =>
    openingStatus(week, "America/New_York", Date.parse(iso))?.label.replace(
      /\s/g,
      " ",
    );
  assert.equal(at("2026-09-21T14:00:00Z"), "Open now · until 3 PM"); // Mon 10:00
  assert.equal(at("2026-09-21T12:00:00Z"), "Closed · opens at 9 AM"); // Mon 8:00
  assert.equal(at("2026-09-21T20:00:00Z"), "Closed · opens tomorrow at 9 AM"); // Mon 16:00
  assert.equal(at("2026-09-25T20:00:00Z"), "Closed · opens tomorrow at 6 PM"); // Fri 16:00
  assert.equal(at("2026-09-27T03:00:00Z"), "Open now · until 2 AM"); // Sat 23:00
  assert.equal(at("2026-09-27T05:00:00Z"), "Open now · until 2 AM"); // Sun 1:00
  assert.equal(at("2026-09-27T16:00:00Z"), "Closed · opens tomorrow at 9 AM"); // Sunday, closed all day
  assert.equal(openingStatus([], "America/New_York", Date.now()), null);
  assert.equal(telephoneHref("(555) 123-4567"), "tel:5551234567");
  assert.match(
    directionsHref("Juniper", "12 Market St"),
    /query=Juniper%2C%2012/,
  );

  // API: contact details save in settings and reach guests without a republish.
  const restaurantState = (await call("state")).restaurant;
  const settings = {
    name: restaurantState.name,
    cuisine: "Café",
    brand: "",
    currency: "USD",
    timezone: "America/New_York",
    orderingUrl: "https://order.example.test/juniper",
    hours: week,
  };
  await call("restaurant", { ...settings, phone: "call me" }, 400);
  await call(
    "restaurant",
    { ...settings, reservationUrl: "javascript:alert(1)" },
    400,
  );
  await call("restaurant", {
    ...settings,
    phone: "(555) 123-4567",
    address: "12 Market Street, Springfield",
    reservationUrl: "https://book.example.test/juniper",
  });
  const slug = (await call("state")).restaurant.slug;
  const guest = await call(`public/${slug}`);
  assert.deepEqual(
    [
      guest.menu.contact.phone,
      guest.menu.contact.address,
      guest.menu.contact.reservationUrl,
      guest.menu.contact.orderingUrl,
      guest.menu.contact.hours.length,
      guest.menu.contact.timezone,
    ],
    [
      "(555) 123-4567",
      "12 Market Street, Springfield",
      "https://book.example.test/juniper",
      "https://order.example.test/juniper",
      7,
      "America/New_York",
    ],
    "live contact details, no republish needed",
  );
  // Guest actions are counted with the menu and the QR code's placement.
  const session = crypto.randomUUID();
  await guestCall(`public/${slug}/events`, {
    kind: "call_click",
    session,
    src: "table",
  });
  await guestCall(`public/${slug}/events`, {
    kind: "menu_visit",
    session,
    src: "table",
  });
  await guestCall(
    `public/${slug}/events`,
    { kind: "menu_visit", session, src: "billboard" },
    400,
  );
  // The owner opening their own menu isn't counted as a guest.
  const guestVisits = async () =>
    (await one("SELECT count(*) AS n FROM events WHERE kind='menu_visit'")).n;
  const visitsBefore = await guestVisits();
  assert.equal(
    (
      await call(`public/${slug}/events`, {
        kind: "menu_visit",
        session: crypto.randomUUID(),
      })
    ).counted,
    false,
  );
  assert.equal(await guestVisits(), visitsBefore, "owner visits aren't kept");
  const visitRow = await one(
    "SELECT details FROM events WHERE kind='menu_visit' ORDER BY created_at DESC LIMIT 1",
  );
  assert.deepEqual(JSON.parse(visitRow.details), {
    menu: guest.menu.documentId,
    src: "table",
  });

  // Menu stats: last 7 days against the 7 before, by placement and menu.
  await guestCall(`public/${slug}/events`, {
    kind: "dish_view",
    session,
    entityId: toast.id,
  });
  const other = crypto.randomUUID();
  await guestCall(`public/${slug}/events`, {
    kind: "menu_visit",
    session: other,
  });
  await guestCall(`public/${slug}/events`, {
    kind: "dish_view",
    session: other,
    entityIds: [toast.id],
  });
  await guestCall(`public/${slug}/events`, {
    kind: "ordering_click",
    session: other,
  });
  // A visit from last week, for the comparison.
  const { run } = await import("../lib/server/core.ts");
  await run(
    "INSERT INTO events (id,restaurant_id,kind,entity_id,details,created_at) VALUES (?,?,'menu_visit',NULL,'{}',?)",
    crypto.randomUUID(),
    restaurantState.id,
    Date.now() - 9 * 24 * 60 * 60 * 1000,
  );
  const stats = await call("menus/stats");
  assert.equal(stats.published, true);
  assert.equal(stats.views, 2);
  assert.equal(stats.previousViews, 1);
  assert.equal(stats.orders, 1);
  assert.equal(stats.calls, 1);
  assert.deepEqual(
    stats.placements.map((p) => [p.label, p.views]),
    [
      ["Tables", 1],
      ["Other links", 1],
    ],
  );
  assert.deepEqual(stats.mostSeen, { name: "Avocado toast", guests: 2 });
  assert.deepEqual(
    stats.menus.map((m) => [m.id, m.views]),
    [[guest.menu.documentId, 2]],
  );

  // Dish views arrive a few at a time, each dish once per guest.
  const dishViews = async () =>
    (await one("SELECT count(*) AS n FROM events WHERE kind='dish_view'")).n;
  const viewsBefore = await dishViews(),
    scroller = crypto.randomUUID();
  const batch = {
    kind: "dish_view",
    session: scroller,
    entityIds: [toast.id, flaky.id, sized.id, toast.id],
  };
  await guestCall(`public/${slug}/events`, batch);
  assert.equal(await dishViews(), viewsBefore + 3);
  await guestCall(`public/${slug}/events`, batch);
  assert.equal(await dishViews(), viewsBefore + 3, "a resend isn't counted");
  await guestCall(
    `public/${slug}/events`,
    { ...batch, entityIds: [toast.id, crypto.randomUUID()] },
    404,
  );
  await guestCall(
    `public/${slug}/events`,
    { kind: "dish_view", session: scroller },
    404,
  );
  // A dining room scrolling on the restaurant's Wi-Fi (one address) still
  // has its visits counted: dish views have their own allowance.
  const venue = "198.51.100.7";
  for (let n = 0; n < 301; n++)
    await guestCall(
      `public/${slug}/events`,
      {
        kind: "dish_view",
        session: crypto.randomUUID(),
        entityIds: [toast.id],
      },
      200,
      venue,
    );
  await guestCall(
    `public/${slug}/events`,
    { kind: "menu_visit", session: crypto.randomUUID(), src: "table" },
    200,
    venue,
  );
  // One address has a cap across every restaurant's menus.
  await run(
    "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,?,?)",
    digest("public-event-ip:guests:203.0.113.5"),
    1200,
    Date.now() + 3600000,
  );
  await guestCall(
    `public/${slug}/events`,
    { kind: "menu_visit", session: crypto.randomUUID() },
    429,
    "203.0.113.5",
  );
  await guestCall(
    `public/${slug}/events`,
    { kind: "menu_visit", session: crypto.randomUUID() },
    200,
    "203.0.113.6",
  );
  // Housekeeping removes guest activity older than 90 days, and only that.
  const old = Date.now() - 91 * 24 * 60 * 60 * 1000;
  for (const [id, kind, at] of [
    ["old-visit", "menu_visit", old],
    ["old-view", "dish_view", old],
    ["old-export", "export_complete", old],
    ["recent-visit", "menu_visit", Date.now() - 80 * 24 * 60 * 60 * 1000],
  ])
    await run(
      "INSERT INTO events (id,restaurant_id,kind,entity_id,details,created_at) VALUES (?,?,?,NULL,'{}',?)",
      id,
      restaurantState.id,
      kind,
      at,
    );
  await housekeeping();
  assert.deepEqual(
    (
      await all(
        "SELECT id FROM events WHERE id IN ('old-visit','old-view','old-export','recent-visit') ORDER BY id",
      )
    ).map((e) => e.id),
    ["old-export", "recent-visit"],
  );

  // Quick update: sold out and prices go live without publishing other edits.
  const { visibleMenuSections } = await import("../lib/menu-document.ts");
  const bowlEntry = (extra = {}) =>
    newMenuEntry({
      dishId: tagged1.id,
      name: "Harvest bowl",
      price: 1350,
      ...extra,
    });
  const lunchBowl = bowlEntry(),
    lunchLatte = newMenuEntry({
      name: "Latte",
      priceMode: "variants",
      variants: [
        { id: "s", label: "Small", price: 475 },
        { id: "l", label: "Large", price: 550 },
      ],
    }),
    lunchSoup = newMenuEntry({
      name: "Soup",
      description: "Of the day",
      price: 800,
      available: false,
    });
  const lunch = await call("menus", {
    id: crypto.randomUUID(),
    draft: newMenuDocument({
      name: "Lunch",
      title: "Lunch",
      showUnavailable: false,
      sections: [section([lunchBowl, lunchLatte, lunchSoup], "Lunch")],
    }),
  });
  const dinnerBowl = bowlEntry();
  const dinner = await call("menus", {
    id: crypto.randomUUID(),
    draft: newMenuDocument({
      name: "Dinner",
      sections: [section([dinnerBowl], "Mains")],
    }),
  });
  await call(
    `menus/${lunch.id}/live`,
    {
      revision: lunch.revision,
      changes: [{ entryId: lunchBowl.id, available: false }],
    },
    400,
  );
  const lunchLive = await call(`menus/${lunch.id}/publish`, {
    revision: lunch.revision,
  });
  await call(`menus/${dinner.id}/publish`, {
    revision: dinner.revision,
  });
  assert.equal(
    lunchLive.published.sections[0].items.find((i) => i.id === lunchSoup.id)
      .available,
    false,
    "sold-out dishes stay in the live copy",
  );
  assert(
    !visibleMenuSections(lunchLive.published)[0].items.some(
      (i) => i.id === lunchSoup.id,
    ),
    "…and guests don't see them when the menu leaves them out",
  );
  // An unpublished draft edit that must stay private.
  const lunchDraft = await call(
    `menus/${lunch.id}`,
    {
      revision: lunchLive.revision,
      draft: {
        ...lunchLive.draft,
        sections: [
          {
            ...lunchLive.draft.sections[0],
            items: lunchLive.draft.sections[0].items.map((i) =>
              i.id === lunchSoup.id ? { ...i, description: "Draft only" } : i,
            ),
          },
        ],
      },
    },
    200,
    "PUT",
  );
  const soldOut = await call(`menus/${lunch.id}/live`, {
    revision: lunchDraft.revision,
    changes: [{ entryId: lunchBowl.id, available: false }],
  });
  const liveBowl = (menu) =>
    menu.sections
      .flatMap((x) => x.items)
      .find((i) => i.name === "Harvest bowl");
  assert.equal(liveBowl(soldOut.published).available, false, "live now");
  assert.equal(liveBowl(soldOut.draft).available, false, "and in the draft");
  assert.equal(
    soldOut.published.sections[0].items.find((i) => i.id === lunchSoup.id)
      .description,
    "Of the day",
    "other draft edits stay private",
  );
  assert.notEqual(soldOut.publishedRevision, soldOut.revision);
  assert.equal(
    (await one("SELECT available FROM dishes WHERE id=?", tagged1.id))
      .available,
    0,
    "My Dishes follows",
  );
  assert.deepEqual(
    soldOut.menus.map((m) => [m.id, m.live]).sort(),
    [
      [dinner.id, true],
      [tagMenuSaved.id, false],
    ].sort(),
    "other menus that showed the dish follow too (draft-only ones as drafts)",
  );
  const dinnerAfter = await call(`menus/${dinner.id}`);
  assert.equal(liveBowl(dinnerAfter.published).available, false);
  assert.equal(
    dinnerAfter.publishedRevision,
    dinnerAfter.revision,
    "a live copy that matched its draft still does",
  );
  // Back on, and new prices (single and sizes).
  const priced = await call(`menus/${lunch.id}/live`, {
    revision: soldOut.revision,
    changes: [
      { entryId: lunchBowl.id, available: true, price: 1450 },
      {
        entryId: lunchLatte.id,
        variants: [
          { id: "s", price: 500 },
          { id: "l", price: 575 },
        ],
      },
    ],
  });
  assert.equal(liveBowl(priced.published).price, 1450);
  assert.equal(liveBowl(priced.published).available, true);
  assert.deepEqual(
    priced.published.sections[0].items
      .find((i) => i.id === lunchLatte.id)
      .variants.map((v) => v.price),
    [500, 575],
  );
  const bowlDish = await one(
    "SELECT price,available FROM dishes WHERE id=?",
    tagged1.id,
  );
  assert.deepEqual([bowlDish.price, bowlDish.available], [1450, 1]);
  assert.equal(
    liveBowl((await call(`menus/${dinner.id}`)).published).price,
    1450,
  );
  const guestLunch = await call(`public/${slug}?menu=${lunch.id}`);
  assert.equal(liveBowl(guestLunch.menu).price, 1450, "guests see it");
  // Mistakes are refused, and nothing changes.
  await call(
    `menus/${lunch.id}/live`,
    {
      revision: priced.revision,
      changes: [{ entryId: lunchBowl.id, price: 0 }],
    },
    400,
  );
  await call(
    `menus/${lunch.id}/live`,
    {
      revision: priced.revision - 1,
      changes: [{ entryId: lunchBowl.id, available: false }],
    },
    409,
  );
  await call(
    `menus/${lunch.id}/live`,
    {
      revision: priced.revision,
      changes: [{ entryId: "not-on-this-menu", available: false }],
    },
    404,
  );

  // Search engines get the restaurant, its hours and priced menu items.
  const data = menuStructuredData(guest.menu, `https://example.test/m/${slug}`);
  assert.equal(data["@type"], "Restaurant");
  assert.equal(data.telephone, "(555) 123-4567");
  assert.equal(data.address, "12 Market Street, Springfield");
  assert.equal(
    data.openingHoursSpecification.length,
    6,
    "closed days left out",
  );
  const menuItems = data.hasMenu.hasMenuSection.flatMap((s) => s.hasMenuItem);
  assert.deepEqual(menuItems.find((i) => i.name === "Avocado toast").offers, {
    "@type": "Offer",
    price: "12.50",
    priceCurrency: "USD",
  });
  assert.equal(
    menuItems.find((i) => i.name === "Latte").offers.length,
    2,
    "one offer per size",
  );
  assert.equal(jsonLd({ a: "</script>" }), '{"a":"\\u003c/script>"}');
  assert.equal(
    menuPreviewImage(guest.menu, slug, "https://example.test"),
    null,
    "no photo and no logo: no preview image",
  );
  assert.equal(
    menuPreviewImage(
      {
        restaurant: { name: "J" },
        sections: [
          {
            items: [
              { name: "A", photoId: "p1" },
              { name: "B", photoId: "p2", featured: true },
            ],
          },
        ],
      },
      slug,
      "https://example.test",
    ).url,
    `https://example.test/api/public/${slug}/assets/p2`,
    "a featured dish leads link previews",
  );

  console.log(
    `PASS: ${checks} API checks and pasted-menu parsing, menu types, import checks, My Dishes linking, dietary tags, open-now status, live contact details, placement events, visit stats, quick updates and structured data.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
