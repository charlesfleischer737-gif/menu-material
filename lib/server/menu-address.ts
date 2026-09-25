import { assert, db, now, one, run, type Row } from "./core";
import { menuAddressProblem, slugify } from "../restaurant-identity";

// Earlier addresses kept working for printed QR codes, at most this many per
// restaurant; an administrator can release one.
const keptAddresses = 5;
const everLive =
  "(r.published IS NOT NULL OR EXISTS(SELECT 1 FROM events e WHERE e.restaurant_id=r.id AND e.kind IN ('menu_published','promotion_published')))";

async function addressTaken(slug: string, rid: string) {
  const owner = await one("SELECT id FROM restaurants WHERE slug=?", slug);
  if (owner && owner.id !== rid) return true;
  // Earlier addresses of restaurants that never went live (kept before
  // redirects needed a live menu) hold nothing.
  return !!(await one(
    `SELECT 1 AS taken FROM slug_redirects s JOIN restaurants r ON r.id=s.restaurant_id WHERE s.slug=? AND s.restaurant_id!=? AND ${everLive}`,
    slug,
    rid,
  ));
}

/** Guests may have saved the current address: a menu was live while it was. */
async function addressWasLive(r: Row) {
  if (r.published) return true;
  return !!(await one(
    "SELECT 1 AS found FROM events WHERE restaurant_id=? AND kind IN ('menu_published','promotion_published') AND created_at>=? LIMIT 1",
    r.id,
    r.slug_since ?? 0,
  ));
}

/** A readable, available address based on the restaurant's name. */
export async function suggestMenuAddress(name: string, rid: string) {
  const base = slugify(name);
  const suffix = rid.replace(/-/g, "");
  for (const candidate of [
    base,
    `${base}-${suffix.slice(0, 4)}`,
    `${base}-${suffix.slice(0, 8)}`,
  ])
    if (!menuAddressProblem(candidate) && !(await addressTaken(candidate, rid)))
      return candidate;
  return `${base}-${suffix.slice(0, 12)}`;
}

export async function menuAddressAvailable(slug: string, rid: string) {
  return !menuAddressProblem(slug) && !(await addressTaken(slug, rid));
}

/**
 * Move the menu to a new address. An old address that was live is kept as a
 * redirect, so printed QR codes and shared links keep opening the menu, as is
 * the signup address (shown as the menu link before publishing, and unique to
 * the restaurant). Any other address is released.
 */
export async function changeMenuAddress(r: Row, next: string) {
  const problem = menuAddressProblem(next);
  assert(!problem, 400, problem);
  if (next === r.slug) return next;
  assert(
    !(await addressTaken(next, r.id)),
    409,
    "That menu address is taken. Try another.",
  );
  const keep = isAutomaticAddress(r) || (await addressWasLive(r));
  if (keep)
    assert(
      (
        await one(
          "SELECT count(*) AS n FROM slug_redirects WHERE restaurant_id=? AND slug!=?",
          r.id,
          next,
        )
      )?.n < keptAddresses,
      409,
      `Your menu already keeps ${keptAddresses} earlier addresses working for printed QR codes. Contact support to release one before changing it again.`,
    );
  const t = now();
  try {
    await db().batch([
      db()
        .prepare(
          "INSERT OR IGNORE INTO slug_redirects (slug,restaurant_id,created_at) SELECT ?,?,? WHERE ?=1",
        )
        .bind(r.slug, r.id, t, keep ? 1 : 0),
      // Also clears an earlier address another restaurant never used live.
      db().prepare("DELETE FROM slug_redirects WHERE slug=?").bind(next),
      db()
        .prepare(
          "UPDATE restaurants SET slug=?,slug_since=CASE WHEN published IS NULL THEN ? ELSE 0 END WHERE id=? AND slug=?",
        )
        .bind(next, t, r.id, r.slug),
    ]);
  } catch {
    assert(false, 409, "That menu address is taken. Try another.");
  }
  const saved = await one("SELECT slug FROM restaurants WHERE id=?", r.id);
  assert(
    saved?.slug === next,
    409,
    "Your menu address changed in another window. Reload and try again.",
  );
  r.slug = next;
  return next;
}

/**
 * An administrator frees an address: an earlier address stops redirecting,
 * and a restaurant using it moves to an automatic address.
 */
export async function releaseMenuAddress(slug: string) {
  const earlier = await one(
    "SELECT restaurant_id FROM slug_redirects WHERE slug=?",
    slug,
  );
  if (earlier) {
    await run("DELETE FROM slug_redirects WHERE slug=?", slug);
    return { restaurantId: earlier.restaurant_id as string, moved: null };
  }
  const current = await one(
    "SELECT id,name FROM restaurants WHERE slug=?",
    slug,
  );
  if (!current) return null;
  const automatic = `${slugify(current.name)}-${String(current.id).slice(0, 8)}`;
  await db().batch([
    db()
      .prepare("DELETE FROM slug_redirects WHERE slug=? AND restaurant_id=?")
      .bind(automatic, current.id),
    db()
      .prepare(
        "UPDATE restaurants SET slug=?,slug_since=CASE WHEN published IS NULL THEN ? ELSE 0 END WHERE id=? AND slug=?",
      )
      .bind(automatic, now(), current.id, slug),
  ]);
  return { restaurantId: current.id as string, moved: automatic };
}

/** Addresses created at signup, before the owner chose one. */
export function isAutomaticAddress(r: Row) {
  return (
    r.slug === "local-pilot" || r.slug.endsWith("-" + String(r.id).slice(0, 8))
  );
}

/**
 * Before anything is public, give the menu an address based on the real
 * restaurant name. Once a menu has been published the address never moves
 * on its own, so printed codes stay valid.
 */
export async function firstPublicationAddress(r: Row, requested?: string) {
  const everPublished =
    !!r.published ||
    !!(await one(
      "SELECT 1 AS found FROM menu_publication_history WHERE restaurant_id=? LIMIT 1",
      r.id,
    ));
  if (everPublished) return r.slug as string;
  if (requested) return changeMenuAddress(r, requested);
  if (!isAutomaticAddress(r)) return r.slug as string;
  return changeMenuAddress(r, await suggestMenuAddress(r.name, r.id));
}

/**
 * Find a restaurant by its current or an earlier menu address. Public pages
 * an administrator took offline are not found.
 */
export async function resolveMenuAddress(slug: string) {
  const current = await one("SELECT * FROM restaurants WHERE slug=?", slug);
  if (current)
    return current.public_suspended
      ? { restaurant: null, redirectTo: null }
      : { restaurant: current, redirectTo: null };
  const moved = await one(
    "SELECT r.* FROM slug_redirects s JOIN restaurants r ON r.id=s.restaurant_id WHERE s.slug=?",
    slug,
  );
  return moved && !moved.public_suspended
    ? { restaurant: moved, redirectTo: moved.slug as string }
    : { restaurant: null, redirectTo: null };
}
