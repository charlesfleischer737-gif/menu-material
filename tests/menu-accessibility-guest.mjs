// Browser checks of a published guest menu on a phone: it hydrates without
// mismatches, reports each dish view once, labels allergens, lets vegan
// dishes meet the Vegetarian filter, switches menus only on "Open", skips
// the owner's own visits and passes axe.
//
// Run only against an isolated local dev server with its own data directory:
//   MENU_MATERIAL_DATA_DIR=<empty dir> node node_modules/vinext/dist/cli.js dev --port 5183
//   MENU_MATERIAL_QA_ORIGIN=http://localhost:5183 node tests/menu-accessibility-guest.mjs
// (set PLAYWRIGHT_MODULE to Playwright's index.mjs if it isn't installed here).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.MENU_MATERIAL_QA_ORIGIN || "http://localhost:5183";
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Guest menu browser checks require an isolated local server.",
);
const browser = await chromium.launch();
const owner = await browser.newContext();
async function api(path, data, method) {
  const res = await owner.request.fetch(`${base}/api/${path}`, {
    method: method || (data === undefined ? "GET" : "POST"),
    ...(data instanceof FormData ? { multipart: data } : { data }),
    headers: { origin: base },
  });
  const body = await res.json();
  assert(res.ok(), `${path}: ${JSON.stringify(body)}`);
  return body;
}
await api("auth/dev", {});
let state = await api("state");
assert(
  state.local &&
    (state.restaurant.name.startsWith("QA ·") ||
      (state.restaurant.name === "Your restaurant" && !state.dishes.length)),
  "Use a separate MENU_MATERIAL_DATA_DIR for browser checks.",
);
let checks = 0;
try {
  // A restaurant with hours, tagged dishes, a featured photo and two menus.
  await api("restaurant", {
    name: "QA · Guest Kitchen",
    cuisine: "Bistro",
    brand: "",
    currency: "USD",
    timezone: "America/New_York",
    orderingUrl: "https://order.example.test/qa",
    phone: "(555) 123-4567",
    address: "12 Market Street, Springfield",
    hours: Array.from({ length: 7 }, (_, day) => ({
      day,
      open: "09:00",
      close: "21:00",
      closed: day === 0,
    })),
  });
  const dishes = [];
  for (const [name, category, dietary] of [
    ["Pork gyoza", "Starters", ["contains-gluten", "contains-soy"]],
    ["Burrata", "Starters", ["vegetarian", "gluten-free", "contains-milk"]],
    ["Harvest bowl", "Mains", ["vegan", "gluten-free", "contains-sesame"]],
    ["Risotto", "Mains", ["vegetarian", "contains-milk"]],
    ["Steak frites", "Mains", []],
    ["Roast chicken", "Mains", ["gluten-free"]],
    ["Chocolate tart", "Desserts", ["vegetarian", "contains-egg"]],
    ["Sorbet", "Desserts", ["vegan"]],
    ["Espresso", "Drinks", ["vegan"]],
    ["Lemonade", "Drinks", []],
    ["Fries", "Sides", ["vegan"]],
    ["Green salad", "Sides", ["vegan", "gluten-free"]],
    ["Bread", "Sides", ["vegan", "contains-gluten"]],
  ])
    dishes.push({
      ...(await api("dishes", {
        name,
        category,
        price: 9.5,
        confirmed: true,
        dietary,
      })),
      name,
      category,
      dietary,
    });
  const jpeg = readFileSync("public/pasta.jpg");
  const upload = new FormData();
  upload.set("file", new File([jpeg], "pasta.jpg", { type: "image/jpeg" }));
  upload.set(
    "normalized",
    new File([jpeg], "pasta.jpg", { type: "image/jpeg" }),
  );
  upload.set("dishId", dishes[1].id);
  const photo = await api("assets", upload);
  await api(`assets/${photo.id}/approve`, { accurate: true });
  const sectionsOf = (list) =>
    [...new Set(list.map((d) => d.category))].map((name) => ({
      id: crypto.randomUUID(),
      name,
      items: list
        .filter((d) => d.category === name)
        .map((d) => ({
          id: crypto.randomUUID(),
          dishId: d.id,
          name: d.name,
          price: 950,
          dietary: d.dietary,
          ...(d === dishes[1] ? { photoId: photo.id, featured: true } : {}),
        })),
    }));
  const publish = async (draft) => {
    const menu = await api("menus", { id: crypto.randomUUID(), draft });
    await api(`menus/${menu.id}/publish`, { revision: menu.revision });
    return menu.id;
  };
  await publish({
    name: "Dinner",
    title: "Dinner",
    layout: "featured",
    sections: sectionsOf(dishes),
  });
  const drinksMenu = await publish({
    name: "Drinks",
    title: "Drinks",
    sections: sectionsOf(dishes.filter((d) => d.category === "Drinks")),
  });
  state = await api("state");
  const slug = state.restaurant.slug;

  // A guest arrives from a table QR code.
  const guest = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await guest.newPage();
  const errors = [],
    posts = [],
    statuses = [];
  page.on("console", (m) => {
    // Fonts can be refused by a local worktree server; nothing else may fail.
    if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
      errors.push(m.text().slice(0, 500));
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("/events")) posts.push(JSON.parse(r.postData()));
  });
  page.on("response", (r) => {
    if (r.url().includes("/events")) statuses.push(r.status());
  });
  await page.goto(`${base}/m/${slug}?src=table`, {
    waitUntil: "load",
    timeout: 240000,
  });
  await page.waitForTimeout(2500);
  assert.deepEqual(errors, [], "hydrates without mismatches");
  assert.equal(new URL(page.url()).search, "", "the placement tag leaves");
  checks += 2;

  // Allergens are labeled; vegan dishes meet the Vegetarian filter.
  const burrata = await page
    .locator(".md-guest-item", { hasText: "Burrata" })
    .innerText();
  assert.match(burrata, /Vegetarian · Gluten-free\s+Contains: milk/);
  assert.match(
    await page.locator(".md-guest-allergy").innerText(),
    /allergies/,
  );
  await page.selectOption(".md-guest-diet", "vegetarian");
  const vegetarian = await page.$$eval(".md-guest-item h3", (h) =>
    h.map((x) => x.textContent),
  );
  assert(vegetarian.includes("Harvest bowl") && vegetarian.includes("Risotto"));
  assert(!vegetarian.includes("Steak frites"));
  await page.selectOption(".md-guest-diet", "");
  checks += 4;

  // Each dish view is reported once, whatever the scrolling and refreshes.
  for (let n = 0; n < 12; n++) {
    await page.mouse.wheel(0, 450);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2500);
  for (let n = 0; n < 2; n++) {
    // A live refresh, as every 20 seconds or when the tab returns.
    await page.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2500);
  }
  const viewed = posts.flatMap((p) => p.entityIds || []);
  assert(viewed.length >= dishes.length, "every dish was seen");
  assert.equal(new Set(viewed).size, viewed.length, "each view sent once");
  assert.equal(posts.filter((p) => p.kind === "menu_visit").length, 1);
  assert(
    posts.every((p) => p.src === "table"),
    "the placement is kept",
  );
  assert(
    statuses.every((s) => s === 200),
    JSON.stringify(statuses),
  );
  checks += 5;

  // axe finds nothing on the phone menu.
  await page.addScriptTag({
    content: readFileSync("node_modules/axe-core/axe.min.js", "utf8"),
  });
  const violations = await page.evaluate(async () =>
    (await window.axe.run(document)).violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
  );
  assert.deepEqual(violations, [], "axe");
  checks++;

  // Choosing another menu changes nothing until "Open".
  const before = page.url();
  await page.selectOption(".customer-menu-switcher select", drinksMenu);
  await page.waitForTimeout(800);
  assert.equal(page.url(), before);
  await page.click(".customer-menu-switcher button");
  await page.waitForURL(`**/m/${slug}?menu=${drinksMenu}`);
  assert.equal(await page.locator(".md-guest-title").textContent(), "Drinks");
  checks += 2;
  await guest.close();

  // The owner checking the live menu isn't counted as a guest.
  // Visits are sent with keepalive, whose response bodies the browser doesn't
  // hand to Playwright, so the first one is fetched through a route.
  const ownerPage = await owner.newPage();
  const ownerVisit = new Promise((resolve) =>
    ownerPage.route("**/events*", async (route) => {
      const response = await route.fetch();
      resolve(await response.json());
      await route.fulfill({ response });
    }),
  );
  await ownerPage.goto(`${base}/m/${slug}`, { waitUntil: "load" });
  assert.equal((await ownerVisit).counted, false, "owner");
  checks++;
  console.log(
    `PASS: ${checks} guest menu browser checks (hydration, dish views, allergens, diet filter, axe, menu switcher, owner visits).`,
  );
} finally {
  await browser.close();
}
