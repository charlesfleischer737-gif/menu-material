import { decodeJwt, importPKCS8, SignJWT } from "jose";
import { z } from "zod";
import {
  all,
  AppError,
  assert,
  body,
  config,
  db,
  now,
  one,
  response,
  run,
  type Row,
} from "./core";
import { appleBundleId, pemKey } from "./apple-auth";
import { publicLimit } from "./safeguards";
import { PRO_PLAN } from "../plans";

// Pro bought in the iPhone app, through the App Store. The app buys with
// StoreKit, naming the restaurant as the purchase's appAccountToken, then
// sends the transaction ID here. Apple's notifications name transactions
// too. Either way the server asks the App Store Server API, over TLS with its
// own key, what the subscription is now, and records that. A request or
// notification that names a transaction can't change what Apple says about it,
// so neither needs to be trusted itself.

export function appStoreProductId() {
  return (
    config("APP_STORE_PRO_PRODUCT_ID").trim() ||
    "com.menumaterial.app.pro.monthly"
  );
}
export function appStoreBillingEnabled() {
  return !!(
    appleBundleId() &&
    config("APP_STORE_ISSUER_ID").trim() &&
    config("APP_STORE_KEY_ID").trim() &&
    config("APP_STORE_PRIVATE_KEY").trim()
  );
}
// App Review and TestFlight buy in the sandbox against the production server,
// so the sandbox is asked when production doesn't know a transaction.
const sandboxAllowed = () => config("APP_STORE_ALLOW_SANDBOX") !== "false";
const hosts = {
  Production: "https://api.storekit.itunes.apple.com",
  Sandbox: "https://api.storekit-sandbox.itunes.apple.com",
} as const;
type Environment = keyof typeof hosts;
const unavailable =
  "The App Store is temporarily unavailable. Please try again; your purchase is safe with Apple.";

