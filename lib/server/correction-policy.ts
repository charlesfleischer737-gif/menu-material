import { event, now, one, run, type Row } from "./core";

// Restored allowance is spendable in the period in which recovery is granted.
// This is an image allowance adjustment, never a payment-card refund.
export async function restoreCorrectionCredit(
  originalJobId: string,
  manual = false,
  resolution = "",
) {
  const t = now();
  const changed = await one(
    `UPDATE photo_corrections SET
    credited_period=COALESCE((SELECT bp.id FROM billing_periods bp JOIN billing_accounts ba
      ON ba.restaurant_id=bp.restaurant_id AND ba.subscription_id=bp.subscription_id
      WHERE bp.restaurant_id=photo_corrections.restaurant_id AND ba.status IN ('active','past_due')
        AND bp.starts_at<=? AND bp.ends_at>? ORDER BY bp.starts_at DESC LIMIT 1),'free'),
    credited_at=?,status='credited',updated_at=?,resolution=?
    WHERE original_job_id=? AND credited_at IS NULL
      AND EXISTS(SELECT 1 FROM outputs o WHERE o.job_id=original_job_id AND o.status='completed' AND o.credit_period NOT LIKE 'complimentary:%')
      AND (?=1 OR (SELECT count(*) FROM photo_corrections c WHERE c.restaurant_id=photo_corrections.restaurant_id AND c.credited_at>?)<3)
    RETURNING *`,
    t,
    t,
    t,
    t,
    resolution,
    originalJobId,
    manual ? 1 : 0,
    t - 30 * 86400000,
  );
  if (changed)
    await event(changed.restaurant_id, "photo_credit_restored", originalJobId, {
      manual,
      period: changed.credited_period,
    });
  return holdForReview(originalJobId);
}

/** Leave an unrestored report for the team to review. */
export async function holdForReview(originalJobId: string) {
  await run(
    "UPDATE photo_corrections SET status='review',updated_at=? WHERE original_job_id=? AND credited_at IS NULL",
    now(),
    originalJobId,
  );
  return one(
    "SELECT * FROM photo_corrections WHERE original_job_id=?",
    originalJobId,
  );
}

export async function settleCorrection(jobId: string) {
  const row = await one(
    "SELECT c.*,j.status AS job_status FROM photo_corrections c JOIN jobs j ON j.id=c.correction_job_id WHERE c.correction_job_id=?",
    jobId,
  );
  if (!row || row.credited_at || ["review", "resolved"].includes(row.status))
    return;
  if (row.job_status === "failed") {
    // Only the service failing gives an image back, not a cancellation.
    const cancelled = await one(
      "SELECT 1 AS found FROM outputs WHERE job_id=? AND error LIKE 'Cancelled before creation%' LIMIT 1",
      jobId,
    );
    if (cancelled) await holdForReview(row.original_job_id);
    else await restoreCorrectionCredit(row.original_job_id);
  } else if (row.job_status === "completed")
    await run(
      "UPDATE photo_corrections SET status='ready',updated_at=? WHERE original_job_id=? AND status IN ('reported','queued')",
      now(),
      row.original_job_id,
    );
}

export async function originalPhotoJob(restaurantId: string, assetId: string) {
  // Quick adjustments can be nested; only follow this restaurant's lineage.
  return one(
    `WITH RECURSIVE lineage(id,depth) AS (
    SELECT id,0 FROM assets WHERE id=? AND restaurant_id=? AND deleted_at IS NULL
    UNION ALL SELECT e.parent_id,l.depth+1 FROM asset_edits e JOIN lineage l ON e.asset_id=l.id
      JOIN assets a ON a.id=e.parent_id WHERE a.restaurant_id=? AND l.depth<20
    ) SELECT j.* FROM lineage l JOIN outputs o ON o.asset_id=l.id JOIN jobs j ON j.id=o.job_id
      WHERE j.restaurant_id=? ORDER BY l.depth LIMIT 1`,
    assetId,
    restaurantId,
    restaurantId,
    restaurantId,
  );
}

export function correctionView(row: Row, resultId?: string) {
  const messages: Record<string, string> = {
    reported:
      "One food correction is included. It uses your original photo and costs no additional images.",
    queued:
      "Your complimentary correction is being created. Your earlier version is still in history.",
    ready:
      "Your correction is ready to review. If the food is still inaccurate, report it here.",
    credited:
      "1 image has been given back. The correction did not use an image.",
    review:
      "Your report is saved for review by our team. You have not been charged for another image.",
    resolved: row.resolution || "Your report has been reviewed.",
  };
  return {
    originalJobId: row.original_job_id,
    status: row.status,
    jobId: row.correction_job_id,
    resultId: resultId || null,
    message: messages[row.status] || messages.review,
    resolution: row.resolution,
    policy:
      "One complimentary correction per original image request. If it can’t be made, we restore 1 image. If it’s still inaccurate, Pro restores 1 image automatically, up to 3 times per restaurant in 30 days; other reports receive team review.",
  };
}
