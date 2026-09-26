import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-material-plan-limits-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.OPENAI_API_KEY = "fixture-only";
process.env.APP_ORIGIN = "http://localhost";
const { handle } = await import("../lib/server/api.ts");
const { one, run } = await import("../lib/server/core.ts");
const { env } = await import("../lib/local-runtime.ts");
const { featureAccess } = await import("../lib/server/entitlements.ts");
const { newMenuDocument, newMenuEntry } =
  await import("../lib/menu-document.ts");
const { defaultStyle } = await import("../lib/promotions.ts");
const { FREE_SIGNUP_IMAGES, freeMenuDesign } = await import("../lib/plans.ts");
const { freePostDraft, getPostTemplate } =
  await import("../lib/post-templates.ts");
const { recipeFromDraft, emptyStudioLibrary } =
  await import("../lib/studio-library.ts");
const { photoBrief } = await import("../lib/studio.ts");
globalThis.fetch = async (url) => {
  throw Error(`No network calls in plan limit checks: ${url}`);
};

let cookie = "",
  checks = 0;
async function send(path, data, { method, ip } = {}) {
  return handle(
    new Request("http://localhost/api/" + path, {
      method: method || (data === undefined ? "GET" : "POST"),
      headers: {
        cookie,
        ...(data === undefined || data instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(ip ? { "cf-connecting-ip": ip } : {}),
      },
      body:
        data === undefined
          ? undefined
          : data instanceof FormData
            ? data
            : JSON.stringify(data),
    }),
  );
}
async function call(path, data, expected = 200, options = {}) {
  const res = await send(path, data, options);
  const value = await res.json().catch(() => null);
  assert.equal(res.status, expected, `${path}: ${JSON.stringify(value)}`);
  checks++;
  if (res.headers.get("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return value;
}
// A refused Pro feature names itself, so the page can offer Pro.
async function proOnly(path, data, feature, options) {
  const value = await call(path, data, 402, options);
  assert.equal(value.code, "pro_required");
  assert.equal(value.feature, feature);
  return value;
}
const password = "a sufficiently long password";
const section = (items) => ({
  id: crypto.randomUUID(),
  name: "Mains",
  description: "",
  pageBreakBefore: false,
  items,
});
const photo = () => {
  const bytes = readFileSync("public/pasta.jpg");
  return new File([bytes], "dish.jpg", { type: "image/jpeg" });
};
async function upload(dishId, kind = "source") {
  const form = new FormData();
  form.set("file", photo());
  form.set("normalized", photo(), "working.jpg");
  if (dishId) form.set("dishId", dishId);
  form.set("kind", kind);
  return (await call("assets", form, 201)).id;
}

try {
  // The comp column arrives empty on an existing database.
  const migrationDb = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync("drizzle")
      .filter((name) => name.endsWith(".sql") && name < "0019")
      .sort())
      migrationDb.exec(readFileSync(join("drizzle", file), "utf8"));
    migrationDb.exec(`
      INSERT INTO users (id,email,password,created_at) VALUES ('owner','owner@example.test','fixture',1);
      INSERT INTO restaurants (id,user_id,name,slug,created_at) VALUES ('restaurant','owner','Test','test',1);
    `);
    migrationDb.exec(
      readFileSync("drizzle/0019_pro_feature_comp.sql", "utf8"),
    );
    assert.equal(
      migrationDb.prepare("SELECT pro_until FROM restaurants").get().pro_until,
      null,
    );
    checks++;
  } finally {
    migrationDb.close();
  }

  // Shared rules the page and the server both use.
  assert(freeMenuDesign({}));
  assert(freeMenuDesign({ design: "bistro", colorMode: "restaurant" }));
  assert(!freeMenuDesign({ design: "fine" }));
  assert(freeMenuDesign({ layout: "featured" }), "featured dish photos");
  assert(!freeMenuDesign({ layout: "grid" }));
  assert(!freeMenuDesign({ appearance: "dark" }));
  assert(!freeMenuDesign({ colorMode: "custom" }));
  const chef = getPostTemplate("chef");
  assert(freePostDraft({ template: "chef" }));
  assert(freePostDraft({ template: "story" }), "an alias of a free design");
  assert(
    freePostDraft({
      template: "chef",
      color: chef.color.toUpperCase(),
      accent: chef.accent,
      channels: ["feed", "story"],
      items: [{}],
    }),
  );
  assert(!freePostDraft({ template: "brunch" }));
  assert(!freePostDraft({ template: "chef", items: [{}, {}] }));
  assert(!freePostDraft({ template: "chef", channels: ["carousel"] }));
  assert(!freePostDraft({ template: "chef", brandMode: "restaurant" }));
  assert(!freePostDraft({ template: "chef", color: "#ff0000" }));
  assert(!freePostDraft({ template: "chef", typography: "bold" }));
  checks += 15;

  await call("auth/dev", {});
  const adminCookie = cookie;
  async function comp(rid, until) {
    const own = cookie;
    cookie = adminCookie;
    const { allowance } = await one(
      "SELECT allowance FROM restaurants WHERE id=?",
      rid,
    );
    await call("admin/restaurant", {
      id: rid,
      allowance,
      paused: false,
      proUntil: until,
    });
    cookie = own;
  }

  // 1. Each network opens five free accounts a day; invitations don't count.
  for (let i = 0; i < 5; i++) {
    cookie = "";
    await call(
      "auth/signup",
      { email: `cap${i}@plan-limits.test`, password, restaurant: "Cap" },
      200,
      { ip: "198.51.100.7" },
    );
  }
  cookie = "";
  const capped = await call(
    "auth/signup",
    { email: "cap5@plan-limits.test", password, restaurant: "Cap" },
    429,
    { ip: "198.51.100.7" },
  );
  assert.match(capped.error, /tomorrow/);
  assert.equal(
    await one("SELECT id FROM users WHERE email=?", "cap5@plan-limits.test"),
    null,
  );
  cookie = adminCookie;
  const invite = await call("admin/invite", {
    email: "invited@plan-limits.test",
    allowance: 5,
  });
  cookie = "";
  await call(
    "auth/signup",
    {
      email: "invited@plan-limits.test",
      password,
      invite: invite.invite,
      restaurant: "Invited",
    },
    200,
    { ip: "198.51.100.7" },
  );
  cookie = "";
  await call(
    "auth/signup",
    { email: "elsewhere@plan-limits.test", password, restaurant: "Else" },
    200,
    { ip: "203.0.113.9" },
  );
  checks += 2;

  // 2. A new free account: images to start, no Pro features.
  cookie = "";
  await call(
    "auth/signup",
    { email: "owner@plan-limits.test", password, restaurant: "Corner House" },
    200,
    { ip: "192.0.2.50" },
  );
  const ownerCookie = cookie;
  let state = await call("state");
  const rid = state.restaurant.id;
  assert.equal(state.remaining, FREE_SIGNUP_IMAGES);
  assert.equal(state.billing.features.unlocked, false);
  assert.equal(state.billing.features.source, "free");
  assert.equal(state.billing.features.usage.liveMenus, 0);
  checks += 4;

  // 3. The restaurant look is saved and previewed on Free, applied with Pro.
  const look = {
    ...defaultStyle,
    primary: "#123456",
    accent: "#abcdef",
    tone: "Short and friendly",
    typography: "editorial",
  };
  await call("restaurant", {
    name: "Corner House",
    cuisine: "",
    brand: "",
    currency: "USD",
    style: look,
  });
  state = await call("state");
  assert.equal(state.restaurant.savedStyle.primary, look.primary);
  assert.equal(state.restaurant.savedStyle.tone, look.tone);
  assert.equal(state.restaurant.style.primary, defaultStyle.primary);
  assert.equal(state.restaurant.style.tone, defaultStyle.tone);
  checks += 4;

  // 4. Free publishes one menu, in the basic design.
  const dish = await call("dishes", {
    name: "Smash Burger",
    description: "Two patties",
    price: 16,
    confirmed: true,
  });
  const entry = () =>
    newMenuEntry({
      dishId: dish.id,
      name: "Smash Burger",
      description: "Two patties",
      price: 1600,
    });
  const makeMenu = (title) =>
    call("menus", {
      id: crypto.randomUUID(),
      draft: newMenuDocument({ title, sections: [section([entry()])] }),
    });
  const edit = (menu, patch) =>
    call(
      `menus/${menu.id}`,
      { revision: menu.revision, draft: { ...menu.draft, ...patch } },
      200,
      { method: "PUT" },
    );
  const publish = (menu, expected = 200) =>
    call(`menus/${menu.id}/publish`, { revision: menu.revision }, expected);
  let lunch = await makeMenu("Lunch"),
    dinner = await makeMenu("Dinner");
  // A Pro design can be tried in a draft; publishing it is Pro.
  lunch = await edit(lunch, { design: "fine", appearance: "dark" });
  await proOnly(
    `menus/${lunch.id}/publish`,
    { revision: lunch.revision },
    "menuDesigns",
  );
  assert.equal(
    (await one("SELECT published FROM menu_documents WHERE id=?", lunch.id))
      .published,
    null,
  );
  lunch = await edit(lunch, { design: "bistro", appearance: "light" });
  lunch = await publish(lunch);
  await proOnly(
    `menus/${dinner.id}/publish`,
    { revision: dinner.revision },
    "menus",
  );
  // The live menu can always be published again, to fix a price.
  lunch = await publish(lunch);
  state = await call("state");
  assert.equal(state.billing.features.usage.liveMenus, 1);
  const slug = state.restaurant.slug;
  const guestMenu = async (query = "") => {
    const own = cookie;
    cookie = "";
    const menu = (await call(`public/${slug}${query}`)).menu;
    cookie = own;
    return menu;
  };
  let guest = await guestMenu();
  assert.equal(guest.credit, true, "Free menus say Made with Menu Material");
  assert.equal(guest.restaurant.style.primary, defaultStyle.primary);
  checks += 3;

  // 5. Two tabs publishing different menus at once: one goes live.
  cookie = "";
  await call(
    "auth/signup",
    { email: "tabs@plan-limits.test", password, restaurant: "Two Tabs" },
    200,
    { ip: "192.0.2.51" },
  );
  const tabsDish = await call("dishes", {
    name: "Soup",
    description: "Tomato",
    price: 6,
    confirmed: true,
  });
  const tabMenu = () =>
    call("menus", {
      id: crypto.randomUUID(),
      draft: newMenuDocument({
        sections: [
          section([
            newMenuEntry({ dishId: tabsDish.id, name: "Soup", price: 600 }),
          ]),
        ],
      }),
    });
  const [first, second] = [await tabMenu(), await tabMenu()];
  const raced = await Promise.all(
    [first, second].map((menu) =>
      send(`menus/${menu.id}/publish`, { revision: menu.revision }),
    ),
  );
  assert.deepEqual(raced.map((res) => res.status).sort(), [200, 402]);
  const tabsRid = (
    await one("SELECT id FROM users WHERE email=?", "tabs@plan-limits.test")
  ).id;
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM menu_documents m JOIN restaurants r ON r.id=m.restaurant_id WHERE r.user_id=? AND m.published IS NOT NULL",
        tabsRid,
      )
    ).n,
    1,
  );
  checks += 2;
  cookie = ownerCookie;

  // 6. Posts: three designs, one photo, a post or Story, the design's colors.
  const post = (draft) => ({
    id: crypto.randomUUID(),
    kind: "post",
    revision: 0,
    draft,
  });
  await call(
    "creation-drafts",
    post({
      template: "chef",
      items: [{ dishId: dish.id }],
      channels: ["feed", "story"],
      color: chef.color,
      accent: chef.accent,
      typography: "template",
    }),
  );
  await proOnly(
    "creation-drafts",
    post({ template: "brunch" }),
    "postTemplates",
  );
  await proOnly(
    "creation-drafts",
    post({ template: "chef", channels: ["feed", "carousel"] }),
    "postTemplates",
  );
  await proOnly(
    "creation-drafts",
    post({ template: "chef", brandMode: "restaurant" }),
    "postTemplates",
  );
  await proOnly(
    "creation-drafts",
    post({ template: "chef", items: [{}, {}] }),
    "postTemplates",
  );
  // A post made with Pro options still opens; copying it is new work.
  const proPost = crypto.randomUUID();
  await run(
    "INSERT INTO creation_drafts (id,restaurant_id,kind,draft,revision,updated_at) VALUES (?,?,'post',?,1,?)",
    proPost,
    rid,
    JSON.stringify({ template: "brunch" }),
    Date.now(),
  );
  await call(`creation-drafts/${proPost}`);
  await proOnly(`creation-drafts/${proPost}/duplicate`, {}, "postTemplates");
  // Photo and menu drafts are never limited.
  await call("creation-drafts", {
    id: crypto.randomUUID(),
    kind: "studio",
    revision: 0,
    draft: { look: "menu-stone" },
  });

  // 7. Campaigns, batches, staff links, saved looks and inspiration are Pro.
  await proOnly("promotions", { type: "special" }, "campaigns");
  const source = await upload(dish.id);
  await proOnly(
    "photo-batches",
    {
      batchId: crypto.randomUUID(),
      items: [{ dishId: dish.id, sourceId: source }],
      style: defaultStyle,
    },
    "batches",
  );
  await proOnly(
    "batches",
    {
      batchId: crypto.randomUUID(),
      items: [{ dishId: dish.id, sourceId: null }],
    },
    "batches",
  );
  await proOnly("staff-links", {}, "staffLinks");
  await call("staff-links/revoke", {});
  const namedLook = {
    id: crypto.randomUUID(),
    name: "Evening menu",
    recipe: recipeFromDraft(
      { ...photoBrief(), look: "menu-wood" },
      state.restaurant,
    ),
    previewAssetId: null,
    archived: false,
  };
  await proOnly(
    "studio-library",
    { revision: 0, library: { ...emptyStudioLibrary(), looks: [namedLook] } },
    "savedLooks",
    { method: "PUT" },
  );
  // Favorite built-in styles stay free.
  await call(
    "studio-library",
    {
      revision: 0,
      library: { ...emptyStudioLibrary(), favorites: ["menu-wood"] },
    },
    200,
    { method: "PUT" },
  );
  const reference = await upload(null, "reference");
  const outputsBefore = (
    await one("SELECT count(*) AS n FROM outputs WHERE restaurant_id=?", rid)
  ).n;
  await proOnly(
    "jobs",
    {
      dishId: dish.id,
      sourceId: source,
      requestKey: crypto.randomUUID(),
      style: { ...defaultStyle, referenceIds: [reference] },
    },
    "savedLooks",
  );
  assert.equal(
    (await one("SELECT count(*) AS n FROM outputs WHERE restaurant_id=?", rid))
      .n,
    outputsBefore,
    "a refused Pro photo reserves no image",
  );
  checks++;

  // 8. Insights: Free sees visits, and counts of what Pro shows.
  let stats = await call("menus/stats");
  assert.equal(typeof stats.views, "number");
  assert.equal(stats.orders, undefined);
  assert.equal(stats.placements, undefined);
  assert.deepEqual(Object.keys(stats.locked).sort(), ["actions", "dishes"]);
  checks += 4;

  // Upgrade prompts are recorded by feature.
  await call("events", { kind: "upgrade_prompt_shown", feature: "campaigns" });
  await call("events", { kind: "upgrade_clicked", feature: "campaigns" });
  await call("events", { kind: "upgrade_clicked", feature: "unknown" }, 400);
  assert.equal(
    JSON.parse(
      (
        await one(
          "SELECT details FROM events WHERE restaurant_id=? AND kind='upgrade_clicked'",
          rid,
        )
      ).details,
    ).feature,
    "campaigns",
  );
  checks++;

  // 9. With Pro features (an administrator's comp, which adds no images).
  cookie = ownerCookie;
  await call(
    "admin/restaurant",
    { id: rid, allowance: 100, paused: false, proUntil: Date.now() + 1e9 },
    403,
  );
  await comp(rid, Date.now() + 86400000);
  state = await call("state");
  assert.equal(state.billing.features.source, "comp");
  assert.equal(state.billing.features.unlocked, true);
  assert.equal(state.billing.plan, "free");
  assert.equal(state.remaining, FREE_SIGNUP_IMAGES, "a comp adds no images");
  assert.equal(state.restaurant.style.primary, look.primary);
  dinner = await publish(dinner);
  lunch = await publish(lunch);
  guest = await guestMenu();
  assert.equal(guest.credit, false);
  assert.equal(guest.restaurant.style.primary, look.primary);
  stats = await call("menus/stats");
  assert.equal(typeof stats.orders, "number");
  assert.equal(stats.locked, undefined);
  await call("staff-links", {});
  await call(
    "studio-library",
    {
      revision: 1,
      library: {
        ...emptyStudioLibrary(),
        favorites: ["menu-wood"],
        looks: [namedLook],
      },
    },
    200,
    { method: "PUT" },
  );
  checks += 9;

  // 10. When Pro features end, nothing is deleted or taken offline.
  await comp(rid, null);
  state = await call("state");
  assert.equal(state.billing.features.unlocked, false);
  assert.equal(state.billing.features.usage.liveMenus, 2);
  guest = await guestMenu();
  assert.equal(guest.credit, true, "the credit returns");
  assert.equal(
    guest.restaurant.style.primary,
    look.primary,
    "a live menu keeps its look until it's published again",
  );
  assert.equal((await guestMenu(`?menu=${dinner.id}`)).title, "Dinner");
  // Published again on Free: allowed, in the neutral look.
  lunch = await publish(lunch);
  guest = await guestMenu();
  assert.equal(guest.restaurant.style.primary, defaultStyle.primary);
  // Saved looks stay and can be renamed; adding another is Pro.
  const library = await call("studio-library");
  assert.equal(library.looks.length, 1);
  await call(
    "studio-library",
    {
      revision: library.revision,
      library: {
        ...emptyStudioLibrary(),
        favorites: library.favorites,
        looks: [{ ...namedLook, name: "Late menu" }],
      },
    },
    200,
    { method: "PUT" },
  );
  await proOnly(
    "studio-library",
    {
      revision: library.revision + 1,
      library: {
        ...emptyStudioLibrary(),
        looks: [
          { ...namedLook, name: "Late menu" },
          { ...namedLook, id: crypto.randomUUID(), name: "Copy" },
        ],
      },
    },
    "savedLooks",
    { method: "PUT" },
  );
  await proOnly(
    "jobs",
    {
      dishId: dish.id,
      sourceId: source,
      requestKey: crypto.randomUUID(),
      style: defaultStyle,
      lookContext: { presetId: "menu-wood", savedLookId: namedLook.id },
    },
    "savedLooks",
  );
  checks += 6;

  // 11. A failed renewal keeps Pro features (not images) for 14 days.
  const day = 86400000;
  await run(
    "INSERT INTO billing_accounts (restaurant_id,customer_id,subscription_id,status) VALUES (?,?,?,?)",
    rid,
    "cus_limits",
    "sub_limits",
    "past_due",
  );
  await run(
    "INSERT INTO billing_periods (id,restaurant_id,subscription_id,invoice_id,starts_at,ends_at,allowance) VALUES (?,?,?,?,?,?,50)",
    "sub_limits:1",
    rid,
    "sub_limits",
    "in_limits",
    Date.now() - 33 * day,
    Date.now() - 3 * day,
  );
  let access = await featureAccess(rid);
  assert.equal(access.source, "grace");
  assert.equal(access.unlocked, true);
  state = await call("state");
  assert.equal(state.billing.plan, "free", "no images from an unpaid month");
  await run(
    "UPDATE billing_periods SET ends_at=? WHERE id=?",
    Date.now() - 15 * day,
    "sub_limits:1",
  );
  assert.equal((await featureAccess(rid)).source, "free");
  // A paid period covering today.
  await run(
    "UPDATE billing_accounts SET status='active' WHERE restaurant_id=?",
    rid,
  );
  await run(
    "UPDATE billing_periods SET starts_at=?,ends_at=? WHERE id=?",
    Date.now() - day,
    Date.now() + 29 * day,
    "sub_limits:1",
  );
  access = await featureAccess(rid);
  assert.equal(access.source, "paid");
  assert.equal((await call("state")).billing.plan, "pro");
  await run(
    "UPDATE billing_accounts SET status='canceled' WHERE restaurant_id=?",
    rid,
  );
  assert.equal((await featureAccess(rid)).source, "free");
  checks += 7;

  // 12. One switch lifts every limit.
  env.PLAN_LIMITS_ENABLED = "false";
  try {
    state = await call("state");
    assert.equal(state.billing.features.unlocked, true);
    assert.equal(state.billing.features.pro, false);
    assert.equal(state.restaurant.style.primary, look.primary);
    await call("staff-links", {});
    guest = await guestMenu();
    assert.equal(guest.credit, false);
    checks += 4;
  } finally {
    delete env.PLAN_LIMITS_ENABLED;
  }
  assert.equal((await featureAccess(rid)).unlocked, false);
  checks++;

  console.log(
    `PASS: ${checks} plan limit checks: signup cap per network, Free defaults for the restaurant look, one basic live menu (also across two tabs), three free post designs, Pro-only campaigns, batches, staff links, saved looks and inspiration photos, trimmed insights, the menu credit, admin comps, keeping work after a downgrade, the renewal grace and the switch.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
