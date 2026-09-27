import { assert, bucket, one } from "./core";
import { validateImageDimensions } from "./image-validation";

/**
 * Smaller JPEG copies of a menu photo, so guests on phones download a photo
 * sized for their screen rather than the full 2048 px original. The owner's
 * browser makes them when a menu is published (a Worker can't resize images
 * cheaply); guest menus choose one with srcset, and fall back to the full
 * photo when a copy is missing.
 */
export const variantWidths = [480, 960, 1440] as const;
const isWidth = (w: number) => (variantWidths as readonly number[]).includes(w);
const privateKey = (rid: string, aid: string, w: number) =>
  `private/${rid}/variants/${aid}-w${w}.jpg`;
// Marks a width the original is too small for, so it isn't asked for again.
const skipKey = (rid: string, aid: string, w: number) =>
  `private/${rid}/variants/${aid}-w${w}.none`;
export const publicVariantKey = (rid: string, aid: string, w: number) =>
  `public/${rid}/${aid}-w${w}`;

/** Every stored copy of an asset's smaller versions, public and private. */
export function assetVariantKeys(rid: string, aid: string) {
  return variantWidths.flatMap((w) => [
    privateKey(rid, aid, w),
    skipKey(rid, aid, w),
    publicVariantKey(rid, aid, w),
  ]);
}

/** The widths each photo still needs a copy for. */
export async function neededVariants(rid: string, ids: string[]) {
  const needed: Record<string, number[]> = {};
  await Promise.all(
    [...new Set(ids)].map(async (aid) => {
      const asset = await one(
        "SELECT id FROM assets WHERE id=? AND restaurant_id=? AND deleted_at IS NULL",
        aid,
        rid,
      );
      if (!asset) return;
      const missing: number[] = [];
      for (const w of variantWidths)
        if (
          !(await bucket().head(privateKey(rid, aid, w))) &&
          !(await bucket().head(skipKey(rid, aid, w)))
        )
          missing.push(w);
      if (missing.length) needed[aid] = missing;
    }),
  );
  return needed;
}

/** Store the copies the owner's browser made, checked like any upload. */
export async function saveVariants(rid: string, aid: string, form: FormData) {
  const asset = await one(
    "SELECT id FROM assets WHERE id=? AND restaurant_id=? AND deleted_at IS NULL",
    aid,
    rid,
  );
  assert(asset, 404, "Photo not found.");
  const skipped = String(form.get("skip") || "")
    .split(",")
    .map(Number)
    .filter(isWidth);
  for (const w of skipped) await bucket().put(skipKey(rid, aid, w), "");
  for (const w of variantWidths) {
    const file = form.get(`w${w}`);
    if (!(file instanceof File)) continue;
    assert(file.size <= 1500000, 413, "This photo copy is too large.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    assert(
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
      400,
      "Photo copies must be JPEG images.",
    );
    const size = validateImageDimensions(bytes, "image/jpeg", true);
    assert(
      size && Math.abs(size.width - w) <= 2,
      400,
      "This photo copy isn't the expected size.",
    );
    await bucket().put(privateKey(rid, aid, w), bytes, {
      httpMetadata: { contentType: "image/jpeg" },
    });
  }
  // Copies usually arrive just after publishing; guests get them straight
  // away. (Imported here: the menu module publishes copies too.)
  const { assetInPublishedDocuments } = await import("./menu-documents");
  if (await assetInPublishedDocuments(rid, aid)) await publishVariants(rid, aid);
}

/** Publishing copies the photo's smaller versions next to its public copy. */
export async function publishVariants(rid: string, aid: string) {
  for (const w of variantWidths) {
    const object = await bucket().get(privateKey(rid, aid, w));
    if (object)
      await bucket().put(
        publicVariantKey(rid, aid, w),
        await object.arrayBuffer(),
        { httpMetadata: { contentType: "image/jpeg" } },
      );
  }
}

/** The smaller public copy a guest asked for (`?w=480`), if there is one. */
export function requestedVariant(req: Request) {
  const w = Number(new URL(req.url).searchParams.get("w"));
  return isWidth(w) ? w : null;
}
