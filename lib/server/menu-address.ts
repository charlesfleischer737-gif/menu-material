import { assert, db, now, one, type Row } from "./core";
import { menuAddressProblem, slugify } from "../restaurant-identity";

async function addressTaken(slug: string, rid: string) {
  const owner = await one("SELECT id FROM restaurants WHERE slug=?", slug);
  if (owner && owner.id !== rid) return true;
  const earlier = await one(
    "SELECT restaurant_id FROM slug_redirects WHERE slug=?",
    slug,
  );
  return !!earlier && earlier.restaurant_id !== rid;
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
 * Move the menu to a new address. The old address is kept as a redirect, so
 * printed QR codes and shared links keep opening the menu.
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
  try {
    await db().batch([
      db()
        .prepare(
          "INSERT OR IGNORE INTO slug_redirects (slug,restaurant_id,created_at) VALUES (?,?,?)",
        )
        .bind(r.slug, r.id, now()),
      db()
        .prepare("DELETE FROM slug_redirects WHERE slug=? AND restaurant_id=?")
        .bind(next, r.id),
      db()
        .prepare("UPDATE restaurants SET slug=? WHERE id=? AND slug=?")
        .bind(next, r.id, r.slug),
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
