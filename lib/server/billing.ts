import { createHmac, timingSafeEqual } from "node:crypto";
import {
  assert,
  config,
  db,
  id,
  limit,
  now,
  one,
  owner,
  response,
  run,
  type Row,
} from "./core";
import { limitedBytes } from "./safeguards";
import { imageEntitlement } from "./entitlements";
import { PRO_PLAN } from "../plans";

export function billingEnabled() {
  return (
    config("STRIPE_BILLING_ENABLED") === "true" &&
    !!config("STRIPE_SECRET_KEY") &&
    !!config("STRIPE_WEBHOOK_SECRET") &&
    !!config("STRIPE_PRO_PRICE_ID") &&
    !!config("APP_ORIGIN")
  );
}
export async function billingSummary(restaurantId: string) {
  const account = await one(
    "SELECT status,cancel_at_period_end,customer_id FROM billing_accounts WHERE restaurant_id=?",
    restaurantId,
  );
  return {
    ...(await imageEntitlement(restaurantId)),
    enabled: billingEnabled(),
    status: account?.status || "free",
    cancelAtPeriodEnd: !!account?.cancel_at_period_end,
    canManage: !!account?.customer_id && billingEnabled(),
  };
}
async function stripe(
  path: string,
  fields?: Record<string, string>,
  key?: string,
): Promise<Row> {
  assert(
    billingEnabled(),
    503,
    "Pro subscriptions are coming soon. Your free account is ready to use.",
  );
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method: fields ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + config("STRIPE_SECRET_KEY"),
      "Stripe-Version": "2025-06-30.basil",
      ...(fields
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: fields ? new URLSearchParams(fields) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  assert(
    res.ok,
    503,
    "Billing is temporarily unavailable. Please try again; your plan has not been changed here.",
  );
  return res.json();
}
const externalId = (value: string | Row | null | undefined) =>
  typeof value === "string" ? value : value?.id;
function proPrice(price: Row) {
  return (
    price?.id === config("STRIPE_PRO_PRICE_ID") &&
    price.currency === PRO_PLAN.currency &&
    price.unit_amount === PRO_PLAN.amountCents &&
    price.recurring?.interval === PRO_PLAN.interval &&
    price.recurring?.interval_count === PRO_PLAN.intervalCount
  );
}
function origin() {
  const url = new URL(config("APP_ORIGIN"));
  assert(
    url.protocol === "https:" ||
      (config("LOCAL_DEVELOPMENT") === "true" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)),
    503,
    "Billing is not ready yet.",
  );
  return url.origin;
}
async function withAccount<T>(
  rid: string,
  work: (account: Row, lease: string) => Promise<T>,
) {
  await run(
    "INSERT OR IGNORE INTO billing_accounts (restaurant_id) VALUES (?)",
    rid,
  );
  const lease = id();
  const account = await one(
    "UPDATE billing_accounts SET lease_until=?,lease_token=? WHERE restaurant_id=? AND lease_until<? RETURNING *",
    now() + 120000,
    lease,
    rid,
    now(),
  );
  assert(
    account,
    409,
    "Your subscription is being updated. Please try again in a moment.",
  );
  try {
    return await work(account, lease);
  } finally {
    await run(
      "UPDATE billing_accounts SET lease_until=0,lease_token=NULL WHERE restaurant_id=? AND lease_token=?",
      rid,
      lease,
    );
  }
}
// Always read current Stripe state under one restaurant lease. Old and duplicate
// notifications cannot roll back a cancellation or refill an already-used month.
async function reconcile(account: Row, lease: string) {
  if (!account.customer_id) return account;
  const subscriptions = await stripe(
    `subscriptions?customer=${encodeURIComponent(account.customer_id)}&status=all&limit=100&expand[]=data.latest_invoice`,
  );
  assert(
    !subscriptions.has_more,
    503,
    "Your subscription needs an administrator review.",
  );
  const candidates = subscriptions.data.filter(
    (s: Row) =>
      s.metadata?.restaurant_id === account.restaurant_id &&
      s.items?.data?.length === 1 &&
      s.items.data[0].quantity === 1 &&
      proPrice(s.items.data[0].price),
  );
  candidates.sort(
    (a: Row, b: Row) =>
      Number(!["canceled", "incomplete_expired"].includes(b.status)) -
        Number(!["canceled", "incomplete_expired"].includes(a.status)) ||
      b.created - a.created,
  );
  const sub = candidates[0];
  if (!sub) return account;
  const item = sub.items.data[0],
    invoice = sub.latest_invoice;
  const line = invoice?.lines?.data?.find(
    (l: Row) =>
      (externalId(l.pricing?.price_details?.price) || externalId(l.price)) ===
        config("STRIPE_PRO_PRICE_ID") &&
      l.period?.start === item.current_period_start &&
      l.period?.end === item.current_period_end,
  );
  const paid =
    ["active", "past_due"].includes(sub.status) &&
    invoice?.status === "paid" &&
    invoice.amount_paid >= PRO_PLAN.amountCents &&
    ["subscription_create", "subscription_cycle"].includes(
      invoice.billing_reason,
    ) &&
    externalId(invoice.customer) === account.customer_id &&
    line &&
    Number.isSafeInteger(item.current_period_start) &&
    Number.isSafeInteger(item.current_period_end) &&
    item.current_period_end > item.current_period_start;
  const statements = [
    db()
      .prepare(
        "UPDATE billing_accounts SET subscription_id=?,status=?,cancel_at_period_end=?,synced_at=? WHERE restaurant_id=? AND lease_token=?",
      )
      .bind(
        sub.id,
        sub.status,
        sub.cancel_at_period_end ? 1 : 0,
        now(),
        account.restaurant_id,
        lease,
      ),
  ];
  if (paid)
    statements.push(
      db()
        .prepare(
          `INSERT OR IGNORE INTO billing_periods (id,restaurant_id,subscription_id,invoice_id,starts_at,ends_at,allowance)
    SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM billing_accounts WHERE restaurant_id=? AND lease_token=?)`,
        )
        .bind(
          sub.id + ":" + item.current_period_start,
          account.restaurant_id,
          sub.id,
          invoice.id,
          item.current_period_start * 1000,
          item.current_period_end * 1000,
          PRO_PLAN.imagesPerPeriod,
          account.restaurant_id,
          lease,
        ),
    );
  await db().batch(statements);
  return { ...account, subscription_id: sub.id, status: sub.status };
}
async function webhook(req: Request) {
  assert(req.method === "POST", 405, "Method not allowed.");
  assert(billingEnabled(), 503, "Billing is not active.");
  const raw = await limitedBytes(req, 1024 * 1024);
  const values = (req.headers.get("stripe-signature") || "").split(",");
  const timestamp = values.find((v) => v.startsWith("t="))?.slice(2) || "";
  const signatures = values
    .filter((v) => v.startsWith("v1="))
    .map((v) => v.slice(3));
  assert(
    /^\d+$/.test(timestamp) &&
      Math.abs(now() / 1000 - Number(timestamp)) <= 300,
    400,
    "Invalid billing signature.",
  );
  const expected = createHmac("sha256", config("STRIPE_WEBHOOK_SECRET"))
    .update(timestamp + ".")
    .update(raw)
    .digest();
  assert(
    signatures.some(
      (s) =>
        /^[a-f0-9]{64}$/.test(s) &&
        timingSafeEqual(expected, Buffer.from(s, "hex")),
    ),
    400,
    "Invalid billing signature.",
  );
  let event: Row;
  try {
    event = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return response({ error: "Invalid notification." }, 400);
  }
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "invoice.paid",
      "invoice.payment_failed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)
  )
    return response({ received: true });
  const customerId = externalId(event.data?.object?.customer);
  if (customerId) {
    const account = await one(
      "SELECT * FROM billing_accounts WHERE customer_id=?",
      customerId,
    );
    if (account) await withAccount(account.restaurant_id, reconcile);
  }
  return response({ received: true });
}
export async function billingRoute(req: Request, path: string[]) {
  if (path[1] === "webhook") return webhook(req);
  const { u, r } = await owner(req);
  if (path[1] === "status" && req.method === "GET")
    return response(await billingSummary(r.id));
  assert(req.method === "POST", 405, "Method not allowed.");
  assert(
    billingEnabled(),
    503,
    "Pro subscriptions are coming soon. Your free account is ready to use.",
  );
  await limit("billing:" + r.id, 20, 900);
  if (path[1] === "sync") {
    await withAccount(r.id, reconcile);
    return response(await billingSummary(r.id));
  }
  if (path[1] === "portal") {
    const account = await one(
      "SELECT customer_id FROM billing_accounts WHERE restaurant_id=?",
      r.id,
    );
    assert(account?.customer_id, 400, "No billing account yet.");
    const session = await stripe("billing_portal/sessions", {
      customer: account.customer_id,
      return_url: origin() + "/?billing=return#studio",
    });
    return response({ url: session.url });
  }
  assert(path[1] === "checkout", 404, "Not found.");
  return withAccount(r.id, async (account, lease) => {
    const price = await stripe(
      "prices/" + encodeURIComponent(config("STRIPE_PRO_PRICE_ID")),
    );
    assert(
      price.active && proPrice(price),
      503,
      "Pro subscriptions are not ready yet.",
    );
    if (!account.customer_id) {
      const customer = await stripe(
        "customers",
        { email: u.email, "metadata[restaurant_id]": r.id },
        "menu-material-customer-" + r.id,
      );
      await run(
        "UPDATE billing_accounts SET customer_id=? WHERE restaurant_id=? AND lease_token=?",
        customer.id,
        r.id,
        lease,
      );
      account.customer_id = customer.id;
    }
    account = await reconcile(account, lease);
    assert(
      !account.subscription_id ||
        ["canceled", "incomplete_expired", "free"].includes(account.status),
      409,
      "You already have a subscription. Use Manage billing to review it.",
    );
    if (account.checkout_id) {
      const previous = await stripe(
        "checkout/sessions/" + encodeURIComponent(account.checkout_id),
      );
      if (previous.status === "open") return response({ url: previous.url });
      assert(
        previous.status === "expired" ||
          (previous.status === "complete" &&
            ["canceled", "incomplete_expired"].includes(account.status)),
        409,
        "Your checkout is being confirmed. Refresh your plan in a moment.",
      );
      await run(
        "UPDATE billing_accounts SET checkout_id=NULL,checkout_key=NULL WHERE restaurant_id=? AND lease_token=?",
        r.id,
        lease,
      );
      account.checkout_key = null;
    }
    const checkoutKey = account.checkout_key || id();
    await run(
      "UPDATE billing_accounts SET checkout_key=? WHERE restaurant_id=? AND lease_token=?",
      checkoutKey,
      r.id,
      lease,
    );
    const session = await stripe(
      "checkout/sessions",
      {
        mode: "subscription",
        customer: account.customer_id,
        client_reference_id: r.id,
        "line_items[0][price]": config("STRIPE_PRO_PRICE_ID"),
        "line_items[0][quantity]": "1",
        "payment_method_types[0]": "card",
        "subscription_data[metadata][restaurant_id]": r.id,
        "metadata[restaurant_id]": r.id,
        success_url: origin() + "/?billing=success#studio",
        cancel_url: origin() + "/?billing=cancel#studio",
      },
      "menu-material-checkout-" + checkoutKey,
    );
    await run(
      "UPDATE billing_accounts SET checkout_id=? WHERE restaurant_id=? AND lease_token=?",
      session.id,
      r.id,
      lease,
    );
    return response({ url: session.url });
  });
}
