import { money, type Row } from "./client";
import { dishSnapshot } from "./dish-library";
export function postFromPhoto(
  base: Row,
  dish: Row,
  photo: Row,
  restaurant: Row,
  quick = false,
) {
  const items = [
    {
      dishId: dish.id,
      photoId: photo.id,
      name: dish.name,
      quantity: 1,
      facts: dishSnapshot(dish),
    },
  ];
  const draft = {
    ...base,
    items,
    ...postDefaults(items),
    showPrice: false,
    validity: "",
    channels: ["feed", "story"],
    quickStart: quick,
    step: quick ? 6 : 1,
    reviewed: false,
    captionMode: "auto",
    captionNeedsReview: false,
  };
  return { ...draft, caption: postCaption(draft, restaurant) };
}
export function postPage(step: number) {
  return step <= 2 ? 1 : step === 3 ? 2 : step <= 5 ? 3 : 4;
}
/** The dish's name, or a short list when a post has several dishes. */
export function postHeadline(items: Row[]) {
  const names = items.map((i) => String(i.name || "").trim()).filter(Boolean);
  if (names.length < 2) return names[0] || "";
  const list = `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  return list.length <= 60 ? list : `${names[0]} & ${names.length - 1} more`;
}
/**
 * What the headline, description and price say until the owner writes their
 * own. Several dishes share no description or price: an offer price is typed.
 */
export function postDefaults(items: Row[]) {
  const lead = items.length === 1 ? items[0] : null;
  const price = Number(lead?.facts?.price);
  return {
    title: postHeadline(items),
    description: String(lead?.facts?.description || ""),
    price: Number.isFinite(price) && price > 0 ? (price / 100).toFixed(2) : "",
  };
}
function samePrice(a: unknown, b: string) {
  return a === "" || a == null ? b === "" : b !== "" && Number(a) === Number(b);
}
export function postCaption(draft: Row, restaurant: Row, short = false) {
  const names = (draft.items || [])
    .map((i: Row) =>
      draft.occasion === "combo" ? `${i.quantity} × ${i.name}` : i.name,
    )
    .join(" + ");
  return [
    draft.title || names,
    draft.title &&
    draft.title !== names &&
    draft.title !== postHeadline(draft.items || [])
      ? names
      : "",
    !short ? draft.description : "",
    draft.showPrice && draft.price !== "" && draft.price != null
      ? money(Math.round(Number(draft.price) * 100), restaurant.currency)
      : "",
    draft.validity,
    restaurant.name,
  ]
    .filter(Boolean)
    .join("\n");
}
export function updatePost(draft: Row, patch: Row, restaurant: Row) {
  const next: Row = { ...draft, ...patch, reviewed: false };
  if ("items" in patch) {
    // Words the owner hasn't changed follow the dishes when the lead changes,
    // one is removed, or several share the post.
    const before = postDefaults(draft.items || []),
      after = postDefaults(next.items);
    if (!("title" in patch) && (draft.title ?? "") === before.title)
      next.title = after.title;
    if (
      !("description" in patch) &&
      (draft.description ?? "") === before.description
    )
      next.description = after.description;
    if (!("price" in patch) && samePrice(draft.price, before.price))
      next.price = after.price;
  }
  if ("items" in patch && next.items.length < 2)
    next.channels = (next.channels || []).filter(
      (c: string) => c !== "carousel",
    );
  const automatic =
    draft.captionMode === "auto" ||
    (!draft.captionMode &&
      (!draft.caption || draft.caption === postCaption(draft, restaurant)));
  if ("caption" in patch)
    return {
      ...next,
      captionMode: patch.captionMode || "custom",
      captionNeedsReview: false,
    };
  if (
    [
      "items",
      "title",
      "description",
      "price",
      "showPrice",
      "validity",
      "occasion",
    ].some((key) => key in patch)
  ) {
    if (automatic)
      return {
        ...next,
        caption: postCaption(next, restaurant),
        captionMode: "auto",
        captionNeedsReview: false,
      };
    return { ...next, captionNeedsReview: true };
  }
  return next;
}
export function postDetailError(draft: Row, assets: Row[]) {
  if (!draft.items?.length) return "Choose an approved dish photo to start.";
  if (draft.items.length > 6) return "Choose up to six dish photos.";
  if (
    draft.items.some(
      (i: Row) =>
        !assets.some(
          (a) =>
            a.id === i.photoId &&
            a.dish_id === i.dishId &&
            a.approved_at &&
            !a.deleted_at,
        ),
    )
  )
    return "A selected photo is no longer available. Choose another approved photo.";
  if (
    draft.items.some(
      (i: Row) =>
        !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 100,
    )
  )
    return "Choose a whole quantity from 1 to 100 for each dish.";
  if (!draft.title?.trim()) return "Add a headline for this post.";
  if (
    draft.showPrice &&
    (draft.price === "" ||
      !Number.isFinite(Number(draft.price)) ||
      Number(draft.price) < 0)
  )
    return "Enter the price, or turn off Show price.";
  if (draft.occasion === "event" && !draft.validity?.trim())
    return "Add the event date and time.";
  return "";
}
