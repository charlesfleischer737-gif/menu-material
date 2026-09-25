import assert from "node:assert/strict";
import "./photo-destinations.mjs";
import {
  postPage,
  postCaption,
  updatePost,
  postDetailError,
  postFromPhoto,
  captionPlaceholder,
  currentCaption,
} from "../lib/post-flow.ts";
import { applyPostTemplate } from "../lib/post-templates.ts";

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
const quick = postFromPhoto(
  { template: "editorial", color: "#123456", typography: "editorial" },
  {
    id: item.dishId,
    name: item.name,
    description: "Our real pasta",
    price: 1850,
  },
  assets[0],
  restaurant,
  true,
);
assert.equal(
  quick.items[0].photoId,
  item.photoId,
  "Reuse the exact approved version",
);
assert.equal(
  quick.step,
  6,
  "A matching post opens at the combined review and download screen",
);
assert.deepEqual(quick.channels, ["feed", "story"]);
assert.equal(quick.color, "#123456");
assert.equal(quick.typography, "editorial");
assert.equal(quick.price, "18.50");
assert.equal(
  quick.showPrice,
  false,
  "A stored price is optional and needs review before publication",
);
assert.equal(
  quick.validity,
  "",
  "Never carry stale offer dates into a new post",
);
assert.equal(quick.reviewed, false);
assert.equal(quick.caption, postCaption(quick, restaurant));
assert.match(
  updatePost(quick, { showPrice: true }, restaurant).caption,
  /18\.50/,
);
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
// Framing, slide headlines and order never ask for a caption review.
const customCombo = updatePost(combo, { caption: "Two ways." }, restaurant);
const [first, second] = customCombo.items;
for (const items of [
  [{ ...first, layouts: { feed: { zoom: 1.4, autoFrame: false } } }, second],
  [first, { ...second, headline: "Stacked high" }],
  [second, first],
])
  assert.equal(
    updatePost(customCombo, { items }, restaurant).captionNeedsReview,
    false,
    "A framing or slide tweak keeps a custom caption ready to export",
  );
for (const items of [
  [first],
  [{ ...first, quantity: 3 }, second],
  [first, { ...second, name: "Smash burger" }],
  [first, { ...second, facts: { price: 1900 } }],
])
  assert.equal(
    updatePost(customCombo, { items }, restaurant).captionNeedsReview,
    true,
    "Changed dishes, quantities, names or prices still ask for a review",
  );
assert.deepEqual(
  updatePost(combo, { items: [item] }, restaurant).channels,
  ["feed"],
  "Removing the second dish removes the unavailable carousel format",
);
// The headline, description and price follow the dishes until the owner edits them.
const burgerDish = {
  id: "burger",
  name: "The house burger",
  description: "Beef, cheddar and pickles",
  price: 1650,
};
const burgerPost = postFromPhoto(
  { template: "chef" },
  burgerDish,
  { id: "approved-burger" },
  restaurant,
);
const pastaItem = {
  dishId: "pasta",
  photoId: "approved-pasta",
  name: "Tomato pasta",
  quantity: 1,
  facts: { name: "Tomato pasta", description: "Our real pasta", price: 1850 },
};
const burrataItem = {
  dishId: "burrata",
  photoId: "approved-burrata",
  name: "Burrata",
  quantity: 1,
  facts: {
    name: "Burrata",
    description: "With heirloom tomatoes",
    price: 1400,
  },
};
const groupAssets = [
  { id: "approved-burger", dish_id: "burger", approved_at: "2026-09-15" },
  { id: "approved-pasta", dish_id: "pasta", approved_at: "2026-09-15" },
  { id: "approved-burrata", dish_id: "burrata", approved_at: "2026-09-15" },
];
const [burgerItem] = burgerPost.items;
let three = updatePost(
  burgerPost,
  { items: [burgerItem, pastaItem] },
  restaurant,
);
three = updatePost(three, { items: [...three.items, burrataItem] }, restaurant);
three = updatePost(three, { showPrice: true }, restaurant);
assert.equal(
  three.title,
  "The house burger, Tomato pasta & Burrata",
  "Several dishes share a headline that lists them, not the first dish’s name",
);
assert.equal(three.description, "", "No one dish describes a group");
assert.equal(three.price, "", "A group needs its own offer price");
assert.match(postDetailError(three, groupAssets), /Enter the price/);
assert.doesNotMatch(three.caption, /Beef|16\.50/);
const swapped = updatePost(
  updatePost(burgerPost, { items: [burgerItem, pastaItem] }, restaurant),
  { items: [pastaItem] },
  restaurant,
);
assert.deepEqual(
  [swapped.title, swapped.description, swapped.price],
  ["Tomato pasta", "Our real pasta", "18.50"],
  "Removing the first dish retitles the post for the dish that remains",
);
assert.doesNotMatch(swapped.caption, /burger|Beef|16\.50/);
assert.match(swapped.caption, /Tomato pasta\nOur real pasta/);
assert.equal(
  updatePost(three, { items: [pastaItem, burgerItem, burrataItem] }, restaurant)
    .title,
  "Tomato pasta, The house burger & Burrata",
  "Reordering keeps the list in the new order",
);
const owned = updatePost(
  burgerPost,
  { title: "Burger night", price: "12" },
  restaurant,
);
const ownedGroup = updatePost(
  owned,
  { items: [burgerItem, pastaItem] },
  restaurant,
);
assert.deepEqual(
  [ownedGroup.title, ownedGroup.price, ownedGroup.description],
  ["Burger night", "12", ""],
  "The owner’s own headline and price stay; untouched words still follow",
);
assert.equal(
  updatePost(ownedGroup, { items: [pastaItem] }, restaurant).title,
  "Burger night",
);
const legacyWords = updatePost(
  { ...base, description: "Our pasta, as always" },
  { items: [item, { ...pastaItem, dishId: "pasta-2" }] },
  restaurant,
);
assert.equal(
  legacyWords.description,
  "Our pasta, as always",
  "Saved drafts without dish facts keep their description",
);
const longNames = ["Slow-roasted chicken", "Charred broccolini", "Pavlova"].map(
  (name, n) => ({ ...pastaItem, dishId: "d" + n, name }),
);
assert.equal(
  updatePost(burgerPost, { items: [burgerItem, ...longNames] }, restaurant)
    .title,
  "The house burger & 3 more",
  "A long list stays short enough for a headline",
);

