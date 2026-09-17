import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { photoStyles } from "../lib/photo-styles.ts";
import {
  findStyles,
  searchStyles,
  searchSavedLooks,
  styleSearchShortcut,
  findOccasions,
  maximumStyleQueryLength,
} from "../lib/studio-search.ts";
import { studioOccasions } from "../lib/studio-occasions.ts";

globalThis.fetch = () => {
  throw Error("Search must not call an external service.");
};
const cases = JSON.parse(
  readFileSync(
    new URL("./fixtures/studio-search-queries.json", import.meta.url),
    "utf8",
  ),
);
const failures = cases.filter((entry) =>
  entry.shortcut
    ? styleSearchShortcut(entry.query)?.id !== entry.shortcut
    : !findStyles(entry.query)
        .slice(0, 5)
        .some((style) => entry.styles.includes(style.id)),
);
assert(cases.length >= 30);
for (const entry of cases)
  for (const id of entry.styles || [])
    assert(
      photoStyles.some((style) => style.id === id),
      `Unknown expected style: ${id}`,
    );
assert.equal(
  failures.length,
  0,
  `Search relevance regressed: ${failures.map((entry) => entry.query).join(", ")}`,
);
for (const style of photoStyles) {
  assert.equal(
    findStyles(style.name)[0]?.id,
    style.id,
    `Exact name: ${style.name}`,
  );
  assert.equal(findStyles(style.name.toUpperCase())[0]?.id, style.id);
}
const catalogBefore = JSON.stringify(photoStyles);
assert.deepEqual(
  findStyles("warm wood").map((s) => s.id),
  findStyles("warm wood").map((s) => s.id),
);
assert.deepEqual(
  findStyles("warm wood", "All", [
    {
      id: "food-only",
      name: "Warm food",
      cue: "Food photograph",
      group: "Example",
      image: "",
      prompt: "",
    },
  ]),
  [],
  "Known wood must not become food in a private or filtered scope",
);
assert.deepEqual(
  findStyles("red", "All", [
    {
      id: "negative",
      name: "A considered dish",
      cue: "Measured elegance",
      group: "Example",
      image: "",
      prompt: "",
    },
  ]),
  [],
  "No arbitrary substring matches",
);
assert.deepEqual(findStyles("penguin spaceships"), []);
assert.deepEqual(findStyles("x".repeat(maximumStyleQueryLength + 1)), []);
assert.equal(
  styleSearchShortcut("keep my plate " + "x".repeat(maximumStyleQueryLength)),
  null,
);
for (const query of [
  "add vegan cheese",
  "translate my menu",
  "remove a person",
  "animate my food",
  "show ingredient prices",
])
  assert.equal(styleSearchShortcut(query), null, query);
assert.equal(styleSearchShortcut("Please keep my glass")?.section, "plate");
assert.equal(
  styleSearchShortcut("keep my glass", "Drinks")?.action,
  "Review glass settings",
);
assert.match(
  styleSearchShortcut("white plate", "Drinks")?.description || "",
  /replacement is not available/,
);
assert.equal(styleSearchShortcut("choose a background")?.section, "surface");
assert.equal(styleSearchShortcut("adjust the lighting")?.section, "lighting");
assert.equal(styleSearchShortcut("space around my plate")?.section, "framing");
const related = searchStyles("charcol");
assert(related.related && related.relatedIds.length === related.styles.length);
assert(!searchStyles("Neighborhood table").relatedIds.includes("menu-wood"));
for (const result of searchStyles(
  "warm wood",
  "Warm",
  photoStyles.filter((s) => s.category === "menu"),
).styles)
  assert.equal(result.category, "menu");
assert.equal(findOccasions("foodball Sunday")[0]?.id, "game-day");
assert.equal(findOccasions("christams")[0]?.id, "christmas");
assert.equal(findOccasions("please show me Christmas")[0]?.id, "christmas");
assert.deepEqual(findOccasions("white marble"), []);
assert.deepEqual(
  findOccasions(
    "christmas",
    [...studioOccasions],
    ["fine-candle", "fine-linen", "bakery-copper"],
  ),
  [],
);

const recipe = {
  look: "menu-wood",
  surface: "Warm wood",
  lighting: "Soft daylight",
  plate: "keep",
  angle: "keep",
  composition: "Full dish",
  studioOverrides: [],
  photoStyleSnapshot: "",
  photoReferenceIds: [],
  occasionId: "",
  note: "",
};
const privateLooks = [
  { id: "saved-a", name: "Café lunch", recipe, archived: false, version: 1 },
  {
    id: "saved-b",
    name: "Evening service",
    recipe: {
      ...recipe,
      look: "studio-dark",
      surface: "As shown",
      lighting: "Warm & cozy",
      plate: "white",
    },
    archived: false,
    version: 1,
  },
  {
    id: "saved-c",
    name: "Old holiday",
    recipe: { ...recipe, occasionId: "christmas" },
    archived: true,
    version: 1,
  },
];
const privateBefore = JSON.stringify(privateLooks);
assert.equal(searchSavedLooks("cafe lunch", privateLooks)[0]?.id, "saved-a");
assert.equal(
  searchSavedLooks(
    "soft daylight",
    privateLooks.filter((s) => !s.archived),
  )[0]?.id,
  "saved-a",
);
assert.equal(searchSavedLooks("white plate", privateLooks)[0]?.id, "saved-b");
assert.equal(searchSavedLooks("charcol", privateLooks)[0]?.id, "saved-b");
assert.deepEqual(
  searchSavedLooks(
    "holiday",
    privateLooks.filter((s) => !s.archived),
  ),
  [],
);
assert.equal(
  searchSavedLooks(
    "Christmas",
    privateLooks.filter((s) => s.archived),
  )[0]?.id,
  "saved-c",
);
assert.deepEqual(searchSavedLooks("unfindable result", privateLooks), []);
assert.equal(
  JSON.stringify(privateLooks),
  privateBefore,
  "Search never edits saved recipes, archive state or names",
);
assert.equal(
  JSON.stringify(photoStyles),
  catalogBefore,
  "Search never mutates the catalog",
);

// Reproducible local CPU observation, not a throttled browser/phone performance gate.
const largeCatalog = Array.from({ length: 200 }, (_, i) => ({
  ...photoStyles[i % photoStyles.length],
  id: `fixture-${i}`,
}));
const largeLibrary = Array.from({ length: 100 }, (_, i) => ({
  ...privateLooks[i % privateLooks.length],
  id: `saved-${i}`,
}));
const samples = [];
for (let i = 0; i < 50; i++) {
  const start = performance.now();
  findStyles(cases[i % cases.length].query, "All", largeCatalog);
  searchSavedLooks(cases[i % cases.length].query, largeLibrary);
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(
  `Search: ${cases.length}/${cases.length} query fixtures, ${photoStyles.length}/${photoStyles.length} exact names, scoped matching and control routes passed.`,
);
console.log(
  `Local CPU only: 200 styles + 100 saved looks; p95 ${samples[Math.ceil(samples.length * 0.95) - 1].toFixed(1)} ms. No network or provider calls.`,
);
