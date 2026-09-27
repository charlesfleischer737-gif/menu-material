import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-material-funnel-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.ADMIN_SETUP_KEY = "fixture-setup-key-0123456789";
const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;
const day = 86400000;
const { handle } = await import("../lib/server/api.ts");
const { all, digest, event, one } = await import("../lib/server/core.ts");
const { housekeeping } = await import("../lib/server/safeguards.ts");
const { recordWaitlistJoin } = await import("../lib/server/funnel.ts");
const {
  cleanHost,
  cleanTag,
  pageAttribution,
  signupSource,
  captureAttribution,
  savedAttribution,
  forgetAttribution,
} = await import("../lib/attribution.ts");

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks++;
}
function same(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  checks++;
}
async function call(
  path,
  { body, method, ip = "203.0.113.1", cookie = "", headers = {} } = {},
) {
  const h = { "cf-connecting-ip": ip, ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined) h["Content-Type"] = "application/json";
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  let json = null;
  try {
    json = await res.clone().json();
  } catch {}
  return {
    status: res.status,
    json,
    cookie: (res.headers.get("set-cookie") || "").split(";")[0],
  };
}
async function expect(path, status, options) {
  const result = await call(path, options);
  assert.equal(
    result.status,
    status,
    `${path}: ${result.status} ${JSON.stringify(result.json)}`,
  );
  checks++;
  return result;
}
const password = "correct horse battery staple";
async function signup(email, restaurant, ip, extra = {}) {
  const result = await expect("auth/signup", 200, {
    body: { email, password, restaurant, ...extra },
    ip,
  });
  const { id } = await one(
    "SELECT r.id FROM restaurants r JOIN users u ON u.id=r.user_id WHERE u.email=?",
    email,
  );
  return { ...result, rid: id };
}
// An event's own details, without the fields event() adds to every one.
const detailsOf = (row) => {
  const details = JSON.parse(row.details);
  delete details.measurementMode;
  delete details.eventSchema;
  return details;
};
const eventsOf = (rid, kind) =>
  all(
    "SELECT * FROM events WHERE restaurant_id=? AND kind=? ORDER BY created_at",
    rid,
    kind,
  );
const steps = () =>
  all(
    "SELECT id,restaurant_id,entity_id,details FROM events WHERE kind='funnel_step'",
  );