// A signup placeholder never stays in the caption once the name is fixed.
const unnamed = postFromPhoto(
  {},
  burgerDish,
  { id: "approved-burger" },
  { name: "Your restaurant", currency: "USD" },
);
assert.equal(captionPlaceholder(unnamed.caption), "Your restaurant");
const renamed = { ...unnamed, ...currentCaption(unnamed, restaurant) };
assert.match(renamed.caption, /\nThe Orchard Kitchen$/);
assert.equal(captionPlaceholder(renamed.caption), "");
assert.deepEqual(
  currentCaption({ ...unnamed, captionMode: "custom" }, restaurant),
  {},
  "The owner’s own caption is never rewritten",
);
assert.equal(
  captionPlaceholder("Join us at Your restaurant tonight!"),
  "Your restaurant",
);
assert.equal(captionPlaceholder("Make us your restaurant of choice."), "");

assert.equal(postDetailError(base, assets), "");
assert.match(
  postDetailError(base, []),
  /The photo of Tomato pasta is no longer available/,
  "A deleted photo names its dish",
);
assert.match(
  postDetailError(base, [{ ...assets[0], needs_correction: 1 }]),
  /The photo of Tomato pasta was reported as not matching the food/,
  "A photo reported with “Something changed in my food” can’t be shared",
);
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

// Switching designs keeps the owner's words, choices and colors.
const designed = {
  template: "chef",
  kicker: "Tonight only",
  cta: "Book a table",
  textMode: "full",
  showBrand: false,
  typography: "bold",
  color: "#235b48",
  accent: "#e7efb7",
  brandMode: "custom",
  chosen: ["textMode", "showBrand"],
};
const kept = (draft) =>
  [
    "kicker",
    "cta",
    "textMode",
    "showBrand",
    "typography",
    "color",
    "accent",
  ].map((key) => draft[key]);
let redesigned = designed;
for (const id of ["special", "launch", "afterdark", "chef"])
  redesigned = { ...redesigned, ...applyPostTemplate(redesigned, id) };
assert.deepEqual(
  kept(redesigned),
  kept(designed),
  "A new design keeps the small heading, call to action, text, name toggle, typeface and colors",
);
const plain = {
  template: "chef",
  kicker: "",
  cta: "",
  textMode: "minimal",
  showBrand: true,
  typography: "template",
  color: "#235b48",
  accent: "#e7efb7",
  brandMode: "restaurant",
};
const launch = { ...plain, ...applyPostTemplate(plain, "launch") };
assert.deepEqual(
  [launch.kicker, launch.textMode, launch.showBrand, launch.color],
  ["ON THE MENU", "minimal", false, "#235b48"],
  "Unchanged settings follow each design; the restaurant’s colors stay",
);
const photoFirst = { ...launch, ...applyPostTemplate(launch, "editorial") };
assert.deepEqual(
  [photoFirst.kicker, photoFirst.textMode],
  ["", "photo"],
  "A design’s own suggestion doesn’t follow the owner to the next design",
);
assert.deepEqual(
  kept({ ...plain, ...applyPostTemplate(plain, "special") }).slice(5),
  ["#235b48", "#e7efb7"],
);
const savedDraft = { ...plain, textMode: "full" };
assert.equal(
  applyPostTemplate(savedDraft, "launch").textMode,
  "full",
  "A saved draft’s own text choice counts as the owner’s",
);
console.log("Post flow: 18 assertions passed");
