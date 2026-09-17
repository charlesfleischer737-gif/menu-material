import { z } from "zod";
import { foodFamilies, looks, resolvePhotoLook } from "../studio";
import { all, assert, event, now, one, type Row } from "./core";

// These records describe the source attached to a specific saved Studio draft.
// They are not inferred from generic library uploads or the current draft only.
export async function recordStudioSource(
  restaurantId: string,
  draftId: string,
  draft: Row,
) {
  try {
    if (!draft.sourceId || draft.mode !== "photo") return;
    const source = await one(
      "SELECT id FROM assets WHERE id=? AND restaurant_id=? AND kind IN ('source','staff','generated','edited') AND deleted_at IS NULL",
      draft.sourceId,
      restaurantId,
    );
    if (!source) return;
    const style = resolvePhotoLook(draft);
    const details = {
      draftId,
      sourceId: source.id,
      guest: draft.measurementOrigin === "guest",
      cohort:
        ["ready", "manual"].includes(draft.analysisStatus) &&
        foodFamilies.includes(draft.recommendationFamily)
          ? draft.recommendationFamily
          : "unknown",
      styleId:
        style && looks.some((look) => look.id === draft.look)
          ? draft.look
          : "unknown",
      hasLook: !!style,
    };
    await event(
      restaurantId,
      "studio_source_ready",
      source.id,
      details,
      draftId,
    );
    if (style)
      await event(
        restaurantId,
        "look_selected",
        source.id,
        {
          draftId,
          sourceId: source.id,
          look: details.styleId,
          origin: draft.styleIntent ? "restored" : "default",
        },
        `source-attachment:${draftId}`,
      );
  } catch {
    // Recording progress must not prevent draft recovery or saving.
  }
}

export async function studioJobContext(restaurantId: string, input: Row) {
  if (!input.studioDraftId) return null;
  const draftId = z.string().uuid().parse(input.studioDraftId);
  const row = await one(
    "SELECT draft FROM creation_drafts WHERE id=? AND restaurant_id=? AND kind='studio'",
    draftId,
    restaurantId,
  );
  assert(row, 400, "Open your saved photo before creating it.");
  const draft = JSON.parse(row.draft);
  assert(
    (draft.mode === "photo" ? draft.sourceId || null : null) ===
      (input.sourceId || null) && draft.dishId === input.dishId,
    409,
    "Your photo changed. Review the current draft before creating it.",
  );
  return { draftId, draft };
}

export async function recordStudioJob(
  restaurantId: string,
  input: Row,
  job: Row,
  context: Awaited<ReturnType<typeof studioJobContext>>,
) {
  if (!context) return;
  try {
    await event(
      restaurantId,
      "studio_job_linked",
      job.id,
      {
        draftId: context.draftId,
        sourceId: input.sourceId || "",
        reused: !!job.reused,
        guest: context.draft.measurementOrigin === "guest",
      },
      `${context.draftId}:${input.requestKey}`,
    );
  } catch {
    // The accepted job and its idempotency are authoritative.
  }
}

