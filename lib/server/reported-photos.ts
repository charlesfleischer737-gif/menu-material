import { all, bucket, db, now, one, run, type Row } from "./core";
import { publicVariantKey, variantWidths } from "./photo-variants";

/** A live copy without this photo, or the same string when it has none. */
function withoutPhoto(published: string, assetId: string) {
  const menu = JSON.parse(published);
  let changed = false;
  for (const section of menu.sections || [])
    for (const item of section.items || [])
      if (item.photoId === assetId) {
        item.photoId = null;
        changed = true;
      }
  return changed ? JSON.stringify(menu) : published;
}
function menuName(row: Row) {
  try {
    return String(JSON.parse(row.draft).name || "").trim() || "Menu";
  } catch {
    return "Menu";
  }
}

/**
 * A photo the owner reports as inaccurate leaves what guests see at once, as
 * a deleted one does: live menus lose it, specials showing it are hidden
 * (publicMenu leaves them out) and its public copies are removed. Drafts, the
 * menu draft from before Menus and publication history keep it, so the owner
 * can choose a replacement; publishing again leaves it out.
 *
 * Returns the menus that changed and the specials now hidden, so the owner
 * can be told. `id: null` is a live menu from before Menus.
 */
export async function withdrawReportedPhoto(rid: string, assetId: string) {
  const menus = new Map<string | null, string>();
  // Compare-and-swap against current values, as deleting a photo does, so a
  // concurrent publication is never overwritten with an older copy.
  for (let attempt = 0; attempt < 5; attempt++) {
    let conflicted = false;
    const rows = await all(
      "SELECT id,draft,published FROM menu_documents WHERE restaurant_id=? AND published IS NOT NULL",
      rid,
    );
    for (const row of rows) {
      const published = withoutPhoto(row.published, assetId);
      if (published === row.published) continue;
      const [saved] = await db().batch([
        // The live copy no longer matches its draft, so Menus offers to
        // publish again.
        db()
          .prepare(
            "UPDATE menu_documents SET published=?,published_revision=NULL WHERE id=? AND restaurant_id=? AND published=? RETURNING id",
          )
          .bind(published, row.id, rid, row.published),
        // The main menu's live copy mirrors its document.
        db()
          .prepare(
            "UPDATE restaurants SET published=? WHERE id=? AND published=?",
          )
          .bind(published, rid, row.published),
      ]);
      if (saved.results.length) menus.set(row.id, menuName(row));
      else conflicted = true;
    }
    // A live menu from before Menus, which no document mirrors.
    const main = await one("SELECT published FROM restaurants WHERE id=?", rid);
    if (main?.published) {
      const published = withoutPhoto(main.published, assetId);
      if (published !== main.published) {
        const saved = await run(
          "UPDATE restaurants SET published=? WHERE id=? AND published=?",
          published,
          rid,
          main.published,
        );
        if (saved.meta.changes) menus.set(null, "");
        else conflicted = true;
      }
    }
    if (!conflicted) break;
  }
  // No error if a menu kept changing: the report is saved, and the public
  // image route already refuses a reported photo.
  await bucket().delete([
    `public/${rid}/${assetId}`,
    ...variantWidths.map((w) => publicVariantKey(rid, assetId, w)),
  ]);
  const specials = (
    await all(
      "SELECT id,published FROM promotions WHERE restaurant_id=? AND published IS NOT NULL AND sold_out=0 AND ends_at>?",
      rid,
      now(),
    )
  ).flatMap((row) => {
    const special = JSON.parse(row.published);
    return special.items?.some((item: Row) => item.photoId === assetId)
      ? [{ id: row.id as string, title: String(special.title || "") }]
      : [];
  });
  return {
    menus: [...menus].map(([id, name]) => ({ id, name })),
    specials,
  };
}