try {
  // 1. Where visitors come from: a referring site's name and short, plain
  // campaign tags, never a full address, a network address or an email.
  same(cleanTag("  Instagram \n"), "instagram");
  same(cleanTag("Spring\u0000 Menu"), "spring menu");
  same(cleanTag("x".repeat(100)), "x".repeat(60));
  for (const value of ["someone@example.com", "", "   ", 42, null])
    same(cleanTag(value), undefined, `${value} isn't a tag`);
  same(
    cleanHost("https://www.Google.com/search?q=private+words"),
    "google.com",
  );
  same(
    cleanHost("https://user:secret@l.instagram.com/path"),
    "l.instagram.com",
  );
  same(cleanHost("news.example.co.uk"), "news.example.co.uk");
  for (const value of [
    "http://192.168.1.5:8080/menu",
    "http://[2001:db8::1]/",
    "localhost",
    "not a site",
    "",
    undefined,
  ])
    same(cleanHost(value), undefined, `${value} isn't a site name`);
  same(
    pageAttribution(
      "https://menumaterial.example/?utm_source=Instagram&utm_medium=Social&utm_campaign=Launch+Week&ref=menu&email=a%40b.c",
      "https://www.google.com/",
    ),
    {
      utmSource: "instagram",
      utmMedium: "social",
      utmCampaign: "launch week",
      ref: "menu",
      referrer: "google.com",
    },
  );
  same(
    pageAttribution(
      "https://menumaterial.example/pricing",
      "https://www.menumaterial.example/",
    ),
    null,
    "the site's own pages aren't a source",
  );
  same(
    pageAttribution(
      "https://menumaterial.example/?utm_source=owner%40example.com",
      "",
    ),
    null,
  );
  same(signupSource({ utmSource: "instagram", ref: "menu" }), {
    via: "campaign",
    name: "instagram",
    medium: "",
    campaign: "",
  });
  same(signupSource({ ref: "menu", referrer: "google.com" }).via, "ref");
  same(signupSource({ referrer: "google.com" }).name, "google.com");
  same(signupSource({}).via, "direct");

  // 2. In the browser: the first page with a source is kept until signup,
  // for up to 30 days; guest menus and staff links are never a source.
  const stored = new Map();
  let storageBlocked = false;
  const storage = {
    getItem(key) {
      if (storageBlocked) throw new Error("blocked");
      return stored.has(key) ? stored.get(key) : null;
    },
    setItem(key, value) {
      if (storageBlocked) throw new Error("blocked");
      stored.set(key, String(value));
    },
    removeItem(key) {
      if (storageBlocked) throw new Error("blocked");
      stored.delete(key);
    },
  };
  const page = (href, referrer = "") => {
    globalThis.location = new URL(href);
    globalThis.document = { referrer };
  };
  globalThis.localStorage = storage;
  globalThis.window = new EventTarget();
  page(
    "http://localhost/pricing?utm_source=Newsletter&utm_campaign=Fall%20Menu",
    "https://mail.example.com/inbox/123",
  );
  captureAttribution();
  page("http://localhost/?ref=other", "https://www.google.com/");
  captureAttribution();
  same(savedAttribution(), {
    referrer: "mail.example.com",
    utmSource: "newsletter",
    utmCampaign: "fall menu",
  });
  offset += 31 * day;
  same(savedAttribution(), undefined, "a month-old visit doesn't count");
  captureAttribution();
  same(savedAttribution(), { referrer: "google.com", ref: "other" });
  forgetAttribution();
  page("http://localhost/m/corner-kitchen?utm_source=qr", "https://x.example/");
  captureAttribution();
  page("http://localhost/s/staff-token?utm_source=qr", "https://x.example/");
  captureAttribution();
  same(savedAttribution(), undefined);
  stored.set(
    "menu-material:first-visit",
    JSON.stringify({ ref: "menu", email: "a@b.c", at: Date.now() }),
  );
  same(savedAttribution(), { ref: "menu" }, "only known tags are sent");
  storageBlocked = true;
  captureAttribution();
  same(savedAttribution(), undefined);
  storageBlocked = false;
  stored.clear();

  // 3. Funnel steps before signup: counted once per browser through a hash
  // of a random ID, with no account, network address or email.
  let pending = [],
    sent = [],
    browserCookie = "";
  globalThis.fetch = (url, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("cf-connecting-ip", "198.51.100.7");
    if (browserCookie) headers.set("cookie", browserCookie);
    sent.push(String(url));
    const request = handle(
      new Request(new URL(url, "http://localhost"), { ...init, headers }),
    );
    pending.push(request);
    return request;
  };
  const settle = async () => {
    while (pending.length) await Promise.all(pending.splice(0));
    for (let n = 0; n < 5; n++)
      await new Promise((resolve) => setImmediate(resolve));
  };
  let pageLoad = 0;
  const loadPage = () => import(`../lib/funnel-client.ts?page=${++pageLoad}`);
  let client = await loadPage();
  client.recordVisitorStep("home");
  client.recordVisitorStep("home");
  await settle();
  same(sent, ["/api/funnel"], "a step is sent once per page");
  const visitor = stored.get("menu-material:visitor");
  ok(/^[0-9a-f-]{36}$/.test(visitor), "the browser keeps a random ID");
  let rows = await steps();
  same(rows.length, 1);
  same(rows[0].id, digest(`null:funnel_step:null:home:${visitor}`));
  same([rows[0].restaurant_id, rows[0].entity_id], [null, null]);
  same(detailsOf(rows[0]), { step: "home" });
  client = await loadPage();
  client.recordVisitorStep("home");
  await settle();
  same(sent.length, 1, "a later page in the same browser doesn't resend");
  // Sent again after 30 days, a browser's step still counts once.
  offset += 31 * day;
  client = await loadPage();
  client.recordVisitorStep("home");
  client.recordVisitorStep("photo");
  await settle();
  same(sent.length, 3);
  rows = await steps();
  same(rows.map((row) => detailsOf(row).step).sort(), ["home", "photo"]);
  // Another browser is another visitor.
  stored.clear();
  client = await loadPage();
  client.recordVisitorStep("home");
  await settle();
  same((await steps()).length, 3);
  ok(
    !JSON.stringify(await all("SELECT * FROM events")).includes(visitor),
    "the browser's ID itself is never stored",
  );
  // Crawlers and automated browsers aren't visitors.
  const realNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  for (const agent of [
    { userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    { userAgent: "Mozilla/5.0 Chrome/141", webdriver: true },
  ]) {
    Object.defineProperty(globalThis, "navigator", {
      value: agent,
      configurable: true,
    });
    client = await loadPage();
    stored.clear();
    client.recordVisitorStep("create");
    await settle();
  }
  Object.defineProperty(globalThis, "navigator", realNavigator);
  same(sent.length, 4, "no step from a crawler or an automated browser");
  // Without storage, a page still counts each step once.
  storageBlocked = true;
  client = await loadPage();
  client.recordVisitorStep("create");
  client.recordVisitorStep("create");
  await settle();
  storageBlocked = false;
  same(sent.length, 5);
  same(
    (await steps()).filter((row) => detailsOf(row).step === "create").length,
    1,
  );

  // 4. The route itself: a known step and a random ID, same-site only, and
  // a per-network allowance.
  const fresh = () => crypto.randomUUID();
  const step = (body, status, options = {}) =>
    expect("funnel", status, { body, ...options });
  const first = fresh();
  await step({ step: "create", visitor: first }, 202);
  await step({ step: "create", visitor: first }, 202);
  same(
    (
      await all(
        "SELECT id FROM events WHERE id=?",
        digest(`null:funnel_step:null:create:${first}`),
      )
    ).length,
    1,
  );
  await step({ step: "signup", visitor: fresh() }, 400);
  await step({ step: "home", visitor: "owner@example.com" }, 400);
  await step({ step: "home" }, 400);
  await step({ step: "home", visitor: fresh() }, 403, {
    headers: { origin: "https://elsewhere.example" },
  });
  for (let n = 0; n < 120; n++)
    await call("funnel", {
      body: { step: "home", visitor: fresh() },
      ip: "192.0.2.77",
    });
  await step({ step: "home", visitor: fresh() }, 429, { ip: "192.0.2.77" });
  await step({ step: "home", visitor: fresh() }, 202, { ip: "192.0.2.78" });

  // 5. At signup: the browser's source, checked again and capped.
  const tagged = await signup(
    "tagged@example.test",
    "Tagged Diner",
    "192.0.2.10",
    {
      attribution: {
        referrer: "https://www.Google.com/search?q=private+words",
        utmSource: " Instagram ",
        utmMedium: "Social",
        utmCampaign: "x".repeat(100),
        ref: "menu",
        email: "someone@example.com",
        extra: "dropped",
      },
    },
  );
  same(
    (await eventsOf(tagged.rid, "signup_source")).map(detailsOf),
    [
      {
        referrer: "google.com",
        utmSource: "instagram",
        utmMedium: "social",
        utmCampaign: "x".repeat(60),
        ref: "menu",
      },
    ],
    "the signup records its source, cleaned",
  );
  for (const [n, attribution] of [
    "a string",
    ["an", "array"],
    { utmSource: "someone@example.com", referrer: "http://10.0.0.1/" },
    {},
    undefined,
  ].entries()) {
    const plain = await signup(
      `plain${n}@example.test`,
      "Plain Diner",
      `192.0.2.${20 + n}`,
      attribution === undefined ? {} : { attribution },
    );
    same(
      (await eventsOf(plain.rid, "signup_source")).length,
      0,
      `no source from ${JSON.stringify(attribution)}`,
    );
    same((await eventsOf(plain.rid, "onboarded")).length, 1);
  }
  await expect("auth/signup", 409, {
    body: {
      email: "tagged@example.test",
      password,
      restaurant: "Again",
      attribution: { ref: "again" },
    },
    ip: "192.0.2.30",
  });
  same((await eventsOf(tagged.rid, "signup_source")).length, 1);

  // 6. The Pro waitlist remembers the feature that opened Plans, once.
  // Older pages send no body at all.
  const join = (cookie, body) =>
    expect("plan-waitlist", 200, {
      cookie,
      body,
      method: "POST",
      ip: "192.0.2.10",
    });
  await join(tagged.cookie, { feature: "menus" });
  await join(tagged.cookie, { feature: "campaigns" });
  same((await eventsOf(tagged.rid, "waitlist_joined")).map(detailsOf), [
    { feature: "menus" },
  ]);
  const waitlisters = [];
  for (const [n, body] of [{}, { feature: "bogus" }, undefined].entries()) {
    const owner = await signup(
      `waitlist${n}@example.test`,
      "Waitlist Diner",
      `192.0.2.${40 + n}`,
    );
    await join(owner.cookie, body);
    waitlisters.push(owner);
    same((await eventsOf(owner.rid, "waitlist_joined")).map(detailsOf), [
      { feature: null },
    ]);
  }
  await expect("plan-waitlist", 401, { body: { feature: "menus" } });

  // 7. Menu exports and "See Pro" clicks.
  const owner = { cookie: tagged.cookie, ip: "192.0.2.10" };
  await expect("events", 200, {
    ...owner,
    body: { kind: "menu_exported", format: "pdf" },
  });
  for (const body of [
    { kind: "menu_exported" },
    { kind: "menu_exported", format: "poster" },
    { kind: "upgrade_requested", feature: "everything" },
    { kind: "upgrade_requested" },
  ])
    await expect("events", 400, { ...owner, body });
  await expect("events", 200, {
    ...owner,
    body: { kind: "upgrade_requested", feature: "menus" },
  });
  same((await eventsOf(tagged.rid, "upgrade_requested")).map(detailsOf), [
    { feature: "menus" },
  ]);
  // From Share in the browser.
  browserCookie = tagged.cookie;
  client.recordMenuExport("table_card");
  await settle();
  same(
    (await eventsOf(tagged.rid, "menu_exported")).map(
      (row) => detailsOf(row).format,
    ),
    ["pdf", "table_card"],
  );
  const other = await signup("qr@example.test", "QR Diner", "192.0.2.50");
  await expect("events", 200, {
    cookie: other.cookie,
    body: { kind: "menu_exported", format: "qr_image" },
  });
  same(
    (await eventsOf(other.rid, "menu_exported")).map(
      (row) => detailsOf(row).format,
    ),
    ["qr_image"],
    "each restaurant has its own",
  );

  // 8. Administration's launch funnel, for the last 7 and 30 days. Earlier
  // activity above is months older by now.
  const setup = await expect("auth/bootstrap", 200, {
    body: {
      email: "ops@example.test",
      setupKey: process.env.ADMIN_SETUP_KEY,
    },
    ip: "192.0.2.60",
  });
  await signup("ops@example.test", "Ops Diner", "192.0.2.60", {
    invite: setup.json.invite,
  });
  const N = offset + 400 * day,
    at = (days) => {
      offset = N - days * day;
    };
  const visit = async (days, name, visitorId) => {
    at(days);
    await step({ step: name, visitor: visitorId }, 202, { ip: "192.0.2.80" });
  };
  const [v1, v2, v3, v4] = [fresh(), fresh(), fresh(), fresh()];
  await visit(40, "home", v4);
  await visit(10, "home", v1);
  for (const name of ["home", "photo", "create"]) await visit(2, name, v2);
  await visit(2, "home", v3);
  const opened = async (days, email, attribution) => {
    at(days);
    return (
      await signup(
        email,
        "Funnel Diner",
        `198.51.100.${days}`,
        attribution ? { attribution } : {},
      )
    ).rid;
  };
  const r4 = await opened(45, "r4@example.test", {
    referrer: "https://news.example.com/story",
  });
  const r1 = await opened(20, "r1@example.test", {
    utmSource: "Instagram",
    utmMedium: "social",
    utmCampaign: "launch",
  });
  at(3);
  const r2Account = await signup(
    "r2@example.test",
    "Funnel Diner",
    "198.51.100.3",
    {
      attribution: { ref: "menu", referrer: "http://localhost/m/corner" },
    },
  );
  const r2 = r2Account.rid;
  const r3 = await opened(1, "r3@example.test");
  const record = async (days, rid, kind, details = {}) => {
    at(days);
    await event(rid, kind, null, details);
  };
  // First downloads or exports: R4's first came before the window.
  await record(40, r4, "export_complete", { tool: "post" });
  await record(2, r4, "export_download_started");
  await record(12, r1, "menu_exported", { format: "pdf" });
  await record(2, r2, "export_download_started");
  await record(1, r2, "native_share_complete");
  // First published menus.
  await record(44, r4, "menu_published");
  await record(5, r4, "menu_published");
  await record(1, r2, "menu_published");
  // Pro features met and what followed, each restaurant once per feature.
  await record(12, r1, "upgrade_prompt_shown", { feature: "menus" });
  await record(3, r1, "upgrade_prompt_shown", { feature: "menus" });
  await record(3, r1, "upgrade_requested", { feature: "menus" });
  at(3);
  await recordWaitlistJoin(r1, { feature: "menus" });
  await record(40, r4, "upgrade_prompt_shown", { feature: "menus" });
  await record(20, r4, "upgrade_prompt_shown", { feature: "menus" });
  await record(20, r4, "upgrade_clicked", { feature: "menus" });
  await record(1, r3, "upgrade_prompt_shown", { feature: "campaigns" });
  at(1);
  await recordWaitlistJoin(r3, {});
  at(0);
  const admin = await expect("auth/login", 200, {
    body: { email: "ops@example.test", password },
    ip: "192.0.2.60",
  });
  await expect("admin/funnel", 403, { cookie: r2Account.cookie });
  await expect("admin/funnel", 403);
  const funnel = async () =>
    (await expect("admin/funnel", 200, { cookie: admin.cookie })).json;
  let report = await funnel();
  const byStep = (r) =>
    Object.fromEntries(r.steps.map((s) => [s.id, [s.unit, s.week, s.month]]));
  same(byStep(report), {
    home: ["visitors", 2, 3],
    photo: ["visitors", 1, 1],
    create: ["visitors", 1, 1],
    signup: ["restaurants", 2, 3],
    export: ["restaurants", 1, 2],
    publish: ["restaurants", 1, 1],
  });
  const bySource = (r) =>
    r.sources
      .map((s) => [s.via, s.name, s.medium, s.campaign, s.week, s.month])
      .sort();
  same(bySource(report), [
    ["campaign", "instagram", "social", "launch", 0, 1],
    ["direct", "", "", "", 1, 1],
    ["ref", "menu", "", "", 1, 1],
  ]);
  const zero = { week: 0, month: 0 };
  same(report.features, [
    {
      feature: "menus",
      shown: { week: 1, month: 2 },
      seePro: { week: 1, month: 1 },
      getPro: { week: 0, month: 1 },
      waitlist: { week: 1, month: 1 },
    },
    {
      feature: "campaigns",
      shown: { week: 1, month: 1 },
      seePro: zero,
      getPro: zero,
      waitlist: zero,
    },
    {
      feature: null,
      shown: zero,
      seePro: zero,
      getPro: zero,
      waitlist: { week: 1, month: 1 },
    },
  ]);
  // A deleted account leaves the funnel with its records.
  await expect("account/delete", 200, {
    cookie: r2Account.cookie,
    body: { password, confirm: "DELETE" },
    ip: "198.51.100.3",
  });
  report = await funnel();
  same(byStep(report).signup, ["restaurants", 1, 2]);
  same(byStep(report).export, ["restaurants", 0, 1]);
  same(byStep(report).publish, ["restaurants", 0, 0]);
  same(
    bySource(report).map((s) => s[0]),
    ["campaign", "direct"],
  );

  // 9. Steps from before signup are kept 90 days; sources stay with the
  // account.
  await housekeeping();
  same((await steps()).map((row) => detailsOf(row).step).sort(), [
    "create",
    "home",
    "home",
    "home",
    "home",
    "photo",
  ]);
  same((await eventsOf(tagged.rid, "signup_source")).length, 1);

  console.log(
    `PASS: ${checks} launch funnel checks: referrer and campaign tags cleaned in the browser and again at signup, steps counted once per browser through a hashed ID (not for crawlers), the route's limits, waitlist features, menu exports and See Pro clicks, the 7- and 30-day admin report (first exports and publications, sources, Pro features, deleted accounts) and 90-day pruning.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
