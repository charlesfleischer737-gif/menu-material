import { z } from "zod";
import {
  assert,
  body,
  db,
  event,
  now,
  one,
  response,
  run,
  type Row,
} from "./core";
import { enqueue } from "./generation";
import {
  correctionView,
  originalPhotoJob,
  restoreCorrectionCredit,
  settleCorrection,
} from "./correction-policy";

export async function photoCorrectionsRoute(req: Request, p: string[], r: Row) {
  if (p[0] !== "photo-corrections") return null;
  const assetId = z.string().uuid().parse(p[1]);
  const asset = await one(
    "SELECT * FROM assets WHERE id=? AND restaurant_id=? AND deleted_at IS NULL",
    assetId,
    r.id,
  );
  assert(asset, 404, "Photo not found.");
  const job = await originalPhotoJob(r.id, assetId);
  if (!job)
    return response({
      status: "unavailable",
      canReport: false,
      message:
        "This version has no AI-generated photo to correct. Your original photo and saved adjustments are still available.",
    });
  const parentCorrection = await one(
    "SELECT * FROM photo_corrections WHERE correction_job_id=? AND restaurant_id=?",
    job.id,
    r.id,
  );
  const rootId = parentCorrection?.original_job_id || job.id;
  let row =
    parentCorrection ||
    (await one(
      "SELECT * FROM photo_corrections WHERE original_job_id=? AND restaurant_id=?",
      rootId,
      r.id,
    ));
  const original = await one(
    "SELECT * FROM jobs WHERE id=? AND restaurant_id=?",
    rootId,
    r.id,
  );
  const source =
    original?.source_id &&
    (await one(
      "SELECT id FROM assets WHERE id=? AND restaurant_id=? AND kind IN ('source','staff') AND deleted_at IS NULL",
      original.source_id,
      r.id,
    ));
  const charged = await one(
    "SELECT id FROM outputs WHERE job_id=? AND status='completed' AND credit_period NOT LIKE 'complimentary:%'",
    rootId,
  );
  if (req.method === "GET") {
    if (!row)
      return response({
        status: source && charged ? "eligible" : "unavailable",
        message:
          source && charged
            ? "A food correction is complimentary and uses your untouched original photo."
            : "We can’t offer an automatic correction without the original photo. You can save a report for team review.",
      });
  } else {
    assert(req.method === "POST", 405, "This action is unavailable.");
    if (!p[2]) {
      const input = z
        .object({
          reason: z.enum([
            "ingredients",
            "portion",
            "plating",
            "branding",
            "artificial",
            "other",
          ]),
          detail: z.string().trim().max(500).default(""),
        })
        .parse(await body(req));
      const t = now();
      await db().batch([
        db()
          .prepare(
            "INSERT INTO photo_corrections (original_job_id,restaurant_id,reported_asset_id,source_id,reason,detail,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(original_job_id) DO NOTHING",
          )
          .bind(
            rootId,
            r.id,
            assetId,
            source?.id || null,
            input.reason,
            input.detail,
            source && charged ? "reported" : "review",
            t,
            t,
          ),
        db()
          .prepare(
            "UPDATE assets SET needs_correction=1 WHERE id=? AND restaurant_id=?",
          )
          .bind(assetId, r.id),
      ]);
      await event(
        r.id,
        "food_error_reported",
        assetId,
        {
          originalJobId: rootId,
          reason: input.reason,
        },
        `${rootId}:${input.reason}`,
      );
      // Reporting the correction itself is the one-shot allowance recovery path.
      if (parentCorrection && !parentCorrection.credited_at) {
        await run(
          "UPDATE photo_corrections SET detail=substr(detail,1,500)||?,updated_at=? WHERE original_job_id=? AND credited_at IS NULL",
          `\nStill inaccurate (${input.reason}): ${input.detail}`,
          now(),
          rootId,
        );
        row = await restoreCorrectionCredit(rootId);
      }
    } else if (p[2] === "create") {
      assert(row, 400, "Tell us what changed in the food first.");
      assert(
        !["review", "credited", "resolved"].includes(row.status),
        409,
        "This report is already in review or resolved. No additional image will be charged.",
      );
      assert(
        source && charged,
        409,
        "The original photo is unavailable. Your report is saved for team review.",
      );
      const saved = JSON.parse(original!.details);
      const correction = await enqueue(
        r,
        {
          dishId: original!.dish_id,
          sourceId: source.id,
          parentId: null,
          requestKey: `food-correction:${rootId}`,
          candidateCount: 1,
          style: saved.style,
          controls: {
            ...saved.controls,
            plate: saved.controls?.plate || "keep",
            angle: "keep",
          },
          editMode: "preserve",
          revision: `Correct the reported ${row.reason} error. ${row.detail}. Reproduce the untouched source food and portion faithfully. Follow the saved serving-ware control and selected style for food; preserve original drink vessels and branding. Retain the requested scene only where compatible with food accuracy.`,
        },
        { correctionFor: rootId },
      );
      await run(
        "UPDATE photo_corrections SET correction_job_id=?,status=CASE WHEN status='reported' THEN 'queued' ELSE status END,updated_at=? WHERE original_job_id=? AND restaurant_id=?",
        correction.id,
        now(),
        rootId,
        r.id,
      );
    } else assert(false, 404, "This action is unavailable.");
    row = await one(
      "SELECT * FROM photo_corrections WHERE original_job_id=? AND restaurant_id=?",
      rootId,
      r.id,
    );
  }
  if (row?.correction_job_id) {
    await settleCorrection(row.correction_job_id);
    row = await one(
      "SELECT * FROM photo_corrections WHERE original_job_id=? AND restaurant_id=?",
      rootId,
      r.id,
    );
  }
  const result =
    row?.correction_job_id &&
    (await one(
      "SELECT asset_id FROM outputs WHERE job_id=? AND status='completed' ORDER BY slot LIMIT 1",
      row.correction_job_id,
    ));
  return response({
    ...correctionView(row!, result?.asset_id),
    isCorrection: !!parentCorrection,
  });
}
