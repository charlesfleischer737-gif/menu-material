import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { exploreStyles, lookbook } from "../lib/explore-styles.ts";
import { exploreStyleSelection } from "../lib/studio-discovery.ts";
import { photoBrief, photoStyles, styleFor } from "../lib/studio.ts";
import { photoAnalysisRecommendation } from "../lib/studio-onboarding.ts";

assert.deepEqual(
  exploreStyles.map((style) => style.id).sort(),
  photoStyles
    .filter((style) => !style.legacy)
    .map((style) => style.id)
    .sort(),
  "Every catalog style appears once in Explore",
);
assert.ok(
  new Set(exploreStyles.slice(0, 9).map((style) => style.category)).size >= 6,
);

// CSS grid's sparse auto-placement: features span two columns and two rows.
function placeRows(entries, columns) {
  const cells = [];
  const free = (row, column, span) =>
    column + span <= columns &&
    Array.from({ length: span * span }).every(
      (_, cell) =>
        !cells[row + Math.floor(cell / span)]?.[column + (cell % span)],
    );
  let row = 0;
  let column = 0;
  for (const { feature } of entries) {
    const span = feature ? 2 : 1;
    while (!free(row, column, span)) {
      column += 1;
      if (column + span > columns) {
        column = 0;
        row += 1;
      }
    }
    for (let cell = 0; cell < span * span; cell++)
      (cells[row + Math.floor(cell / span)] ||= [])[column + (cell % span)] =
        true;
    column += span;
  }
  return cells.map((cells) => cells.filter(Boolean).length);
}
const complete = (rows, columns) =>
  rows.slice(0, -1).every((count) => count === columns);
const lookbookOrder = lookbook(exploreStyles);
assert.deepEqual(
  lookbookOrder.map((entry) => entry.style),
  exploreStyles,
  "Explore already follows the lookbook order",
);
assert.deepEqual(
  lookbookOrder.flatMap((entry, index) => (entry.feature ? [index] : [])),
  [0, 15, 26, 41],
  "Each part of the lookbook opens with a feature",
);
assert.ok(
  new Set(exploreStyles.slice(0, 13).map((style) => style.category)).size === 7,
  "Every collection appears before the occasions band",
);
const subsets = [
  ...exploreStyles.map((_, index) => exploreStyles.slice(0, index + 1)),
  ...exploreStyles.map((style) => exploreStyles.filter((s) => s !== style)),
  exploreStyles.filter((_, index) => index % 3),
];
for (const subset of subsets) {
  const entries = lookbook(subset);
  assert.deepEqual(
    entries.map((entry) => entry.style.id).sort(),
    subset.map((style) => style.id).sort(),
    "The lookbook shows each available look once",
  );
  for (const columns of [2, 4]) {
    assert.ok(
      complete(placeRows(entries, columns), columns),
      `${subset.length} looks leave no gaps in ${columns} columns`,
    );
    // The occasions band spans a whole row after the first 13 looks.
    if (entries.length > 13) {
      const rows = placeRows(entries.slice(0, 13), columns);
      assert.ok(
        rows.every((count) => count === columns),
        `The first 13 of ${subset.length} looks end on a full row`,
      );
    }
  }
}
for (const style of exploreStyles) {
  assert.ok(
    existsSync(`public${style.image}`),
    `${style.name} has a real image`,
  );
  assert.ok(style.description && style.bestFor && style.traits?.length);
  const selected = exploreStyleSelection(photoBrief(), style.id, {
    style: {
      autoApply: true,
      photoStyle: "restaurant default",
      referenceIds: ["restaurant-reference"],
    },
  });
  assert.equal(selected.startNew, false);
  assert.equal(selected.draft.look, style.id);
  assert.equal(selected.draft.styleIntent, true);
  assert.equal(selected.draft.styleChosen, true);
  assert.equal(selected.draft.studioDefaultResolved, true);
  assert.equal(
    selected.draft.sourceId,
    "",
    "Examples never become the user's photo",
  );
  assert.equal(selected.draft.step, 1);
  assert.notEqual(
    styleFor(selected.draft, {}).photoStyle,
    "restaurant default",
  );
  assert.deepEqual(styleFor(selected.draft, {}).referenceIds, []);
}

const current = {
  ...photoBrief(),
  sourceId: "my-photo",
  dishId: "my-dish",
  name: "My ravioli",
  look: "reference",
  referenceId: "inspiration",
  photoReferenceIds: ["inspiration"],
  photoStyleSnapshot: "previous saved look",
  savedLookId: "saved-look",
  savedLookName: "Old look",
  occasionId: "holiday",
  requestKey: "old-request",
  surface: "Warm wood",
  studioOverrides: ["surface"],
  adjustments: { ...photoBrief().adjustments, zoom: 1.2 },
};
const original = structuredClone(current);
const selected = exploreStyleSelection(current, "studio-color");
assert.equal(selected.startNew, false, "Continue the unfinished photo");
assert.deepEqual(current, original, "The old draft is never mutated");
for (const key of ["sourceId", "dishId", "name", "surface", "adjustments"])
  assert.deepEqual(
    selected.draft[key],
    current[key],
    `Keep the owner's ${key}`,
  );
assert.equal(selected.draft.savedLookName, "");
assert.equal(selected.draft.occasionId, "");
assert.equal(selected.draft.requestKey, "");
assert.equal(selected.draft.photoStyleSnapshot, null);
assert.deepEqual(styleFor(selected.draft, {}).referenceIds, []);
assert.equal(
  styleFor(selected.draft, {}).photoStyle,
  photoStyles.find((style) => style.id === "studio-color").prompt,
);

const analyzed = {
  ...selected.draft,
  ...photoAnalysisRecommendation(
    selected.draft,
    {
      confidence: "high",
      family: "Plated mains",
      subject: "Ravioli",
    },
    "my-photo",
  ),
};
assert.equal(
  analyzed.look,
  "studio-color",
  "Photo guidance cannot replace the Explore selection",
);

for (const finished of [
  { step: 4, jobId: "queued-job", resultId: "" },
  { step: 5, jobId: "old-job", resultId: "finished-photo" },
  { step: 1, jobId: "", resultId: "saved-photo" },
]) {
  const prior = { ...current, ...finished };
  const next = exploreStyleSelection(prior, "bakery-blue");
  assert.equal(
    next.startNew,
    true,
    "Save completed or queued work as a separate draft",
  );
  assert.equal(next.draft.look, "bakery-blue");
  assert.equal(next.draft.sourceId, "my-photo");
  assert.equal(next.draft.resultId, "");
  assert.equal(next.draft.jobId, "");
  assert.equal(next.draft.step, 1);
  assert.equal(prior.resultId, finished.resultId, "Keep the previous result");
  assert.equal(prior.jobId, finished.jobId, "Keep the previous job");
}
assert.equal(exploreStyleSelection(current, "missing-style"), null);
assert.equal(exploreStyleSelection(current, "restaurant"), null);
console.log(
  "Explore: complete gallery, valid images, exact style handoff, preserved photos and saved-work isolation passed.",
);
