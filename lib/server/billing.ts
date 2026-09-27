import { createHmac, timingSafeEqual } from "node:crypto";
import {
  AppError,
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
import { featureAccess, imageEntitlement } from "./entitlements";
import { PRO_PLAN, PRO_PRICE_LABEL } from "../plans";
import { siteContact } from "../site-contact";

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
  const live = await one(
    "SELECT count(*) AS n FROM menu_documents WHERE restaurant_id=? AND archived_at IS NULL AND published IS NOT NULL",
    restaurantId,
  );
  return {
    ...(await imageEntitlement(restaurantId)),
    enabled: billingEnabled(),
    status: account?.status || "free",
    cancelAtPeriodEnd: !!account?.cancel_at_period_end,
    canManage: !!account?.customer_id && billingEnabled(),
    // So controls can show what's Pro before anyone starts.
    features: {
      ...(await featureAccess(restaurantId)),
      usage: { liveMenus: Number(live?.n || 0) },
    },
  };
}
async function stripe(
  path: string,
  fields?: Record<string, string>,
  key?: string,
  // `gone`: a customer Stripe can't find (deleted in the dashboard, or by an
  // interrupted account deletion) reads as deleted rather than an outage.
  { method = fields ? "POST" : "GET", gone = false } = {},
): Promise<Row> {
  assert(
    billingEnabled(),
    503,
    "Pro subscriptions are coming soon. Your free account is ready to use.",
  );
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method,
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
  if (gone && res.status === 404) return { deleted: true };
  assert(
    res.ok,
    503,
    "Billing is temporarily unavailable. Please try again; your plan has not been changed here.",
  );
  return res.json();
}
// A subscription that can still charge, or that is still paid for. Ended
// ones allow a new checkout and account deletion.
const liveSubscription = (account: Row) =>
  !!account.subscription_id &&
  !["canceled", "incomplete_expired", "free"].includes(account.status);
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
  return {
    ...account,
    subscription_id: sub.id,
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0,
  };
}
// Under Checkout's pay button, as beside Get Pro: how Pro renews and how to
// cancel, with the owner's Terms and refund policy once they are set. Stripe
// shows Markdown links. Requiring Terms consent (consent_collection) also
// needs the Terms URL in Stripe's own settings, so that is the owner's step.
function checkoutTerms() {
  const { termsUrl, refundPolicyUrl } = siteContact(config);
  const link = (label: string, url: string) =>
    `[${label}](${url.replace(/\(/g, "%28").replace(/\)/g, "%29")})`;
  return [
    `Pro is ${PRO_PRICE_LABEL} a month and renews monthly until you cancel. Cancel anytime in Menu Material, in Plans under Manage billing; Pro stays until the end of the month you’ve paid for.`,
    termsUrl && link("Terms", termsUrl),
    refundPolicyUrl && link("Refund policy", refundPolicyUrl),
  ]
    .filter(Boolean)
    .join(" ");
}
function stillSubscribed(account: Row) {
  const { supportEmail } = siteContact(config);
  return (
    (account.cancel_at_period_end
      ? "Your Pro plan is cancelled and ends at the end of the month you’ve paid for. You can delete your account after that."
      : billingEnabled()
        ? "Your Pro subscription is still active. Cancel it in Plans, under Manage billing; you can delete your account once Pro has ended."
        : // Manage billing is off without the billing settings.
          "Your Pro subscription is still active, so your account can’t be deleted yet.") +
    (supportEmail ? ` Questions? Email ${supportEmail}.` : "")
  );
}
/**
 * Before an account is deleted. A live subscription must be cancelled first.
 * Otherwise an open checkout is expired and the Stripe customer deleted, so
 * Stripe keeps its invoices but no longer holds the owner's email. Nothing
 * local changes here: the caller deletes the billing rows with the account.
 * Without billing settings, the last known subscription state decides and
 * Stripe isn't contacted.
 */
export async function closeBilling(restaurantId: string) {
  const known = await one(
    "SELECT * FROM billing_accounts WHERE restaurant_id=?",
    restaurantId,
  );
  if (!known) return;
  if (!known.customer_id || !billingEnabled()) {
    assert(!liveSubscription(known), 409, stillSubscribed(known));
    return;
  }
  try {
    await withAccount(restaurantId, async (account, lease) => {
      const customer = "customers/" + encodeURIComponent(account.customer_id);
      const found = await stripe(customer, undefined, undefined, {
        gone: true,
      });
      // Deleted already, and its subscriptions ended with it.
      if (found.deleted) return;
      account = await reconcile(account, lease);
      assert(!liveSubscription(account), 409, stillSubscribed(account));
      // An open checkout tab could otherwise still start a subscription.
      if (account.checkout_id) {
        const session =
          "checkout/sessions/" + encodeURIComponent(account.checkout_id);
        if ((await stripe(session)).status === "open")
          await stripe(session + "/expire", {});
      }
      await stripe(customer, undefined, undefined, {
        method: "DELETE",
        gone: true,
      });
    });
  } catch (e) {
    if (e instanceof AppError && e.status === 503)
      throw new AppError(
        503,
        "Billing is temporarily unavailable, so your account wasn’t deleted. Please try again.",
      );
    throw e;
  }
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
      !liveSubscription(account),
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
        "custom_text[submit][message]": checkoutTerms(),
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
