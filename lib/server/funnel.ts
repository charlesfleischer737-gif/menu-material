import { z } from "zod";
import { all, body, event, now, one, response, type Row } from "./core";
import { publicLimit } from "./safeguards";
import {
  cleanHost,
  cleanTag,
  signupSource,
  type Attribution,
} from "../attribution";
import { menuExportFormats, tableCardFormats, visitorSteps } from "../funnel";
import { isProFeature, type ProFeature } from "../plans";

const day = 86400000;

/**
 * POST /api/funnel: a visitor's step (lib/funnel.ts), counted once per
 * browser. The browser's random ID goes only into the record's key, through
 * a one-way hash, the way guest menu visits count once. No network address,
 * account or email is kept with it.
 */
export async function visitorStepRoute(req: Request) {
  // Per network and before the body is read, so floods stay cheap.
  await publicLimit(req, "funnel-step", 120, 3600);
  const { step, visitor } = z
    .object({ step: z.enum(visitorSteps), visitor: z.string().uuid() })
    .parse(await body(req));
  await event(null, "funnel_step", null, { step }, `${step}:${visitor}`);
  return response({ ok: true }, 202);
}

const tag = z.preprocess(cleanTag, z.string().max(60).optional());
// Where a new owner came from (lib/attribution.ts), checked again here: a
// referring site's name and short campaign tags, and nothing else. A
// malformed source is dropped; it never stops a signup.
const attributionSchema = z
  .object({
    referrer: z.preprocess(cleanHost, z.string().max(100).optional()),
    utmSource: tag,
    utmMedium: tag,
    utmCampaign: tag,
    ref: tag,
  })
  .catch({});

/** At signup: the source the browser kept, as a `signup_source` event. */
export async function recordSignupSource(restaurantId: string, input: unknown) {
  const found: Attribution = Object.fromEntries(
    Object.entries(attributionSchema.parse(input ?? {})).filter(
      ([, value]) => value,
    ),
  );
  if (!Object.keys(found).length) return;
  await event(restaurantId, "signup_source", null, found, "signup").catch(
    () => {},
  );
}

/** Which Pro feature's sheet a waitlist signup came from, when one did. */
export async function recordWaitlistJoin(restaurantId: string, input: unknown) {
  const chosen = z
    .object({ feature: z.string().refine(isProFeature) })
    .safeParse(input);
  await event(
    restaurantId,
    "waitlist_joined",
    null,
    { feature: chosen.success ? chosen.data.feature : null },
    "waitlist",
  ).catch(() => {});
}

/** A `menu_exported` event's details: which export it was. */
export const menuExportDetails = (input: Row) => ({
  format: z.enum(menuExportFormats).parse(input.format),
});

/** For "Get your menu live": has a table card or menu QR code been saved? */
export async function launchChecklistFacts(restaurantId: string) {
  const formats = tableCardFormats.map(() => "?").join(",");
  return {
    tableCard: !!(await one(
      `SELECT 1 FROM events WHERE restaurant_id=? AND kind='menu_exported' AND json_extract(details,'$.format') IN (${formats}) LIMIT 1`,
      restaurantId,
      ...tableCardFormats,
    )),
  };
}

// A restaurant's first export: a photo downloaded or shared, a post, a
// campaign, or a menu's PDF, table card or QR code.
const exportKinds = [
  "export_download_started",
  "native_share_complete",
  "export_complete",
  "promotion_exported",
  "image_downloaded",
  "menu_exported",
];
// What followed a Pro feature: Plans shown for it (by a click or a save Pro
// refused), "See Pro" or a Pro button clicked, Get Pro, and the waitlist.
const featureColumns = {
  upgrade_prompt_shown: "shown",
  upgrade_requested: "seePro",
  upgrade_clicked: "getPro",
  waitlist_joined: "waitlist",
} as const;
type FeatureColumn = (typeof featureColumns)[keyof typeof featureColumns];
type Counts = { week: number; month: number };
const counts = (row?: Row | null): Counts => ({
  week: Number(row?.week) || 0,
  month: Number(row?.month) || 0,
});