async function apiToken() {
  const key = await importPKCS8(
    pemKey(config("APP_STORE_PRIVATE_KEY")),
    "ES256",
  );
  return new SignJWT({ bid: appleBundleId() })
    .setProtectedHeader({
      alg: "ES256",
      kid: config("APP_STORE_KEY_ID").trim(),
      typ: "JWT",
    })
    .setIssuer(config("APP_STORE_ISSUER_ID").trim())
    .setAudience("appstoreconnect-v1")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);
}
async function storeApi(path: string) {
  const environments: Environment[] = sandboxAllowed()
    ? ["Production", "Sandbox"]
    : ["Production"];
  for (const environment of environments) {
    let res: Response;
    try {
      res = await fetch(hosts[environment] + path, {
        headers: { Authorization: "Bearer " + (await apiToken()) },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new AppError(503, unavailable);
    }
    // A transaction from the other environment is "not found" here.
    if (res.status === 404) continue;
    assert(res.ok, 503, unavailable);
    return { data: (await res.json()) as Row, environment };
  }
  return null;
}
// Payloads Apple signed, read after fetching them from Apple over TLS.
function decoded(jws: unknown): Row {
  try {
    return typeof jws === "string" ? (decodeJwt(jws) as Row) : {};
  } catch {
    return {};
  }
}
// Apple's subscription statuses. Billing retry and the grace period both read
// as past_due, which keeps Pro features (never new images) for a while, as a
// failed Stripe renewal does.
const statusNames: Record<number, string> = {
  1: "active",
  2: "expired",
  3: "past_due",
  4: "past_due",
  5: "revoked",
};
/** The Pro subscription as Apple has it now, from any of its transactions. */
async function appleSubscription(transactionId: string) {
  const found = await storeApi(
    `/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`,
  );
  if (!found || found.data.bundleId !== appleBundleId()) return null;
  for (const group of found.data.data || [])
    for (const last of group.lastTransactions || []) {
      const transaction = decoded(last.signedTransactionInfo);
      if (
        transaction.productId !== appStoreProductId() ||
        transaction.bundleId !== appleBundleId() ||
        typeof transaction.originalTransactionId !== "string"
      )
        continue;
      return {
        environment: found.environment,
        status: statusNames[Number(last.status)] || "expired",
        transaction,
        renewal: decoded(last.signedRenewalInfo),
      };
    }
  return null;
}
// A paid month is a purchase or renewal the buyer paid for and still has. A
// free trial or a refunded month grants no images, as with Stripe.
function paidPeriod(tx: Row) {
  return (
    tx.type === "Auto-Renewable Subscription" &&
    tx.inAppOwnershipType === "PURCHASED" &&
    !tx.revocationDate &&
    Number.isSafeInteger(tx.purchaseDate) &&
    Number.isSafeInteger(tx.expiresDate) &&
    tx.expiresDate > tx.purchaseDate &&
    (typeof tx.price === "number"
      ? tx.price > 0
      : tx.offerDiscountType !== "FREE_TRIAL")
  );
}
const subscriptionId = (tx: Row) => "apple:" + tx.originalTransactionId;

/**
 * Asks Apple about a transaction and records its subscription for the
 * restaurant its appAccountToken names (or that already holds it). With a
 * `claimant`, only that restaurant may hold it. Returns the restaurant, or
 * null when Apple doesn't know the transaction or nobody holds it.
 */
export async function syncAppStoreTransaction(
  transactionId: string,
  claimant?: string,
) {
  assert(
    /^\d{1,30}$/.test(transactionId),
    400,
    "That purchase couldn't be found.",
  );
  const sub = await appleSubscription(transactionId);
  if (!sub) return null;
  const tx = sub.transaction,
    id = subscriptionId(tx);
  // Swift writes UUIDs in capitals; restaurant IDs are lowercase.
  const token =
    typeof tx.appAccountToken === "string"
      ? tx.appAccountToken.toLowerCase()
      : "";
  const named = token
    ? await one("SELECT id FROM restaurants WHERE id=?", token)
    : null;
  const known = await one(
    "SELECT s.restaurant_id FROM app_store_subscriptions s JOIN restaurants r ON r.id=s.restaurant_id WHERE s.id=?",
    id,
  );
  // The newest purchase decides: someone who subscribes again while signed in
  // to another restaurant moves the subscription there.
  const holder: string | undefined = named?.id || known?.restaurant_id;
  if (claimant)
    assert(
      holder === claimant,
      409,
      "This App Store subscription belongs to another Menu Material account. Sign in to that account, or contact support.",
    );
  if (!holder) return null;
  const t = now();
  const statements = [
    db()
      .prepare(
        `INSERT INTO app_store_subscriptions (id,restaurant_id,original_transaction_id,product_id,environment,status,auto_renew,expires_at,synced_at,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET restaurant_id=excluded.restaurant_id,product_id=excluded.product_id,
          environment=excluded.environment,status=excluded.status,auto_renew=excluded.auto_renew,
          expires_at=excluded.expires_at,synced_at=excluded.synced_at`,
      )
      .bind(
        id,
        holder,
        tx.originalTransactionId,
        tx.productId,
        sub.environment,
        sub.status,
        sub.renewal.autoRenewStatus === 0 ? 0 : 1,
        Number.isSafeInteger(tx.expiresDate) ? tx.expiresDate : null,
        t,
        t,
      ),
  ];
  // Each paid transaction is one period; its ID can't be granted twice. A
  // renewal date Apple extends (as support can) lengthens the same month.
  if (paidPeriod(tx))
    statements.push(
      db()
        .prepare(
          "INSERT OR IGNORE INTO billing_periods (id,restaurant_id,subscription_id,invoice_id,starts_at,ends_at,allowance) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(
          `${id}:${tx.purchaseDate}`,
          holder,
          id,
          "apple:" + tx.transactionId,
          tx.purchaseDate,
          tx.expiresDate,
          PRO_PLAN.imagesPerPeriod,
        ),
      db()
        .prepare(
          "UPDATE billing_periods SET ends_at=? WHERE invoice_id=? AND ends_at<?",
        )
        .bind(tx.expiresDate, "apple:" + tx.transactionId, tx.expiresDate),
    );
  // A refunded month ends when Apple took it back.
  if (Number.isSafeInteger(tx.revocationDate))
    statements.push(
      db()
        .prepare(
          "UPDATE billing_periods SET ends_at=MIN(ends_at,?) WHERE invoice_id=?",
        )
        .bind(tx.revocationDate, "apple:" + tx.transactionId),
    );
  await db().batch(statements);
  return { restaurantId: holder, status: sub.status };
}

/** A subscription bought in the app that is paid for, or being retried. */
export async function liveAppStoreSubscription(restaurantId: string) {
  return one(
    "SELECT * FROM app_store_subscriptions WHERE restaurant_id=? AND status IN ('active','past_due') ORDER BY expires_at DESC LIMIT 1",
    restaurantId,
  );
}

export const appStoreStillRenewing =
  "Your Pro plan renews through the App Store. On your iPhone, open Settings, tap your name, then Subscriptions, and cancel Menu Material Pro. You can delete your account once it no longer renews.";

/**
 * Before an account is deleted. Only Apple can cancel an App Store
 * subscription, so one that still renews must be turned off first; Apple is
 * asked again in case the owner just did. A paid month that won't renew
 * doesn't hold the account back.
 */
export async function closeAppStoreBilling(restaurantId: string) {
  let live = await liveAppStoreSubscription(restaurantId);
  if (!live?.auto_renew) return;
  if (appStoreBillingEnabled()) {
    try {
      await syncAppStoreTransaction(live.original_transaction_id);
    } catch (e) {
      if (e instanceof AppError && e.status === 503)
        throw new AppError(
          503,
          "The App Store is temporarily unavailable, so your account wasn’t deleted. Please try again.",
        );
      throw e;
    }
    live = await liveAppStoreSubscription(restaurantId);
  }
  assert(!live?.auto_renew, 409, appStoreStillRenewing);
}

// As with Stripe, notifications are the quick route and this is the net under
// them: a live subscription whose month has ended, or ends within minutes, is
// checked every 10 minutes at first, then less often, for up to 60 days.
const recheckSoonMs = 10 * 60000,
  recheckLatestMs = 6 * 3600000,
  recheckForMs = 60 * 86400000;
export async function reconcileDueAppStoreSubscriptions(batch = 5) {
  if (!appStoreBillingEnabled()) return { checked: 0, failed: 0, error: null };
  const t = now();
  const due = await all(
    `SELECT original_transaction_id FROM app_store_subscriptions
    WHERE status IN ('active','past_due') AND COALESCE(expires_at,0)<? AND COALESCE(expires_at,0)>?
      AND synced_at<?-MIN(?,MAX(?,(?-COALESCE(expires_at,0))/4))
    ORDER BY synced_at LIMIT ?`,
    t + recheckSoonMs,
    t - recheckForMs,
    t,
    recheckLatestMs,
    recheckSoonMs,
    t,
    batch,
  );
  let failed = 0,
    error: unknown = null;
  for (const { original_transaction_id } of due) {
    try {
      await syncAppStoreTransaction(original_transaction_id);
    } catch (e) {
      failed++;
      error ??= e;
    }
    // Checked, even if Apple didn't answer, so one failure doesn't hold up
    // the others.
    await run(
      "UPDATE app_store_subscriptions SET synced_at=MAX(synced_at,?) WHERE original_transaction_id=?",
      t,
      original_transaction_id,
    );
  }
  return { checked: due.length, failed, error };
}

/**
 * App Store Server Notifications V2, at /api/billing/app-store/notifications.
 * The transaction a notification names is fetched from Apple again before
 * anything is recorded.
 */
export async function appStoreNotification(req: Request) {
  assert(req.method === "POST", 405, "Method not allowed.");
  assert(appStoreBillingEnabled(), 503, "App Store billing is not active.");
  await publicLimit(req, "app-store-notification", 1000, 3600);
  const input = z
    .object({ signedPayload: z.string().min(1).max(90000) })
    .parse(await body(req));
  const payload = decoded(input.signedPayload);
  const data: Row = payload.data || {};
  if (data.bundleId !== appleBundleId()) return response({ received: true });
  // For the setup guide: proof the notification address is right.
  await run(
    "INSERT INTO app_settings (key,value) VALUES ('app-store-notification-last',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    String(now()),
  );
  const tx = decoded(data.signedTransactionInfo);
  if (
    typeof tx.transactionId === "string" &&
    /^\d{1,30}$/.test(tx.transactionId)
  )
    await syncAppStoreTransaction(tx.transactionId);
  return response({ received: true });
}

/** For the app's Plans screen. */
export async function appStoreState(restaurantId: string) {
  const live = await liveAppStoreSubscription(restaurantId);
  const stripe = await one(
    "SELECT 1 AS live FROM billing_accounts WHERE restaurant_id=? AND subscription_id IS NOT NULL AND status NOT IN ('free','canceled','incomplete_expired')",
    restaurantId,
  );
  return {
    enabled: appStoreBillingEnabled(),
    productId: appStoreProductId(),
    // StoreKit's appAccountToken ties each purchase to this restaurant.
    appAccountToken: restaurantId,
    canPurchase: appStoreBillingEnabled() && !live && !stripe,
    blockedReason: stripe
      ? "Your Pro plan is billed on menumaterial.com. Manage it there, under Plans."
      : null,
    subscription: live
      ? {
          status: live.status,
          autoRenew: !!live.auto_renew,
          expiresAt: live.expires_at,
          environment: live.environment,
        }
      : null,
  };
}
