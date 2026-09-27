import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { tmpdir } from "node:os";
const root = mkdtempSync(join(tmpdir(), "menu-material-plans-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.OPENAI_API_KEY = "fixture-only";
process.env.APP_ORIGIN = "https://menu-material.example.test";
const { handle } = await import("../lib/server/api.ts");
const { one, run, all, id, digest } = await import("../lib/server/core.ts");
const { housekeeping } = await import("../lib/server/safeguards.ts");
const { flushMonitoring } = await import("../lib/server/monitoring.ts");
const { freeImagesNote, imagesLeft } = await import("../lib/free-images.ts");
const { retryFailed } = await import("../lib/server/menu-tools.ts");
const { enqueue } = await import("../lib/server/generation.ts");
const { env } = await import("../lib/local-runtime.ts");
const { transferGuestPhoto } = await import("../lib/guest-studio.ts");
const { photoBrief } = await import("../lib/studio.ts");
const { reconcileDueSubscriptions, billingHousekeeping, billingReadiness } =
  await import("../lib/server/billing.ts");

// Upgrade a populated database, keeping existing grants and constraints intact.
const migrationDb = new DatabaseSync(":memory:");
try {
  migrationDb.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle")
    .filter((name) => name.endsWith(".sql") && name < "0018")
    .sort())
    migrationDb.exec(readFileSync(join("drizzle", file), "utf8"));
  migrationDb.exec(`
    INSERT INTO users (id,email,password,created_at) VALUES ('owner','owner@example.test','fixture',1);
    INSERT INTO restaurants (id,user_id,name,slug,created_at) VALUES ('restaurant','owner','Test','test',1);
    INSERT INTO billing_periods (id,restaurant_id,subscription_id,invoice_id,starts_at,ends_at)
      VALUES ('old','restaurant','sub_old','in_old',1,2);
  `);
  const existing = migrationDb.prepare("SELECT * FROM billing_periods").get();
  migrationDb.exec("BEGIN");
  migrationDb.exec(readFileSync("drizzle/0018_pro_50_images.sql", "utf8"));
  migrationDb.exec("COMMIT");
  assert.deepEqual(
    migrationDb.prepare("SELECT * FROM billing_periods").get(),
    existing,
  );
  migrationDb.exec(`INSERT INTO billing_periods (id,restaurant_id,subscription_id,invoice_id,starts_at,ends_at)
    VALUES ('new','restaurant','sub_new','in_new',2,3)`);
  assert.equal(
    migrationDb
      .prepare("SELECT allowance FROM billing_periods WHERE id='new'")
      .get().allowance,
    50,
  );
  assert.throws(
    () =>
      migrationDb.exec(`INSERT INTO billing_periods (id,restaurant_id,subscription_id,invoice_id,starts_at,ends_at)
    VALUES ('duplicate','restaurant','sub_new','in_new',2,3)`),
    /UNIQUE/,
  );
  assert.throws(
    () =>
      migrationDb.exec(`INSERT INTO billing_periods (id,restaurant_id,subscription_id,invoice_id,starts_at,ends_at)
    VALUES ('foreign','missing','sub_other','in_other',2,3)`),
    /FOREIGN KEY/,
  );
  assert.deepEqual(migrationDb.prepare("PRAGMA foreign_key_check").all(), []);
} finally {
  migrationDb.close();
}

let cookie = "",
  checks = 0,
  stripeCalls = 0,
  checkoutCreates = 0,
  customerCreates = 0;
let subscriptions = [],
  priceAmount = 900,
  checkoutStatus = "open",
  lostJobResponse = false,
  lostFinalSaveResponse = false,
  customerDeleteFails = false,
  stripeDown = false;
const deletedCustomers = new Set();
const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;
const price = () => ({
  id: "price_pro",
  active: true,
  currency: "usd",
  unit_amount: priceAmount,
  recurring: { interval: "month", interval_count: 1 },
});
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  if (String(url).startsWith("/api/")) {
    const result = await handle(
      new Request("https://menu-material.example.test" + url, {
        ...init,
        headers: { ...init.headers, cookie },
      }),
    );
    if (url === "/api/jobs" && lostJobResponse) {
      lostJobResponse = false;
      throw Error("Simulated lost job response");
    }
    if (
      url === "/api/creation-drafts" &&
      lostFinalSaveResponse &&
      JSON.parse(init.body).draft.step === 4
    ) {
      lostFinalSaveResponse = false;
      throw Error("Simulated lost final save response");
    }
    return result;
  }
  assert(
    String(url).startsWith("https://api.stripe.com/v1/"),
    "No live AI calls permitted",
  );
  stripeCalls++;
  assert.equal(init.headers["Stripe-Version"], "2025-06-30.basil");
  const path = String(url).replace("https://api.stripe.com/v1/", "");
  const form = Object.fromEntries(new URLSearchParams(init.body));
  calls.push({ path, form, headers: init.headers, method: init.method });
  if (path === "prices/price_pro") return Response.json(price());
  if (path === "customers") {
    customerCreates++;
    return Response.json({ id: "cus_" + customerCreates });
  }
  if (path.startsWith("customers/")) {
    const customer = path.slice("customers/".length);
    if (init.method === "DELETE") {
      if (customerDeleteFails)
        return Response.json({ error: {} }, { status: 500 });
      deletedCustomers.add(customer);
    }
    return Response.json({
      id: customer,
      ...(deletedCustomers.has(customer) ? { deleted: true } : {}),
    });
  }
  if (path.startsWith("subscriptions?"))
    return stripeDown
      ? Response.json({ error: {} }, { status: 500 })
      : Response.json({ data: subscriptions, has_more: false });
  if (path.endsWith("/expire"))
    return Response.json({ id: path.split("/")[2], status: "expired" });
  if (path.startsWith("checkout/sessions/cs_"))
    return Response.json({
      id: "cs_" + checkoutCreates,
      status: checkoutStatus,
      url: "https://checkout.stripe.com/session",
    });
  if (path === "checkout/sessions") {
    checkoutCreates++;
    return Response.json({
      id: "cs_" + checkoutCreates,
      url: "https://checkout.stripe.com/session",
    });
  }
  if (path === "billing_portal/sessions")
    return Response.json({ url: "https://billing.stripe.com/portal" });
  throw Error("Unexpected Stripe fixture " + path);
};
async function call(path, data, expected = 200, headers = {}) {
  const res = await handle(
    new Request("https://menu-material.example.test/api/" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: { cookie, "content-type": "application/json", ...headers },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  );
  const value = await res.json();
  assert.equal(res.status, expected, path + ": " + JSON.stringify(value));
  checks++;
  if (res.headers.get("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return value;
}
async function notify(
  type = "invoice.paid",
  data = {},
  expected = 200,
  signature = true,
  age = 0,
) {
  const raw = JSON.stringify({
    id: id(),
    type,
    data: { object: { customer: "cus_1", ...data } },
  });
  const timestamp = Math.floor(Date.now() / 1000) - age;
  const sig = createHmac("sha256", "whsec_fixture")
    .update(timestamp + "." + raw)
    .digest("hex");
  const res = await handle(
    new Request("https://menu-material.example.test/api/billing/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": `t=${timestamp},v1=${signature ? sig : "00".repeat(32)}`,
      },
      body: raw,
    }),
  );
  assert.equal(res.status, expected, await res.text());
  checks++;
}
function subscription(rid, start, end, number = 1) {
  return {
    id: "sub_1",
    customer: "cus_1",
    metadata: { restaurant_id: rid },
    created: 10,
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [
        {
          quantity: 1,
          current_period_start: start,
          current_period_end: end,
          price: price(),
        },
      ],
    },
    latest_invoice: {
      id: "in_" + number,
      customer: "cus_1",
      status: "paid",
      amount_paid: 900,
      billing_reason:
        number === 1 ? "subscription_create" : "subscription_cycle",
      lines: {
        data: [
          {
            pricing: { price_details: { price: "price_pro" } },
            period: { start, end },
            amount: 900,
          },
        ],
      },
    },
  };
}
try {
  await call("jobs", {}, 401);
  await call("billing/checkout", {}, 401);
  await call("auth/signup", {
    email: "free@example.test",
    password: "a sufficiently long password",
    restaurant: "Test Restaurant",
    allowance: 10000,
    role: "admin",
  });
  let state = await call("state");
  assert.equal(state.remaining, 5);
  assert.equal(state.user.role, "owner");
  assert.equal(state.billing.plan, "free");
  checks += 3;
  let freeCookie = cookie;
  const rid = state.restaurant.id,
    r = await one("SELECT * FROM restaurants WHERE id=?", state.restaurant.id);
  await call(
    "auth/signup",
    { email: "FREE@example.test", password: "a sufficiently long password" },
    409,
  );
  await call(
    "auth/signup",
    {
      email: "invalid@example.test",
      password: "a sufficiently long password",
      invite: "bad",
    },
    403,
  );
  const dish = await call("dishes", {
    name: "Food",
    description: "My dish",
    confirmed: true,
  });
  const pending = await Promise.allSettled(
    Array.from({ length: 6 }, (_, n) =>
      enqueue(r, { dishId: dish.id, requestKey: id(), revision: "free-" + n }),
    ),
  );
  assert.equal(pending.filter((x) => x.status === "fulfilled").length, 5);
  assert.equal(pending.find((x) => x.status === "rejected").reason.status, 402);
  checks += 2;
  assert.equal((await call("state")).remaining, 0);
  const output = await one(
    "SELECT id FROM outputs WHERE restaurant_id=? LIMIT 1",
    rid,
  );
  await run("UPDATE outputs SET status='failed' WHERE id=?", output.id);
  assert.equal((await call("state")).remaining, 1);
  await call("billing/checkout", {}, 503);
  assert.equal(stripeCalls, 0);
  checks++;
  Object.assign(env, {
    STRIPE_BILLING_ENABLED: "true",
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    STRIPE_PRO_PRICE_ID: "price_pro",
    // The owner's own details, which checkout and messages show once set.
    TERMS_URL: "https://legal.example.test/terms",
    SUPPORT_EMAIL: "help@menu-material.example.test",
  });
  priceAmount = 999;
  await call("billing/checkout", {}, 503);
  assert.equal(checkoutCreates, 0);
  checks++;
  priceAmount = 900;
  await call("billing/checkout", {
    price: "attacker_price",
    customer: "someone_else",
  });
  await call("billing/checkout", {});
  assert.equal(checkoutCreates, 1);
  assert.equal(customerCreates, 1);
  checks += 2;
  const checkout = calls.find((c) => c.path === "checkout/sessions");
  assert.equal(checkout.form["line_items[0][price]"], "price_pro");
  assert.equal(checkout.form["line_items[0][quantity]"], "1");
  assert.equal(
    checkout.form["subscription_data[metadata][restaurant_id]"],
    rid,
  );
  assert.equal(checkout.form.customer, "cus_1");
  // Renewal and cancellation terms under the pay button, with the Terms.
  const terms = checkout.form["custom_text[submit][message]"];
  assert.match(terms, /renews monthly until you cancel/);
  assert.match(terms, /in Plans under Manage billing/);
  assert.match(terms, /\[Terms\]\(https:\/\/legal\.example\.test\/terms\)$/);
  assert(terms.length <= 1200, "Stripe's custom text limit");
  checks += 5;
  await notify("invoice.paid", {}, 400, false);
  await notify("invoice.paid", {}, 400, true, 301);
  let start = Math.floor(Date.now() / 1000) - 1,
    end = start + 30 * 86400;
  subscriptions = [subscription(rid, start, end)];
  subscriptions[0].latest_invoice.status = "open";
  await notify("checkout.session.completed");
  assert.equal((await call("state")).billing.plan, "free");
  subscriptions[0].latest_invoice.status = "paid";
  subscriptions[0].latest_invoice.lines.data[0].amount = 0;
  await notify();
  assert.equal(
    (await call("state")).billing.plan,
    "free",
    "A $0 Pro line, such as a trial, is not a paid month",
  );
  subscriptions[0].latest_invoice.lines.data[0].amount = 900;
  subscriptions[0].items.data[0].price.unit_amount = 999;
  await notify();
  assert.equal(
    (await call("state")).billing.plan,
    "free",
    "The obsolete $9.99 price cannot grant Pro images",
  );
  subscriptions[0].items.data[0].price.unit_amount = 900;
  checks += 2;
  checkoutStatus = "complete";
  // $3 of the $9 came from the customer's credit balance: still a paid month.
  subscriptions[0].latest_invoice.amount_paid = 600;
  await notify();
  state = await call("state");
  assert.equal(state.billing.plan, "pro");
  assert.equal(state.remaining, 50);
  assert.equal(state.billing.allowance, 50);
  assert.equal(
    (
      await one(
        "SELECT allowance FROM billing_periods WHERE restaurant_id=?",
        rid,
      )
    ).allowance,
    50,
  );
  checks += 4;
  await call("billing/checkout", {}, 409);
  // A live subscription blocks deleting the account until Pro has ended;
  // nothing is deleted, here or at Stripe.
  const deletion = {
    password: "a sufficiently long password",
    confirm: "DELETE",
  };
  const subscribed = await call("account/delete", deletion, 409);
  assert.match(subscribed.error, /Cancel it in Plans, under Manage billing/);
  assert.match(subscribed.error, /help@menu-material\.example\.test/);
  assert(
    !calls.some((c) => c.method === "DELETE" || c.path.endsWith("/expire")),
  );
  assert(await one("SELECT id FROM restaurants WHERE id=?", rid));
  checks += 3;
  await call("billing/portal", {});
  assert.equal(calls.at(-1).form.customer, "cus_1");
  checks++;
  const proJobs = await Promise.allSettled(
    Array.from({ length: 26 }, (_, n) =>
      enqueue(r, {
        dishId: dish.id,
        requestKey: id(),
        candidateCount: 2,
        revision: "pro-" + n,
      }),
    ),
  );
  assert.equal(proJobs.filter((x) => x.status === "fulfilled").length, 25);
  assert.equal(proJobs.find((x) => x.status === "rejected").reason.status, 402);
  await assert.rejects(
    () => enqueue(r, { dishId: dish.id, requestKey: id(), candidateCount: 1 }),
    (error) => error.status === 402,
    "The 51st image is blocked even when requested alone",
  );
  checks += 2;
  await notify();
  assert.equal((await call("state")).remaining, 0);
  subscriptions[0].cancel_at_period_end = true;
  await notify("customer.subscription.updated");
  state = await call("state");
  assert.equal(state.billing.plan, "pro");
  assert.equal(state.billing.cancelAtPeriodEnd, true);
  checks += 2;
  // Cancelled but still paid for: deletion waits for the month to end.
  assert.match(
    (await call("account/delete", deletion, 409)).error,
    /cancelled and ends at the end of the month you’ve paid for/,
  );
  checks++;
  // A new billing period without a successful payment cannot mint credits.
  offset += 31 * 86400000;
  start = end;
  end = start + 30 * 86400;
  await call("auth/login", {
    email: "free@example.test",
    password: "a sufficiently long password",
  });
  freeCookie = cookie;
  subscriptions = [subscription(rid, start, end, 2)];
  subscriptions[0].status = "past_due";
  subscriptions[0].latest_invoice.status = "open";
  subscriptions[0].latest_invoice.amount_paid = 0;
  await notify("invoice.payment_failed");
  state = await call("state");
  assert.equal(state.billing.plan, "free");
  assert.equal(state.remaining, 1);
  checks += 2;
  subscriptions = [subscription(rid, start, end, 2)];
  await notify();
  assert.equal((await call("state")).remaining, 50);
  const old = await one(
    "SELECT id,job_id FROM outputs WHERE restaurant_id=? AND credit_period!='free' LIMIT 1",
    rid,
  );
  await run("UPDATE outputs SET status='failed' WHERE id=?", old.id);
  assert.equal(
    (await call("state")).remaining,
    50,
    "Old failures do not overfill a new month",
  );
  checks++;
  await retryFailed(r, old.job_id);
  assert.equal(
    (await call("state")).remaining,
    49,
    "Retrying old failed work reserves the current paid period",
  );
  checks++;
  assert.equal(
    (await one("SELECT credit_period FROM outputs WHERE id=?", old.id))
      .credit_period,
    "sub_1:" + start,
  );
  checks++;

  // Without Stripe's notifications, the scheduled check records a renewal
  // soon after the month ends, then waits before asking Stripe again.
  const login = async () => {
    await call("auth/login", {
      email: "free@example.test",
      password: "a sufficiently long password",
    });
    freeCookie = cookie;
  };
  let report = await billingReadiness();
  assert.equal(typeof report.lastNotificationSeconds, "number");
  assert.equal(report.ok, true);
  let before = stripeCalls;
  assert.equal((await reconcileDueSubscriptions()).checked, 0);
  assert.equal(stripeCalls, before, "Nothing is due mid-month");
  checks += 3;
  offset += 29 * 86400000 + 10 * 60000;
  const renewedStart = end,
    renewedEnd = end + 30 * 86400;
  // Stripe starts the new month, and charges its invoice about an hour later.
  subscriptions = [subscription(rid, renewedStart, renewedEnd, 3)];
  subscriptions[0].latest_invoice.status = "draft";
  let swept = await reconcileDueSubscriptions();
  assert.deepEqual([swept.checked, swept.failed], [1, 0]);
  assert.equal(stripeCalls, before + 1);
  await login();
  state = await call("state");
  assert.equal(state.billing.plan, "free", "No images before the charge");
  assert.equal(state.billing.features.source, "renewing");
  before = stripeCalls;
  assert.equal((await reconcileDueSubscriptions()).checked, 0);
  assert.equal(stripeCalls, before, "Checked moments ago");
  checks += 5;
  offset += 11 * 60000;
  subscriptions[0].latest_invoice.status = "paid";
  swept = await reconcileDueSubscriptions();
  assert.deepEqual([swept.checked, swept.failed], [1, 0]);
  state = await call("state");
  assert.equal(state.billing.plan, "pro");
  assert.equal(state.remaining, 50);
  checks += 3;
  // When neither notifications nor the check get through, readiness says so.
  offset += 30 * 86400000 + 4 * 3600000;
  stripeDown = true;
  swept = await reconcileDueSubscriptions();
  assert.deepEqual([swept.checked, swept.failed], [1, 1]);
  assert(swept.error, "The failure is returned for the error report");
  report = await billingReadiness();
  assert.equal(report.renewalsOverdue, 1);
  assert.equal(report.ok, false);
  checks += 4;
  // Stripe recovers. Four hours after the month ended, the next check comes
  // a little over an hour later, and the renewal is on record.
  stripeDown = false;
  subscriptions = [subscription(rid, renewedEnd, renewedEnd + 30 * 86400, 4)];
  assert.equal((await reconcileDueSubscriptions()).checked, 0, "Waits a while");
  offset += 90 * 60000;
  swept = await reconcileDueSubscriptions();
  assert.deepEqual([swept.checked, swept.failed], [1, 0]);
  report = await billingReadiness();
  assert.equal(report.renewalsOverdue, 0);
  assert.equal(report.ok, true);
  // The worker's tick runs the check at most every five minutes.
  assert.notEqual(await billingHousekeeping(), null);
  assert.equal(await billingHousekeeping(), null);
  await login();
  assert.equal((await call("state")).billing.plan, "pro");
  checks += 6;
  // Switched on without every setting, billing stays off and readiness names
  // what's missing.
  const secret = env.STRIPE_WEBHOOK_SECRET;
  delete env.STRIPE_WEBHOOK_SECRET;
  report = await billingReadiness();
  assert.deepEqual(
    [report.ok, report.enabled, report.missing],
    [false, false, ["STRIPE_WEBHOOK_SECRET"]],
  );
  env.STRIPE_WEBHOOK_SECRET = secret;
  checks++;

  await notify("customer.subscription.deleted", {
    id: "old_subscription",
    status: "canceled",
  });
  assert.equal(
    (await call("state")).billing.plan,
    "pro",
    "Canonical Stripe state wins over old event payloads",
  );
  checks++;
  subscriptions[0].status = "canceled";
  await notify("customer.subscription.deleted");
  assert.equal((await call("state")).remaining, 1);
  await call("billing/checkout", {});
  assert.equal(checkoutCreates, 2, "Cancelled users can start a new checkout");
  checks++;
  await call("billing/checkout", {}, 403, { origin: "https://evil.example" });
  cookie = "";
  await call("auth/signup", {
    email: "guest@example.test",
    password: "a sufficiently long password",
  });
  const guestState = await call("state");
  assert.equal(guestState.remaining, 5);
  await call("billing/portal", {}, 400);
  await call("billing/status");
  assert.equal((await call("state")).billing.plan, "free");
  // Exercise the exact handoff used after signup, including an interrupted reply.
  const stored = new Map();
  globalThis.localStorage = { setItem: (k, v) => stored.set(k, v) };
  globalThis.history = { replaceState() {} };
  const bytes = readFileSync("public/pasta.jpg");
  const file = new File([bytes], "my-dish.jpg", { type: "image/jpeg" });
  const draft = {
    ...photoBrief(),
    name: "My pasta",
    description: "Tomato and basil",
    look: "menu-stone",
    styleChosen: true,
    note: "Keep the bowl",
    surface: "As shown",
    mode: "photo",
  };
  const transfer = { id: id(), revision: 0, requestKey: id() };
  lostJobResponse = true;
  await assert.rejects(
    transferGuestPhoto(
      draft,
      { file, normalized: file, url: "blob:local" },
      null,
      guestState,
      transfer,
    ),
    /Simulated/,
  );
  lostFinalSaveResponse = true;
  await assert.rejects(
    transferGuestPhoto(
      draft,
      { file, normalized: file, url: "blob:local" },
      null,
      guestState,
      transfer,
    ),
    /Simulated lost final save/,
  );
  checks++;
  await transferGuestPhoto(
    draft,
    { file, normalized: file, url: "blob:local" },
    null,
    guestState,
    transfer,
  );
  assert.equal(
    (
      await one(
        "SELECT count(*) n FROM jobs WHERE restaurant_id=?",
        guestState.restaurant.id,
      )
    ).n,
    1,
  );
  assert.equal(
    (
      await one(
        "SELECT count(*) n FROM assets WHERE restaurant_id=?",
        guestState.restaurant.id,
      )
    ).n,
    1,
  );
  const saved = JSON.parse(
    (await one("SELECT draft FROM creation_drafts WHERE id=?", transfer.id))
      .draft,
  );
  assert.equal(saved.look, "menu-stone");
  assert.equal(saved.note, "Keep the bowl");
  assert.equal(saved.jobId, transfer.jobId);
  assert.equal(saved.step, 4);
  assert(stored.size >= 2);
  checks += 7;
  assert.equal((await call("state")).remaining, 4);
  const referenceDraft = {
    ...draft,
    look: "reference",
    referenceId: "guest-reference",
    photoReferenceIds: ["guest-reference"],
  };
  const referenceTransfer = { id: id(), revision: 0, requestKey: id() };
  await assert.rejects(
    transferGuestPhoto(
      referenceDraft,
      { file, normalized: file, url: "blob:local" },
      null,
      guestState,
      referenceTransfer,
    ),
    /Add an inspiration photo/,
  );
  assert.equal(
    referenceTransfer.dishId,
    undefined,
    "Missing guest inspiration is detected before account writes",
  );
  const guestReference = { file, normalized: file, url: "blob:reference" };
  // Inspiration photos are Pro: a free account hears so before any writes.
  await assert.rejects(
    transferGuestPhoto(
      referenceDraft,
      { file, normalized: file, url: "blob:local" },
      guestReference,
      guestState,
      referenceTransfer,
    ),
    /Inspiration photos are part of Pro/,
  );
  assert.equal(
    referenceTransfer.dishId,
    undefined,
    "Free inspiration is refused before account writes",
  );
  // A guest signing in to an account with Pro features continues with it.
  await run(
    "UPDATE restaurants SET pro_until=? WHERE id=?",
    Date.now() + 86400000,
    guestState.restaurant.id,
  );
  Object.assign(guestState, await call("state"));
  checks += 2;
  await transferGuestPhoto(
    referenceDraft,
    { file, normalized: file, url: "blob:local" },
    guestReference,
    guestState,
    referenceTransfer,
  );
  const referenceSaved = JSON.parse(
    (
      await one(
        "SELECT draft FROM creation_drafts WHERE id=?",
        referenceTransfer.id,
      )
    ).draft,
  );
  const referenceJob = JSON.parse(
    (await one("SELECT details FROM jobs WHERE id=?", referenceTransfer.jobId))
      .details,
  );
  assert.notEqual(referenceTransfer.referenceId, "guest-reference");
  assert.notEqual(referenceTransfer.referenceId, referenceTransfer.sourceId);
  assert.deepEqual(referenceSaved.photoReferenceIds, [
    referenceTransfer.referenceId,
  ]);
  assert.deepEqual(referenceJob.style.referenceIds, [
    referenceTransfer.referenceId,
  ]);
  assert.equal(referenceSaved.sourceId, referenceTransfer.sourceId);
  const beforeRetryAssets = (
    await one(
      "SELECT count(*) n FROM assets WHERE restaurant_id=?",
      guestState.restaurant.id,
    )
  ).n;
  await transferGuestPhoto(
    referenceDraft,
    { file, normalized: file, url: "blob:local" },
    guestReference,
    guestState,
    referenceTransfer,
  );
  assert.equal(
    (
      await one(
        "SELECT count(*) n FROM assets WHERE restaurant_id=?",
        guestState.restaurant.id,
      )
    ).n,
    beforeRetryAssets,
  );
  assert.equal(
    (await call("state")).remaining,
    3,
    "Guest reference handoff retry cannot consume another image",
  );
  checks += 9;
  cookie = freeCookie;
  assert.equal((await call("state")).remaining, 1);
  // Two months recorded from notifications, two by the scheduled check.
  assert.equal(
    (await all("SELECT * FROM billing_periods WHERE restaurant_id=?", rid))
      .length,
    4,
  );
  checks++;

  // Starting checkout once no longer blocks deleting the account. The open
  // checkout is expired and the Stripe customer deleted (Stripe keeps its
  // invoices); if Stripe can't be reached, nothing is deleted.
  cookie = "";
  await call("auth/signup", {
    email: "abandoned@example.test",
    password: "a sufficiently long password",
    restaurant: "Corner Checkout Diner",
  });
  const abandoned = (await call("state")).restaurant.id;
  checkoutStatus = "open";
  await call("billing/checkout", {});
  const started = await one(
    "SELECT customer_id,checkout_id FROM billing_accounts WHERE restaurant_id=?",
    abandoned,
  );
  assert.equal(started.customer_id, "cus_2");
  customerDeleteFails = true;
  assert.match(
    (await call("account/delete", deletion, 503)).error,
    /wasn’t deleted\. Please try again/,
  );
  assert(await one("SELECT id FROM restaurants WHERE id=?", abandoned));
  assert.deepEqual(
    await one(
      "SELECT customer_id,checkout_id FROM billing_accounts WHERE restaurant_id=?",
      abandoned,
    ),
    started,
  );
  customerDeleteFails = false;
  await call("account/delete", deletion);
  assert(
    calls.some(
      (c) => c.path === `checkout/sessions/${started.checkout_id}/expire`,
    ),
  );
  assert(deletedCustomers.has("cus_2"));
  assert.equal(
    await one("SELECT id FROM restaurants WHERE id=?", abandoned),
    null,
  );
  assert.equal(
    await one(
      "SELECT * FROM billing_accounts WHERE restaurant_id=?",
      abandoned,
    ),
    null,
  );
  checks += 7;
  // Once a subscription has ended, its paid periods go with the account too.
  cookie = freeCookie;
  await call("account/delete", deletion);
  assert(deletedCustomers.has("cus_1"));
  for (const table of ["billing_periods", "billing_accounts"])
    assert.equal(
      (
        await one(
          `SELECT count(*) AS n FROM ${table} WHERE restaurant_id=?`,
          rid,
        )
      ).n,
      0,
      table,
    );
  assert.equal(await one("SELECT id FROM restaurants WHERE id=?", rid), null);
  checks += 4;

  // Free images are once per email: a new account with the email of a
  // deleted one that had them starts without, and is told so. Only a hash
  // of the email was kept. An invitation still brings its own images.
  offset += 2 * 86400000; // a new UTC day, for the grants counted below
  const signupFrom = async (email, ip, extra = {}) => {
    cookie = "";
    await call(
      "auth/signup",
      { email, password: deletion.password, restaurant: "Grants", ...extra },
      200,
      { "cf-connecting-ip": ip },
    );
    return call("state");
  };
  const returning = await signupFrom("free@example.test", "192.0.2.110");
  assert.equal(returning.remaining, 0);
  assert.deepEqual(returning.freeImages, { status: "used", images: 5 });
  assert(
    await one(
      "SELECT 1 FROM free_grant_emails WHERE hash=?",
      digest("free-grant:free@example.test"),
    ),
  );
  assert.equal(
    await one(
      "SELECT 1 FROM free_grant_emails WHERE hash LIKE '%free@example.test%'",
    ),
    null,
  );
  const returningDish = await call("dishes", {
    name: "Soup",
    description: "Tomato soup",
    confirmed: true,
  });
  const noImages = (restaurantId, dishId, message) =>
    one("SELECT * FROM restaurants WHERE id=?", restaurantId).then((row) =>
      assert.rejects(
        enqueue(row, { dishId, requestKey: id(), revision: "grants" }),
        (e) => e.status === 402 && e.message === message,
      ),
    );
  await noImages(
    returning.restaurant.id,
    returningDish.id,
    "This email already had its 5 free images. Your work is saved; see Plans for more images.",
  );
  const invitation = "invitation-for-a-returning-owner-0123456789";
  await run(
    "INSERT INTO invites (hash,email,role,allowance,expires_at,created_at) VALUES (?,?,'owner',3,?,?)",
    digest(invitation),
    "abandoned@example.test",
    Date.now() + 86400000,
    Date.now(),
  );
  const invited = await signupFrom("abandoned@example.test", "192.0.2.111", {
    invite: invitation,
  });
  assert.equal(invited.remaining, 3);
  assert.equal(invited.freeImages, null);
  checks += 7;

  // At most FREE_SIGNUP_GRANTS_PER_DAY new accounts a day get their free
  // images at once. Later ones open anyway; their images are held and the
  // owner is told when they arrive, by their place in line, rather than "0
  // left". The team hears once a day which setting to raise.
  env.FREE_SIGNUP_GRANTS_PER_DAY = "2";
  const granted = [],
    held = [],
    warnings = [],
    warn = console.warn;
  for (let n = 0; n < 2; n++)
    granted.push(
      await signupFrom(`granted${n}@example.test`, `192.0.2.12${n}`),
    );
  console.warn = (line) => warnings.push(String(line));
  for (let n = 0; n < 3; n++)
    held.push(await signupFrom(`held${n}@example.test`, `192.0.2.13${n}`));
  await flushMonitoring();
  console.warn = warn;
  const grantAlerts = warnings
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return {};
      }
    })
    .filter((l) => l.type === "alert" && l.condition === "free-signup-grants");
  assert.equal(grantAlerts.length, 1, "one alert a day");
  assert.match(grantAlerts[0].message, /raise FREE_SIGNUP_GRANTS_PER_DAY\.$/);
  assert.deepEqual(
    [...granted, ...held].map((s) => [s.remaining, s.freeImages]),
    [
      [5, null],
      [5, null],
      [0, { status: "held", images: 5, days: 1 }],
      [0, { status: "held", images: 5, days: 1 }],
      [0, { status: "held", images: 5, days: 2 }],
    ],
  );
  // What the balance shows instead of "0 left" (lib/free-images.ts).
  assert.deepEqual(
    [held[0], held[2], returning].map((s) => freeImagesNote(s.freeImages)),
    [
      "Your 5 free images arrive within a day.",
      "Your 5 free images arrive within 2 days.",
      "This email already had its 5 free images.",
    ],
  );
  assert.deepEqual(
    [imagesLeft(0, held[0].freeImages), imagesLeft(0, returning.freeImages)],
    ["5 images on the way", "0 images left"],
  );
  const lastInLine = held[2].restaurant.id,
    heldDish = await call("dishes", {
      name: "Stew",
      description: "Beef stew",
      confirmed: true,
    });
  await noImages(
    lastInLine,
    heldDish.id,
    "Your 5 free images arrive within 2 days. Your work is saved, so you can create this image then.",
  );
  // The next day's grants go to them oldest first, from the hourly
  // housekeeping or when a waiting owner opens the workspace. A newcomer
  // waits behind them even while the day has grants left.
  offset += 86400000;
  await housekeeping();
  const heldNow = async () =>
    (
      await all(
        `SELECT allowance,free_grant FROM restaurants WHERE id IN (${held.map(() => "?").join(",")}) ORDER BY created_at`,
        ...held.map((s) => s.restaurant.id),
      )
    ).map((row) => [row.allowance, row.free_grant]);
  assert.deepEqual(await heldNow(), [
    [5, null],
    [5, null],
    [0, "held"],
  ]);
  env.FREE_SIGNUP_GRANTS_PER_DAY = "3";
  const latecomer = await signupFrom("latecomer@example.test", "192.0.2.135");
  assert.deepEqual(latecomer.freeImages, {
    status: "held",
    images: 5,
    days: 1,
  });
  // A minute on, the latecomer's workspace grants the day's third to the
  // last of the three; theirs arrives the next day.
  offset += 61000;
  const stillWaiting = await call("state");
  assert.deepEqual(await heldNow(), [
    [5, null],
    [5, null],
    [5, null],
  ]);
  assert.equal(stillWaiting.remaining, 0);
  assert.deepEqual(stillWaiting.freeImages, latecomer.freeImages);
  offset += 86400000;
  const arrived = await call("state");
  assert.equal(arrived.restaurant.id, latecomer.restaurant.id);
  assert.equal(arrived.remaining, 5);
  assert.equal(arrived.freeImages, null);
  // An account deleted while its images were still held never had them, so
  // it leaves no hash. At 0, every new account's images wait.
  env.FREE_SIGNUP_GRANTS_PER_DAY = "0";
  const waiting = await signupFrom("waiting@example.test", "192.0.2.140");
  assert.deepEqual(waiting.freeImages, {
    status: "held",
    images: 5,
    days: null,
  });
  await call("account/delete", deletion);
  assert.equal(
    await one(
      "SELECT 1 FROM free_grant_emails WHERE hash=?",
      digest("free-grant:waiting@example.test"),
    ),
    null,
  );
  delete env.FREE_SIGNUP_GRANTS_PER_DAY;
  checks += 11;
  // The email hash is kept for a year, as the privacy page says.
  const kept = digest("free-grant:free@example.test");
  const { created_at } = await one(
    "SELECT created_at FROM free_grant_emails WHERE hash=?",
    kept,
  );
  offset += created_at + 364 * 86400000 - Date.now();
  await housekeeping();
  assert(await one("SELECT 1 FROM free_grant_emails WHERE hash=?", kept));
  offset += 2 * 86400000;
  await housekeeping();
  assert.equal(
    await one("SELECT 1 FROM free_grant_emails WHERE hash=?", kept),
    null,
  );
  checks += 2;
  console.log(
    `PASS: ${checks} plan checks: open signup, five free credits once per email (remembered for a year) and for a daily number of new accounts (later ones held, told when, then granted), atomic monthly quota, payment verification (coupons and credit count, $0 lines don't), signatures, duplicate/out-of-order webhooks, renewals, renewals and outages caught by the scheduled check without webhooks, billing readiness, cancellation, checkout reuse, checkout terms, account deletion around billing, tenant isolation and loss-safe guest photo handoff. Stripe and AI are fixtures; no payments were made.`,
  );
} finally {
  Date.now = realNow;
  rmSync(root, { recursive: true, force: true });
}
