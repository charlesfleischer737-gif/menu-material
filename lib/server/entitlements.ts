import { AppError, config, now, one, type Row } from "./core";
import { defaultStyle } from "../promotions";
import { proFeatures, type ProFeature } from "../plans";

/**
 * Whether the subscription behind billing period `bp` is live: Stripe's
 * (billing_accounts) or the App Store's (app_store_subscriptions, whose
 * periods' subscription_id is its id). Both write the same period ledger.
 */
export const liveSubscriptionSql = (
  bp: string,
  statuses = "'active','past_due'",
) =>
  `(EXISTS(SELECT 1 FROM billing_accounts ba WHERE ba.restaurant_id=${bp}.restaurant_id AND ba.subscription_id=${bp}.subscription_id AND ba.status IN (${statuses}))
    OR EXISTS(SELECT 1 FROM app_store_subscriptions s WHERE s.restaurant_id=${bp}.restaurant_id AND s.id=${bp}.subscription_id AND s.status IN (${statuses})))`;

// Used by both the displayed balance and the atomic job reservation. Credits
// belong to their original period, even when a failed job finishes next month.
// restaurants.allowance (set in Administration as "Free-plan images") only
// applies without a paid period; Pro uses its billing period's allowance.
export const entitlementSql = `SELECT r.id,r.paused,
  COALESCE(p.id,'free') AS credit_period,
  COALESCE(p.allowance,r.allowance)+(SELECT count(*) FROM photo_corrections c WHERE c.restaurant_id=r.id AND c.credited_period=COALESCE(p.id,'free') AND c.credited_at IS NOT NULL) AS allowance,
  p.ends_at AS renews_at
  FROM restaurants r LEFT JOIN billing_periods p ON p.id=(
    SELECT bp.id FROM billing_periods bp
    WHERE bp.restaurant_id=r.id AND ${liveSubscriptionSql("bp")}
      AND bp.starts_at<=? AND bp.ends_at>?
    ORDER BY bp.starts_at DESC LIMIT 1
  ) WHERE r.id=?`;

export async function imageEntitlement(restaurantId: string) {
  const t = now();
  const row = await one(
    `SELECT e.*,
    MAX(0,e.allowance-(SELECT count(*) FROM outputs o WHERE o.restaurant_id=e.id
      AND o.credit_period=e.credit_period AND o.status!='failed')) AS remaining
    FROM (${entitlementSql}) e`,
    t,
    t,
    restaurantId,
  );
  return {
    plan: row?.credit_period === "free" ? "free" : "pro",
    allowance: Number(row?.allowance || 0),
    remaining: Number(row?.remaining || 0),
    renewsAt: row?.renews_at || null,
  };
}

/** Every Free limit follows this switch. PLAN_LIMITS_ENABLED=false lifts them all. */
export function planLimitsEnabled() {
  return config("PLAN_LIMITS_ENABLED") !== "false";
}

// While Stripe retries a failed renewal, Pro features (never new images) stay.
export const RENEWAL_GRACE_MS = 14 * 86400000;

/**
 * Pro features, which are separate from images: a paid period covering now,
 * a renewal on its way (Stripe starts the new period about an hour before it
 * charges the invoice, and a failed charge is retried), or an administrator's
 * comp.
 */
export async function featureAccess(restaurantId: string) {
  const t = now();
  const row = await one(
    `SELECT r.pro_until,
    EXISTS(SELECT 1 FROM billing_periods bp
      WHERE bp.restaurant_id=r.id AND ${liveSubscriptionSql("bp")}
        AND bp.starts_at<=? AND bp.ends_at>?) AS paid,
    (SELECT status FROM (
      SELECT ba.status FROM billing_periods bp JOIN billing_accounts ba
        ON ba.restaurant_id=bp.restaurant_id AND ba.subscription_id=bp.subscription_id
        WHERE bp.restaurant_id=r.id AND ba.status IN ('active','past_due')
          AND bp.ends_at<=? AND bp.ends_at>?
      UNION ALL
      SELECT s.status FROM billing_periods bp JOIN app_store_subscriptions s
        ON s.restaurant_id=bp.restaurant_id AND s.id=bp.subscription_id
        WHERE bp.restaurant_id=r.id AND s.status IN ('active','past_due')
          AND bp.ends_at<=? AND bp.ends_at>?
    ) LIMIT 1) AS renewal
    FROM restaurants r WHERE r.id=?`,
    t,
    t,
    t,
    t - RENEWAL_GRACE_MS,
    t,
    t - RENEWAL_GRACE_MS,
    restaurantId,
  );
  const proUntil = row?.pro_until == null ? null : Number(row.pro_until);
  const source: "paid" | "renewing" | "grace" | "comp" | "free" = row?.paid
    ? "paid"
    : row?.renewal === "past_due"
      ? "grace"
      : row?.renewal === "active"
        ? "renewing"
        : proUntil && proUntil > t
          ? "comp"
          : "free";
  const limitsEnabled = planLimitsEnabled();
  return {
    pro: source !== "free",
    source,
    proUntil,
    limitsEnabled,
    // Whether Pro features can be used: always, while limits are switched off.
    unlocked: !limitsEnabled || source !== "free",
  };
}

export async function hasProFeatures(restaurantId: string) {
  return (await featureAccess(restaurantId)).unlocked;
}

export function proRequired(feature: ProFeature): never {
  throw new AppError(
    402,
    proFeatures[feature].blocked,
    "pro_required",
    feature,
  );
}

export async function requirePro(restaurantId: string, feature: ProFeature) {
  if (!(await hasProFeatures(restaurantId))) proRequired(feature);
}

/** The saved look as stored, whatever the plan. */
export function parseSavedStyle(raw: unknown): Row {
  if (raw && typeof raw === "object") return raw as Row;
  try {
    const parsed = JSON.parse(String(raw || "{}"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The restaurant look new work uses: the saved look with Pro features, and
 * neutral defaults on Free. The saved look is kept either way.
 */
export function styleForPlan(saved: Row, unlocked: boolean) {
  return unlocked ? saved : { ...defaultStyle };
}

export async function effectiveStyle(r: Row) {
  return styleForPlan(parseSavedStyle(r.style), await hasProFeatures(r.id));
}
