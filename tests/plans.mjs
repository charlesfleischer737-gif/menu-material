import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const root = mkdtempSync(join(tmpdir(), "plateworthy-plans-"));
process.env.DISHLIGHT_DATA_DIR = root;
process.env.OPENAI_API_KEY = "fixture-only";
process.env.APP_ORIGIN = "https://plateworthy.example.test";
const { handle } = await import("../lib/server/api.ts");
const { one, run, all, id } = await import("../lib/server/core.ts");
const { retryFailed } = await import("../lib/server/menu-tools.ts");
const { enqueue } = await import("../lib/server/generation.ts");
const { env } = await import("../lib/local-runtime.ts");
const { transferGuestPhoto } = await import("../lib/guest-studio.ts");
const { photoBrief } = await import("../lib/studio.ts");
let cookie = "",
  checks = 0,
  stripeCalls = 0,
  checkoutCreates = 0,
  customerCreates = 0;
let subscriptions = [],
  priceAmount = 999,
  checkoutStatus = "open",
  lostJobResponse = false,
  lostFinalSaveResponse = false;
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
      new Request("https://plateworthy.example.test" + url, {
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
  calls.push({ path, form, headers: init.headers });
  if (path === "prices/price_pro") return Response.json(price());
  if (path === "customers") {
    customerCreates++;
    return Response.json({ id: "cus_1" });
  }
  if (path.startsWith("subscriptions?"))
    return Response.json({ data: subscriptions, has_more: false });
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
    new Request("https://plateworthy.example.test/api/" + path, {
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
    new Request("https://plateworthy.example.test/api/billing/webhook", {
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
      amount_paid: 999,
      billing_reason:
        number === 1 ? "subscription_create" : "subscription_cycle",
      lines: {
        data: [
          {
            pricing: { price_details: { price: "price_pro" } },
            period: { start, end },
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
  });
  priceAmount = 1999;
  await call("billing/checkout", {}, 503);
  assert.equal(checkoutCreates, 0);
  checks++;
  priceAmount = 999;
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
  checks += 4;
  await notify("invoice.paid", {}, 400, false);
  await notify("invoice.paid", {}, 400, true, 301);
  let start = Math.floor(Date.now() / 1000) - 1,
    end = start + 30 * 86400;
  subscriptions = [subscription(rid, start, end)];
  subscriptions[0].latest_invoice.status = "open";
  await notify("checkout.session.completed");
  assert.equal((await call("state")).billing.plan, "free");
  subscriptions[0].latest_invoice.status = "paid";
  checkoutStatus = "complete";
  await notify();
  state = await call("state");
  assert.equal(state.billing.plan, "pro");
  assert.equal(state.remaining, 100);
  checks += 2;
  await call("billing/checkout", {}, 409);
  await call("billing/portal", {});
  assert.equal(calls.at(-1).form.customer, "cus_1");
  checks++;
  const proJobs = await Promise.allSettled(
    Array.from({ length: 51 }, (_, n) =>
      enqueue(r, {
        dishId: dish.id,
        requestKey: id(),
        candidateCount: 2,
        revision: "pro-" + n,
      }),
    ),
  );
  assert.equal(proJobs.filter((x) => x.status === "fulfilled").length, 50);
  assert.equal(proJobs.find((x) => x.status === "rejected").reason.status, 402);
  checks += 2;
  await notify();
  assert.equal((await call("state")).remaining, 0);
  subscriptions[0].cancel_at_period_end = true;
  await notify("customer.subscription.updated");
  state = await call("state");
  assert.equal(state.billing.plan, "pro");
  assert.equal(state.billing.cancelAtPeriodEnd, true);
  checks += 2;
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
  assert.equal((await call("state")).remaining, 100);
  const old = await one(
    "SELECT id,job_id FROM outputs WHERE restaurant_id=? AND credit_period!='free' LIMIT 1",
    rid,
  );
  await run("UPDATE outputs SET status='failed' WHERE id=?", old.id);
  assert.equal(
    (await call("state")).remaining,
    100,
    "Old failures do not overfill a new month",
  );
  checks++;
  await retryFailed(r, old.job_id);
  assert.equal(
    (await call("state")).remaining,
    99,
    "Retrying old failed work reserves the current paid period",
  );
  checks++;
  assert.equal(
    (await one("SELECT credit_period FROM outputs WHERE id=?", old.id))
      .credit_period,
    "sub_1:" + start,
  );
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
  assert.equal(
    (await all("SELECT * FROM billing_periods WHERE restaurant_id=?", rid))
      .length,
    2,
  );
  checks++;
  console.log(
    `PASS: ${checks} plan checks: open signup, five free credits, atomic monthly quota, payment verification, signatures, duplicate/out-of-order webhooks, renewals, cancellation, checkout reuse, tenant isolation and loss-safe guest photo handoff. Stripe and AI are fixtures; no payments were made.`,
  );
} finally {
  Date.now = realNow;
  rmSync(root, { recursive: true, force: true });
}
