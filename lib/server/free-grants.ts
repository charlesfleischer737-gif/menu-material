import { FREE_SIGNUP_IMAGES } from "../plans";
import { freeImagesNote, type FreeImages } from "../free-images";
import { all, config, db, digest, now, one, run, type Row } from "./core";
import { imageEntitlement } from "./entitlements";
import { alertFreeGrantsUsedUp, background } from "./monitoring";

// The free signup images cost AI, so at most FREE_SIGNUP_GRANTS_PER_DAY new
// accounts a day (UTC) get them straight away. Later accounts still open,
// since menus, QR codes and posts cost no AI; their images are held
// (restaurants.free_grant='held') and granted oldest first as later days'
// grants allow. An email whose deleted account had them gets none again.
export function grantsPerDay() {
  const raw = config("FREE_SIGNUP_GRANTS_PER_DAY").trim(),
    value = raw ? Math.floor(Number(raw)) : 300;
  return Number.isFinite(value) && value >= 0 ? value : 300;
}
const today = () => new Date(now()).toISOString().slice(0, 10);
// Claims one of today's grants. The count is a hashed counter like the other
// limits, kept a day past its own so housekeeping can't clear it early.
async function claimGrant() {
  const cap = grantsPerDay(),
    day = today();
  const claimed =
    cap > 0 &&
    (await one(
      `INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?)
       ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<?
       RETURNING count`,
      digest(`free-grants:${day}`),
      Date.parse(day) + 2 * 86400000,
      cap,
    ));
  // Once a day, the team hears which setting to raise.
  if (!claimed) background(alertFreeGrantsUsedUp(cap));
  return !!claimed;
}
const emailHash = (email: string) => digest(`free-grant:${email}`);

/**
 * The free images a new public account starts with: none for an email that
 * already had them, and none yet past today's grants. Invitations bring their
 * own allowance and don't come here.
 */
export async function signupFreeImages(email: string) {
  if (
    await one(
      "SELECT 1 AS found FROM free_grant_emails WHERE hash=?",
      emailHash(email),
    )
  )
    return { allowance: 0, freeGrant: "used" };
  // Oldest first: while earlier accounts wait, a new one waits behind them,
  // which also keeps the "arrive within" estimate honest.
  const waiting = await one(
    "SELECT 1 AS found FROM restaurants WHERE free_grant='held' LIMIT 1",
  );
  return !waiting && (await claimGrant())
    ? { allowance: FREE_SIGNUP_IMAGES, freeGrant: null }
    : { allowance: 0, freeGrant: "held" };
}

/**
 * Grants held images, oldest account first, while today's grants have room.
 * Housekeeping runs it every hour, and a waiting owner's workspace when it
 * opens, so the images arrive without the worker too. One run a minute.
 */
export async function grantHeldImages(immediate = false) {
  const claim = await run(
    "INSERT INTO app_settings (key,value) VALUES ('free-grants-last-run',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(app_settings.value AS INTEGER)<?",
    String(now()),
    now() - 60000,
  );
  if (!claim.meta.changes && !immediate) return 0;
  let granted = 0;
  for (const { id } of await all(
    "SELECT r.id FROM restaurants r JOIN users u ON u.id=r.user_id WHERE r.free_grant='held' AND u.email_verification_required=0 ORDER BY r.created_at,r.id LIMIT 100",
  )) {
    if (!(await claimGrant())) break;
    const done = await run(
      "UPDATE restaurants SET allowance=allowance+?,free_grant=NULL WHERE id=? AND free_grant='held' AND EXISTS(SELECT 1 FROM users WHERE users.id=restaurants.user_id AND email_verification_required=0)",
      FREE_SIGNUP_IMAGES,
      id,
    );
    granted += done.meta.changes;
  }
  return granted;
}

/**
 * What the owner is told about free images missing from their balance, on
 * the free plan: when held ones should arrive, or that this email already
 * had them.
 */
export async function freeImagesStatus(
  restaurantId: string,
): Promise<FreeImages | null> {
  const read = () =>
    one(
      "SELECT free_grant,allowance,created_at FROM restaurants WHERE id=?",
      restaurantId,
    );
  let r = await read();
  if (!r?.free_grant) return null;
  if (r.free_grant === "verification")
    return { status: "verification", images: FREE_SIGNUP_IMAGES };
  if (r.free_grant === "held" && (await grantHeldImages())) r = await read();
  if (!r?.free_grant || (await imageEntitlement(restaurantId)).plan !== "free")
    return null;
  if (r.free_grant === "used")
    // Unless an administrator has since given images.
    return Number(r.allowance) > 0
      ? null
      : { status: "used", images: FREE_SIGNUP_IMAGES };
  // Days until its turn: the held accounts up to it, a day's grants a day.
  const cap = grantsPerDay(),
    ahead = await one(
      "SELECT count(*) AS n FROM restaurants WHERE free_grant='held' AND (created_at<? OR (created_at=? AND id<=?))",
      r.created_at,
      r.created_at,
      restaurantId,
    );
  return {
    status: "held",
    images: FREE_SIGNUP_IMAGES,
    days: cap > 0 ? Math.max(1, Math.ceil(Number(ahead?.n || 1) / cap)) : null,
  };
}

/** Why an image request found no images, when free images explain it. */
export async function freeImagesRefusal(restaurantId: string) {
  const free = await freeImagesStatus(restaurantId);
  return free?.status === "verification"
    ? freeImagesNote(free)
    : free?.status === "held"
      ? `${freeImagesNote(free)} Your work is saved, so you can create this image then.`
      : free?.status === "used"
        ? `${freeImagesNote(free)} Your work is saved; see Plans for more images.`
        : "";
}

/**
 * Kept when an account is deleted (core.ts deleteAccount), in the same
 * transaction: a one-way hash of the email, only so a new account with it
 * doesn't get the free images again. Images still held were never had.
 */
export function rememberFreeGrant(email: string, restaurant: Row) {
  return db()
    .prepare(
      "INSERT OR IGNORE INTO free_grant_emails (hash,created_at) SELECT ?,? WHERE ?",
    )
    .bind(
      emailHash(email),
      now(),
      ["held", "verification"].includes(restaurant.free_grant) ? 0 : 1,
    );
}
