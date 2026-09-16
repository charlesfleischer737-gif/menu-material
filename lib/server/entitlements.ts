import { now, one } from "./core";

// Used by both the displayed balance and the atomic job reservation. Credits
// belong to their original period, even when a failed job finishes next month.
export const entitlementSql = `SELECT r.id,r.paused,
  COALESCE(p.id,'free') AS credit_period,
  COALESCE(p.allowance,r.allowance) AS allowance,
  p.ends_at AS renews_at
  FROM restaurants r LEFT JOIN billing_periods p ON p.id=(
    SELECT bp.id FROM billing_periods bp JOIN billing_accounts ba
      ON ba.restaurant_id=bp.restaurant_id AND ba.subscription_id=bp.subscription_id
    WHERE bp.restaurant_id=r.id AND ba.status IN ('active','past_due')
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