const day = 86400000;
export async function studioProgressReport(
  mode: "production" | "internal",
  days = 30,
) {
  const asOf = now(),
    since = asOf - days * day;
  const rows = await all(
    `
    WITH RECURSIVE
    cohort AS (
      SELECT e.id AS context_id,e.restaurant_id,e.created_at AS ready_at,
        MIN(e.created_at + 604800000,?) AS deadline,
        json_extract(e.details,'$.draftId') AS draft_id,
        json_extract(e.details,'$.sourceId') AS source_id,
        COALESCE(json_extract(e.details,'$.guest'),0) AS guest,
        COALESCE(json_extract(e.details,'$.hasLook'),0) AS initial_look
      FROM events e WHERE e.kind='studio_source_ready' AND e.created_at>=? AND e.created_at<=?
        AND json_extract(e.details,'$.measurementMode')=?
    ),
    linked(context_id,restaurant_id,job_id,reused) AS (
      SELECT DISTINCT c.context_id,c.restaurant_id,e.entity_id,COALESCE(json_extract(e.details,'$.reused'),0)
      FROM cohort c JOIN events e ON e.restaurant_id=c.restaurant_id AND e.kind='studio_job_linked'
        AND json_extract(e.details,'$.draftId')=c.draft_id AND json_extract(e.details,'$.sourceId')=c.source_id
        AND e.created_at>=c.ready_at AND e.created_at<=c.deadline
        AND json_extract(e.details,'$.measurementMode')=?
      UNION
      SELECT l.context_id,l.restaurant_id,p.correction_job_id,0 FROM linked l
        JOIN photo_corrections p ON p.original_job_id=l.job_id AND p.restaurant_id=l.restaurant_id
        JOIN jobs j ON j.id=p.correction_job_id
        JOIN cohort c ON c.context_id=l.context_id
        WHERE p.correction_job_id IS NOT NULL AND j.created_at<=c.deadline
    ),
    family(context_id,restaurant_id,asset_id) AS (
      SELECT context_id,restaurant_id,source_id FROM cohort
      UNION
      SELECT l.context_id,l.restaurant_id,o.asset_id FROM linked l JOIN outputs o ON o.job_id=l.job_id
        JOIN assets a ON a.id=o.asset_id JOIN cohort c ON c.context_id=l.context_id
        WHERE o.asset_id IS NOT NULL AND a.created_at<=c.deadline
      UNION
      SELECT f.context_id,f.restaurant_id,ed.asset_id FROM family f
        JOIN asset_edits ed ON ed.parent_id=f.asset_id JOIN assets a ON a.id=ed.asset_id AND a.restaurant_id=f.restaurant_id
        JOIN cohort c ON c.context_id=f.context_id WHERE a.created_at<=c.deadline
    ),
    activity AS (
      SELECT c.context_id,e.kind,e.entity_id,e.created_at,e.details FROM cohort c JOIN events e
        ON e.restaurant_id=c.restaurant_id AND json_extract(e.details,'$.draftId')=c.draft_id
        AND json_extract(e.details,'$.sourceId')=c.source_id
        AND e.created_at>=c.ready_at AND e.created_at<=c.deadline
        AND json_extract(e.details,'$.measurementMode')=?
      WHERE e.kind IN ('style_selected','look_selected','studio_export_linked','export_download_started','native_share_complete','handoff_started')
    ),
    stages AS (
      SELECT c.*,
        c.initial_look OR EXISTS(SELECT 1 FROM activity e WHERE e.context_id=c.context_id AND e.kind IN ('style_selected','look_selected')) AS selected,
        EXISTS(SELECT 1 FROM linked l JOIN jobs j ON j.id=l.job_id WHERE l.context_id=c.context_id AND l.reused=0 AND j.created_at>=c.ready_at) AS requested,
        EXISTS(SELECT 1 FROM linked l JOIN jobs j ON j.id=l.job_id WHERE l.context_id=c.context_id AND (l.reused=1 OR j.created_at<c.ready_at)) AS reused,
        EXISTS(SELECT 1 FROM linked l JOIN outputs o ON o.job_id=l.job_id JOIN assets a ON a.id=o.asset_id WHERE l.context_id=c.context_id AND a.created_at<=c.deadline) AS result,
        EXISTS(SELECT 1 FROM family f JOIN assets a ON a.id=f.asset_id WHERE f.context_id=c.context_id AND a.approved_at IS NOT NULL AND a.approved_at<=c.deadline) AS approved,
        EXISTS(SELECT 1 FROM activity e JOIN family f ON f.context_id=e.context_id AND f.asset_id=e.entity_id WHERE e.context_id=c.context_id AND e.kind='studio_export_linked') AS prepared,
        (SELECT MIN(e.created_at) FROM activity e JOIN family f ON f.context_id=e.context_id AND f.asset_id=e.entity_id
          JOIN assets a ON a.id=e.entity_id AND a.approved_at IS NOT NULL AND a.approved_at<=e.created_at
          WHERE e.context_id=c.context_id AND (
            e.kind='handoff_started' OR (e.kind IN ('export_download_started','native_share_complete')
            AND json_extract(e.details,'$.exportKey') IS NOT NULL
            AND EXISTS(SELECT 1 FROM activity p WHERE p.context_id=e.context_id AND p.entity_id=e.entity_id AND p.kind='studio_export_linked'
              AND json_extract(p.details,'$.exportKey')=json_extract(e.details,'$.exportKey')))
          )) AS proxy_at
      FROM cohort c
    )
    SELECT guest,ready_at<=? AS mature,COUNT(*) AS sources,
      SUM(selected) AS selected,SUM(requested) AS requested,SUM(reused) AS reused,SUM(result) AS result,
      SUM(approved) AS approved,SUM(prepared) AS prepared,SUM(proxy_at IS NOT NULL) AS useful_proxy,
      AVG(CASE WHEN proxy_at IS NOT NULL THEN MAX(0,proxy_at-ready_at) END) AS average_proxy_ms
    FROM stages GROUP BY guest,mature
  `,
    asOf,
    since,
    asOf,
    mode,
    mode,
    mode,
    asOf - 7 * day,
  );
  return {
    since,
    asOf,
    days,
    mode,
    followupDays: 7,
    rows,
    scope:
      "Saved Photo Studio source drafts, including transferred guest drafts. Guest work abandoned before sign-up is not yet measured.",
    outcome:
      "Approved photo with a matching prepared file and download/share initiation, or an initiated handoff. This is a usage proxy, not confirmed file receipt or publication.",
    exclusions:
      "Internal QA is excluded from production. Untagged historical events, generic library uploads, descriptions, and unlinked exports are excluded. Pending cohorts are reported separately. Delivery is best effort; missing telemetry is not reconstructed as success.",
  };
}
