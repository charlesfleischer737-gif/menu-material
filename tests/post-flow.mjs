import assert from "node:assert/strict";
import {
  postPage,
  postCaption,
  updatePost,
  postDetailError,
} from "../lib/post-flow.ts";

const restaurant = { name: "The Orchard Kitchen", currency: "USD" };
const item = {
  dishId: "pasta",
  photoId: "approved-pasta",
  name: "Tomato pasta",
  quantity: 1,
};
const assets = [
  { id: item.photoId, dish_id: item.dishId, approved_at: "2026-09-15" },
];
const base = {
  step: 2,
  items: [item],
  occasion: "special",
  title: "Tonight’s special",
  description: "Tomato pasta with basil",
  price: "14.50",
  showPrice: true,
  validity: "Tonight · 5–9 pm",
  channels: ["feed", "story"],
  captionMode: "auto",
  reviewed: true,
};
base.caption = postCaption(base, restaurant);

assert.deepEqual(
  [1, 2, 3, 4, 5, 6].map(postPage),
  [1, 1, 2, 3, 3, 4],
  "Existing saved posts keep their logical place in the shorter flow",
);
const repriced = updatePost(
  base,
  { price: "18.00", validity: "Friday · 6–9 pm" },
  restaurant,
);
assert.match(repriced.caption, /\$18\.00/);
assert.doesNotMatch(repriced.caption, /14\.50|Tonight ·/);
assert.equal(repriced.reviewed, false);

const custom = updatePost(
  base,
  { caption: "Our pasta special is $14.50 tonight. See you soon!" },
  restaurant,
);
const changedCustom = updatePost(custom, { price: "18.00" }, restaurant);
assert.equal(
  changedCustom.caption,
  custom.caption,
  "Price edits preserve the owner’s words",
);
assert.equal(
  changedCustom.captionNeedsReview,
  true,
  "Changed facts flag a custom caption for review",
);
const refreshed = updatePost(
  changedCustom,
  { caption: postCaption(changedCustom, restaurant), captionMode: "auto" },
  restaurant,
);
assert.equal(refreshed.captionNeedsReview, false);
assert.match(
  updatePost(refreshed, { price: "19" }, restaurant).caption,
  /\$19\.00/,
);

const legacy = { ...base };
delete legacy.captionMode;
assert.match(
  updatePost(legacy, { price: "20" }, restaurant).caption,
  /\$20\.00/,
  "Legacy automatic starters update too",
);
assert.equal(
  updatePost(
    { ...legacy, captionMode: "", caption: "My own copy" },
    { price: "20" },
    restaurant,
  ).caption,
  "My own copy",
);

const combo = {
  ...base,
  occasion: "combo",
  title: "Dinner for two",
  items: [
    { ...item, quantity: 2 },
    {
      ...item,
      dishId: "burger",
      photoId: "approved-burger",
      name: "House burger",
      quantity: 1,
    },
  ],
  channels: ["feed", "carousel"],
};
assert.match(
  postCaption(combo, restaurant),
  /Dinner for two\n2 × Tomato pasta \+ 1 × House burger/,
);
assert.deepEqual(
  updatePost(combo, { items: [item] }, restaurant).channels,
  ["feed"],
  "Removing the second dish removes the unavailable carousel format",
);
assert.equal(postDetailError(base, assets), "");
assert.match(postDetailError(base, []), /no longer available/);
assert.match(
  postDetailError(base, [{ ...assets[0], dish_id: "another-dish" }]),
  /no longer available/,
);
assert.match(
  postDetailError({ ...base, items: [{ ...item, quantity: 1.5 }] }, assets),
  /whole quantity/,
);
assert.match(
  postDetailError({ ...base, price: "" }, assets),
  /Enter the price/,
);
assert.match(
  postDetailError({ ...base, occasion: "event", validity: "" }, assets),
  /date and time/,
);
console.log("Post flow: 18 assertions passed");
