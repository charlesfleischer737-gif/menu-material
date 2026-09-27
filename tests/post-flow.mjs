import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import "./photo-destinations.mjs";
import {
  postPage,
  postCaption,
  updatePost,
  postDetailError,
  postFromPhoto,
  captionPlaceholder,
  currentCaption,
  postDishNote,
} from "../lib/post-flow.ts";
import {
  applyPostTemplate,
  freePostDraft,
  newPostDraft,
} from "../lib/post-templates.ts";
import * as workspaceStatus from "../lib/workspace-status.ts";
import * as navigation from "../lib/workspace-navigation.ts";

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

// Dishes guests can't order now are named before sharing.
assert.equal(
  postDishNote(three, [
    { id: "burger", available: 1 },
    { id: "pasta", available: 0 },
    { id: "burrata", available: 1, archived_at: "2026-09-20" },
  ]),
  "Tomato pasta and Burrata are marked unavailable or archived in My Dishes. Check before sharing.",
);
assert.equal(postDishNote(three, [{ id: "burger", available: 1 }]), "");
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
  postDetailError(three, []),
  /The photos of The house burger, Tomato pasta, and Burrata are no longer available/,
  "Several dishes are listed with commas",
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

// Post Maker's drafts on Free. A post with Pro options opens and downloads,
// but it's never sent, never comes back from the tab's recovery copy, and
// never keeps the owner from a new post or another saved one.
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};
globalThis.sessionStorage = storage();
globalThis.localStorage = storage();
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
};
/** The drafts API, refusing what Free can't save as the server does. */
function draftServer() {
  const rows = new Map(),
    sent = [];
  async function api(path, body) {
    if (path.startsWith("creation-drafts?"))
      return { drafts: [...rows.values()] };
    if (path.startsWith("creation-drafts/")) {
      const row = rows.get(path.split("/")[1]);
      if (!row) throw Object.assign(Error("Not found."), { status: 404 });
      return { draft: row };
    }
    assert.equal(path, "creation-drafts");
    sent.push(body.draft);
    if (!freePostDraft(body.draft))
      throw Object.assign(Error("This post design is part of Pro."), {
        status: 402,
        code: "pro_required",
      });
    const revision = (rows.get(body.id)?.revision || 0) + 1;
    rows.set(body.id, { ...body, revision });
    return { id: body.id, revision };
  }
  return { rows, sent, api };
}
/**
 * The real useCreationDraft from creation-shared.tsx, run in a minimal hooks
 * runtime. Autosave timers never fire here: each check saves when it means to.
 */
function postDrafts(api, initial, savable) {
  const { outputText } = ts.transpileModule(
    readFileSync(
      new URL("../app/components/creation-shared.tsx", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  let slots = [],
    cursor = 0,
    effects = [],
    dirty = false,
    store;
  function effect(run, deps) {
    const index = cursor++,
      previous = slots[index];
    if (!deps || !previous || deps.some((d, i) => d !== previous.deps[i]))
      effects.push(() => {
        previous?.cleanup?.();
        slots[index] = { deps, cleanup: run() };
      });
  }
  const hooks = {
    useState(init) {
      const slot = (slots[cursor++] ||= { value: init, queue: [] });
      for (const next of slot.queue.splice(0))
        slot.value = typeof next === "function" ? next(slot.value) : next;
      return [
        slot.value,
        (next) => {
          slot.queue.push(next);
          dirty = true;
        },
      ];
    },
    useRef: (init) => (slots[cursor++] ||= { current: init }),
    useEffect: effect,
    useLayoutEffect: effect,
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((d, i) => d !== slots[index].deps[i]))
        slots[index] = { deps, callback };
      return slots[index].callback;
    },
  };
  const modules = {
    react: hooks,
    "@/lib/client": { api },
    "@/lib/workspace-status": workspaceStatus,
    "@/lib/workspace-navigation": navigation,
  };
  const shared = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    "setTimeout",
    "clearTimeout",
    outputText,
  )(
    (id) => modules[id] || {},
    shared,
    shared.exports,
    () => 0,
    () => {},
  );
  function render() {
    do {
      dirty = false;
      cursor = 0;
      store = shared.exports.useCreationDraft(
        "post",
        initial,
        "owner",
        savable,
      );
      const pending = effects;
      effects = [];
      for (const run of pending) run();
    } while (dirty);
    return store;
  }
  render();
  return {
    render,
    async settle() {
      for (let n = 0; n < 5; n++) {
        await new Promise((resolve) => setImmediate(resolve));
        render();
      }
      return store;
    },
  };
}
const kitchen = {
  ...restaurant,
  style: { primary: "#123456", accent: "#abcdef", tone: "Warm" },
};
const recoveryKey = "owner:draft:post:unsaved";
const madeOnPro = {
  ...newPostDraft(kitchen, 2, true),
  items: [item],
  title: "Tomato pasta",
};
{
  const server = draftServer();
  server.rows.set("pro", {
    id: "pro",
    kind: "post",
    draft: madeOnPro,
    revision: 1,
  });
  server.rows.set("free", {
    id: "free",
    kind: "post",
    draft: { ...newPostDraft(kitchen, 2, false), items: [item] },
    revision: 1,
  });
  localStorage.setItem("owner:draft:post", "pro");
  // What New left in this tab before the fix: a refused post in Pro colors.
  sessionStorage.setItem(
    recoveryKey,
    JSON.stringify({
      id: "refused",
      revision: 0,
      draft: newPostDraft(kitchen, 2, true),
      saved: "",
    }),
  );
  const page = postDrafts(server.api, newPostDraft(kitchen, 1, false), (d) =>
    freePostDraft(d),
  );
  let store = await page.settle();
  assert.equal(store.id, "pro", "A reload opens saved work, not the refusal");
  store.change({ title: "Pasta night" });
  store = page.render();
  assert.equal(store.status, "Changes not saved");
  assert.equal(sessionStorage.getItem(recoveryKey), null);
  await store.save();
  await store.start(newPostDraft(kitchen, 2, false));
  store = page.render();
  assert.equal(store.status, "Draft saved", "New works from a Pro post");
  assert.deepEqual(server.sent.map(freePostDraft), [true]);
  await store.resume("pro");
  page.render().change({ title: "Pasta night" });
  await page.render().resume("free");
  store = page.render();
  assert.equal(store.id, "free", "Another saved post opens from a Pro post");
  assert.equal(server.sent.length, 1, "Nothing Free can't save is sent");
}
{
  // A page that still thinks it's Pro: the server's refusal doesn't keep the
  // owner in the post either.
  const server = draftServer();
  server.rows.set("pro", {
    id: "pro",
    kind: "post",
    draft: madeOnPro,
    revision: 1,
  });
  localStorage.setItem("owner:draft:post", "pro");
  const page = postDrafts(
    server.api,
    newPostDraft(kitchen, 1, true),
    () => true,
  );
  let store = await page.settle();
  store.change({ title: "Pasta night" });
  await assert.rejects(page.render().save(), /part of Pro/);
  await page.render().start(newPostDraft(kitchen, 2, false));
  store = page.render();
  assert.equal(store.status, "Draft saved");
  assert.equal(server.rows.size, 2);
}
console.log(
  "PASS: 10 Post Maker draft checks on Free: no refused post after a reload, nothing Pro sent, and New and other saved posts always open.",
);