/** Restaurants whose first event of these kinds falls in each window. */
async function firsts(kinds: string[], week: number, month: number) {
  const marks = kinds.map(() => "?").join(",");
  return counts(
    await one(
      `SELECT SUM(first>=?) AS week, COUNT(*) AS month FROM (SELECT MIN(created_at) AS first FROM events WHERE kind IN (${marks}) AND restaurant_id IN (SELECT restaurant_id FROM events WHERE kind IN (${marks}) AND created_at>=?) GROUP BY restaurant_id) WHERE first>=?`,
      week,
      ...kinds,
      ...kinds,
      month,
      month,
    ),
  );
}

/**
 * GET /api/admin/funnel: the launch funnel for the last 7 and 30 days.
 * Visitors' steps count browsers. Signups, first exports and first published
 * menus count restaurants, in the window where each first happened.
 */
export async function funnelReport() {
  const asOf = now(),
    week = asOf - 7 * day,
    month = asOf - 30 * day;
  const visits = await all(
    "SELECT json_extract(details,'$.step') AS step, SUM(created_at>=?) AS week, COUNT(*) AS month FROM events WHERE kind='funnel_step' AND created_at>=? GROUP BY step",
    week,
    month,
  );
  const steps = [
    ...visitorSteps.map((id) => ({
      id,
      unit: "visitors",
      ...counts(visits.find((row) => row.step === id)),
    })),
    {
      id: "signup",
      unit: "restaurants",
      ...counts(
        await one(
          "SELECT SUM(created_at>=?) AS week, COUNT(*) AS month FROM events WHERE kind='onboarded' AND created_at>=?",
          week,
          month,
        ),
      ),
    },
    {
      id: "export",
      unit: "restaurants",
      ...(await firsts(exportKinds, week, month)),
    },
    {
      id: "publish",
      unit: "restaurants",
      ...(await firsts(["menu_published"], week, month)),
    },
  ];
  // Signups by where they came from; those without a source are direct.
  const sources = new Map<string, ReturnType<typeof signupSource> & Counts>();
  for (const row of await all(
    "SELECT o.created_at,s.details FROM events o LEFT JOIN events s ON s.restaurant_id=o.restaurant_id AND s.kind='signup_source' WHERE o.kind='onboarded' AND o.created_at>=?",
    month,
  )) {
    let found: Attribution = {};
    try {
      found = row.details ? JSON.parse(row.details) : {};
    } catch {}
    const source = signupSource(found),
      key = JSON.stringify(source),
      entry = sources.get(key) || { ...source, week: 0, month: 0 };
    entry.month++;
    if (row.created_at >= week) entry.week++;
    sources.set(key, entry);
  }
  // Per Pro feature, restaurants that met it and what they did next, each
  // counted once per feature. A waitlist signup from Plans opened without a
  // feature has none.
  const features = new Map<
    string,
    { feature: ProFeature | null } & Record<FeatureColumn, Counts>
  >();
  const kinds = Object.keys(featureColumns);
  for (const row of await all(
    `SELECT kind,json_extract(details,'$.feature') AS feature,COUNT(DISTINCT CASE WHEN created_at>=? THEN restaurant_id END) AS week,COUNT(DISTINCT restaurant_id) AS month FROM events WHERE kind IN (${kinds.map(() => "?").join(",")}) AND created_at>=? GROUP BY kind,feature`,
    week,
    ...kinds,
    month,
  )) {
    const feature = isProFeature(row.feature) ? row.feature : null,
      entry = features.get(feature || "") || {
        feature,
        shown: counts(),
        seePro: counts(),
        getPro: counts(),
        waitlist: counts(),
      },
      column = featureColumns[row.kind as keyof typeof featureColumns],
      added = counts(row);
    entry[column] = {
      week: entry[column].week + added.week,
      month: entry[column].month + added.month,
    };
    features.set(feature || "", entry);
  }
  return {
    asOf,
    steps,
    sources: [...sources.values()]
      .sort((a, b) => b.month - a.month || b.week - a.week)
      .slice(0, 50),
    features: [...features.values()].sort(
      (a, b) =>
        b.shown.month - a.shown.month ||
        b.waitlist.month - a.waitlist.month ||
        b.seePro.month - a.seePro.month,
    ),
  };
}
