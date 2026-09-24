import assert from "node:assert/strict";
const { photoStyles } = await import("../lib/photo-styles.ts");
const { foodFamilies } = await import("../lib/studio.ts");
const { drinkKinds, recommendedPhotoStyles } =
  await import("../lib/studio-onboarding.ts");
const { rankStyles, suggestedStyles, suggestionReason, subjectLabel } =
  await import("../lib/style-relevance.ts");

let checks = 0;
const ids = (styles) => styles.map((style) => style.id);
const catalogBefore = JSON.stringify(photoStyles);

// Drinks keep their glass: only drink looks are suggested, and food photos
// never receive drink-only looks.
for (const drinkKind of drinkKinds) {
  const suggestions = suggestedStyles(
    { family: "Drinks", drink: true, drinkKind, destination: "delivery" },
    12,
  );
  assert(suggestions.length >= 6, drinkKind);
  assert(
    suggestions.every((style) => ["bar", "beverage"].includes(style.category)),
    `${drinkKind} suggestions stay drink looks`,
  );
  checks++;
}
for (const family of foodFamilies.filter((family) => family !== "Drinks"))
  for (const destination of ["menu", "delivery", "social", "print"]) {
    const context = { family, destination };
    const suggestions = suggestedStyles(context, 12);
    assert.equal(suggestions.length, 12);
    assert.equal(new Set(ids(suggestions)).size, 12, "no duplicates");
    assert(
      suggestions.every((style) => style.category !== "beverage"),
      `${family} never gets drink-only looks`,
    );
    // Editorially curated picks for the subject always lead.
    assert.deepEqual(
      ids(suggestions.slice(0, 3)).sort(),
      ids(recommendedPhotoStyles(family, destination)).sort(),
      `${family}/${destination} keeps curated picks first`,
    );
    assert(
      suggestions
        .slice(0, 3)
        .every((style) =>
          suggestionReason(style, context).startsWith("Made for"),
        ),
      "curated picks carry an honest reason",
    );
    checks += 4;
  }

// Before analysis: versatile, varied looks with no hands or takeaway boxes,
// and no claim that they were chosen for the photo.
const general = suggestedStyles({ destination: "menu" }, 7);
assert.deepEqual(ids(general.slice(0, 2)), ["menu-wood", "delivery-white"]);
assert(new Set(general.map((style) => style.category)).size >= 4, "varied");
assert(
  general.every(
    (style) =>
      !/hand|takeout|takeaway/i.test(
        [style.name, style.cue, ...(style.traits || [])].join(" "),
      ),
  ),
  "general picks avoid specialized props",
);
assert(general.every((style) => suggestionReason(style, {}) === ""));
checks += 4;

// The analysis subject refines within a family.
const pasta = ids(
  suggestedStyles(
    { family: "Plated mains", subject: "Spaghetti with tomato and basil" },
    7,
  ),
);
assert(
  pasta.includes("fine-presented") || pasta.includes("menu-handheld"),
  "spaghetti finds looks written for pasta",
);
assert.equal(
  suggestedStyles(
    { family: "Drinks", drink: true, drinkKind: "coffee", subject: "Latte" },
    1,
  )[0].id,
  "beverage-cafe",
);
assert(
  suggestedStyles(
    { family: "Drinks", drink: true, drinkKind: "coffee" },
    6,
  ).every((style) => style.id !== "bar-brass"),
  "daytime coffee is not sent to a beer bar",
);
checks += 3;

// Restaurant context, favorites and recent use.
const bakery = suggestedStyles({ cuisine: "Artisan bakery" }, 7);
assert(
  bakery.filter((style) => style.category === "bakery").length >= 2,
  "a bakery sees bakery looks before its photo is analyzed",
);
const personal = ids(
  suggestedStyles(
    {
      destination: "menu",
      favorites: ["bakery-paris", "bar-candle"],
      recent: ["studio-chrome"],
    },
    7,
  ),
);
for (const id of ["bakery-paris", "bar-candle", "studio-chrome"])
  assert(personal.includes(id), `${id} is easy to find again`);
assert.equal(
  suggestionReason(
    photoStyles.find((style) => style.id === "bakery-paris"),
    {
      favorites: ["bakery-paris"],
    },
  ),
  "One of your favorites",
);
assert(
  !ids(
    suggestedStyles(
      { family: "Drinks", drink: true, favorites: ["menu-wood"] },
      12,
    ),
  ).includes("menu-wood"),
  "a food favorite is not forced onto a drink",
);
checks += 5;

// Availability, determinism and purity.
const unavailable = ["menu-wood", "delivery-white", "fine-slate"];
assert(
  suggestedStyles({ unavailable }, 12).every(
    (style) => !unavailable.includes(style.id),
  ),
);
assert.deepEqual(
  ids(rankStyles({ family: "Pizza", destination: "menu" })),
  ids(rankStyles({ family: "Pizza", destination: "menu" })),
);
assert.equal(
  rankStyles({}).length,
  photoStyles.filter((style) => style.category !== "beverage").length,
  "every food look stays reachable in the ranking",
);
assert.equal(JSON.stringify(photoStyles), catalogBefore, "catalog unchanged");
assert.equal(subjectLabel("Drinks", "cocktail"), "cocktails");
assert.equal(subjectLabel("Pizza"), "pizza");
assert.equal(subjectLabel(""), "");
checks += 7;

// Explicit subjects on future styles take precedence over inferred text.
const tagged = [
  ...photoStyles,
  {
    ...photoStyles[0],
    id: "future-pizza-oven",
    name: "Wood-fired glow",
    bestFor: "",
    subjects: ["Pizza"],
  },
];
assert(
  ids(suggestedStyles({ family: "Pizza" }, 6, tagged)).includes(
    "future-pizza-oven",
  ),
);
checks++;

// Reproducible local CPU observation for a much larger future catalog.
const large = Array.from({ length: 1000 }, (_, index) => ({
  ...photoStyles[index % photoStyles.length],
  id: `fixture-${index}`,
}));
const samples = [];
for (let run = 0; run < 20; run++) {
  const start = performance.now();
  suggestedStyles(
    { family: "Pizza", subject: "Margherita pizza", favorites: ["fixture-9"] },
    12,
    large,
  );
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(
  `Style relevance: ${checks} checks passed. Local CPU only: 1000 styles, p95 ${samples[18].toFixed(1)} ms.`,
);
