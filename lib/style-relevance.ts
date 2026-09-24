import type { Row } from "./client";
import { photoStyles, type PhotoStyle } from "./photo-styles";
import { recommendedPhotoStyles } from "./studio-onboarding";
import { styleMoods } from "./studio-search";

// Everything the studio knows about the photo and restaurant that makes one
// look more fitting than another. Only confirmed analysis may set family,
// drinkKind or subject; an unconfirmed guess must never steer suggestions.
export type StyleRelevanceContext = {
  family?: string;
  drinkKind?: string;
  subject?: string;
  drink?: boolean;
  destination?: string;
  cuisine?: string;
  favorites?: readonly string[];
  recent?: readonly string[];
  unavailable?: readonly string[];
};

// Versatile, clearly different looks for a photo we know nothing about yet.
// None adds hands or packaging, and together they span light, dark and color.
const generalPicks = {
  food: [
    "menu-wood",
    "delivery-white",
    "fine-slate",
    "menu-stone",
    "studio-color",
    "fine-linen",
    "menu-courtyard",
    "studio-dark",
    "menu-neutral",
    "fine-candle",
    "studio-pastel",
    "fine-terrace",
  ],
  drink: [
    "beverage-cafe",
    "bar-velvet",
    "beverage-backlit",
    "bar-speakeasy",
    "beverage-citrus",
    "bar-bluehour",
    "beverage-botanical",
    "bar-rooftop",
    "beverage-orchid",
  ],
};
const familyTerms: Record<string, string[]> = {
  "Plated mains": [
    "entree",
    "main",
    "plate",
    "plated",
    "steak",
    "duck",
    "roast",
    "pasta",
    "risotto",
    "seafood",
    "fish",
    "lamb",
    "grilled",
    "tasting",
    "signature",
    "starter",
    "crudo",
    "tartare",
    "carpaccio",
    "special",
    "comfort",
    "dinner",
    "noodle",
    "sushi",
  ],
  "Burgers & sandwiches": [
    "burger",
    "sandwich",
    "sub",
    "wrap",
    "bao",
    "taco",
    "lunch",
  ],
  Pizza: ["pizza", "flatbread"],
  "Bowls & salads": [
    "bowl",
    "salad",
    "poke",
    "grain",
    "falafel",
    "plant",
    "vegetable",
  ],
  Desserts: [
    "dessert",
    "cake",
    "cheesecake",
    "gelato",
    "sweet",
    "tart",
    "pastry",
    "pastries",
    "macaron",
    "confection",
    "croissant",
    "viennoiserie",
    "eclair",
    "choux",
    "muffin",
    "scone",
    "cinnamon",
    "galette",
    "pie",
    "treat",
    "entremet",
  ],
  Takeout: [
    "takeout",
    "takeaway",
    "delivery",
    "boxed",
    "packaging",
    "fried",
    "tender",
    "snack",
  ],
};
const drinkTerms: Record<string, string[]> = {
  beer: ["beer", "stout", "ale", "pint", "draft", "lager"],
  wine: ["wine", "cellar", "champagne", "sparkling"],
  cocktail: [
    "cocktail",
    "martini",
    "spritz",
    "paloma",
    "coupe",
    "negroni",
    "margarita",
    "aperitif",
  ],
  spirits: ["whiskey", "whisky", "spirit", "bourbon"],
  coffee: ["coffee", "latte", "cappuccino", "flat", "cafe"],
  tea: ["tea", "matcha", "infusion", "herbal", "chai"],
  juice: ["juice", "lemonade", "citrus", "refresher"],
  smoothie: ["smoothie", "shake", "fruit"],
  other: [],
};
// Everyday dish words mapped onto the vocabulary the catalog is written in.
const subjectSynonyms: Record<string, string> = {
  spaghetti: "pasta",
  linguine: "pasta",
  penne: "pasta",
  rigatoni: "pasta",
  tagliatelle: "pasta",
  fettuccine: "pasta",
  pappardelle: "pasta",
  lasagna: "pasta",
  lasagne: "pasta",
  ravioli: "pasta",
  gnocchi: "pasta",
  carbonara: "pasta",
  bolognese: "pasta",
  macaroni: "pasta",
  cheeseburger: "burger",
  hamburger: "burger",
  smashburger: "burger",
  panini: "sandwich",
  baguette: "sandwich",
  hoagie: "sub",
  burrito: "wrap",
  quesadilla: "wrap",
  shawarma: "wrap",
  gyro: "wrap",
  ramen: "noodle",
  pho: "noodle",
  udon: "noodle",
  soba: "noodle",
  sashimi: "sushi",
  nigiri: "sushi",
  maki: "sushi",
  ribeye: "steak",
  sirloin: "steak",
  tenderloin: "steak",
  brisket: "steak",
  salmon: "seafood",
  tuna: "seafood",
  shrimp: "seafood",
  prawn: "seafood",
  scallop: "seafood",
  oyster: "seafood",
  lobster: "seafood",
  crab: "seafood",
  octopus: "seafood",
  calamari: "seafood",
  donut: "dessert",
  doughnut: "dessert",
  brownie: "dessert",
  cookie: "dessert",
  cupcake: "cake",
  tiramisu: "dessert",
  mousse: "dessert",
  pudding: "dessert",
  sorbet: "gelato",
  icecream: "gelato",
  pancake: "brunch",
  waffle: "brunch",
  omelette: "brunch",
  americano: "coffee",
  mocha: "coffee",
  macchiato: "coffee",
  cortado: "coffee",
  mojito: "cocktail",
  manhattan: "cocktail",
  ipa: "beer",
  pilsner: "beer",
  lager: "beer",
  fries: "fried",
  wings: "fried",
  nuggets: "tender",
};
// How well each collection suits a subject when nothing more specific is known.
const familyPriors: Record<string, Record<string, number>> = {
  "Plated mains": { menu: 8, fine: 8, studio: 4, delivery: 2, bar: 1 },
  "Burgers & sandwiches": { delivery: 8, studio: 6, menu: 6, bar: 3, fine: 1 },
  Pizza: { delivery: 8, menu: 8, studio: 3, bar: 2, fine: 1 },
  "Bowls & salads": { delivery: 8, menu: 8, studio: 4, fine: 4 },
  Desserts: { bakery: 10, studio: 8, fine: 4, menu: 3, delivery: 2 },
  Takeout: { delivery: 10, studio: 4, menu: 3, bar: 1 },
  "": { menu: 6, delivery: 5, studio: 5, fine: 5, bakery: 3, bar: 1 },
};
// Daytime drinks belong in cafés and sunlight; spirits and wine after dark.
const drinkPriors: Record<string, Record<string, number>> = {
  coffee: { beverage: 10, bar: -4 },
  tea: { beverage: 10, bar: -4 },
  juice: { beverage: 10, bar: -4 },
  smoothie: { beverage: 10, bar: -4 },
  beer: { bar: 10 },
  wine: { bar: 10 },
  cocktail: { bar: 10, beverage: 2 },
  spirits: { bar: 10 },
  other: { beverage: 6, bar: 6 },
};
const destinationPriors: Record<string, Record<string, number>> = {
  delivery: { delivery: 8, studio: 2 },
  social: { studio: 6, fine: 2, menu: 2, bakery: 2, bar: 2 },
  print: { fine: 4, menu: 4 },
  menu: { menu: 4, fine: 2, delivery: 2 },
};
// What the restaurant serves is a strong hint before the photo is understood.
const cuisinePriors: [RegExp, Record<string, number>][] = [
  [/bak|patiss|pastr|dessert|cake|donut|doughnut|sweet/, { bakery: 48 }],
  [/cafe|coffee|espresso|tea|brunch|breakfast/, { beverage: 20, bakery: 20 }],
  [/\bbar\b|pub|lounge|cocktail|wine|brew|tavern|speakeasy/, { bar: 24 }],
  [/fine|tasting|omakase|gastronom|bistro|brasserie/, { fine: 16 }],
  [/truck|takeaway|takeout|delivery|fast|quick|grill/, { delivery: 16 }],
  [/pizz|diner|family|neighbou?rhood|trattoria/, { menu: 8 }],
];

const normalize = (value = "") =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const stop = new Set(
  "and the with from our your one two some served glass cup plate bowl side topped".split(
    " ",
  ),
);
function words(value = "") {
  return normalize(value)
    .split(" ")
    .filter((word) => word.length > 2 && !stop.has(word));
}
function subjectWords(value = "") {
  const text = normalize(value).replace(/\bice cream\b/g, "icecream");
  return [
    ...new Set(
      words(text).flatMap((word) =>
        subjectSynonyms[word] ? [word, subjectSynonyms[word]] : [word],
      ),
    ),
  ];
}
// Plural-tolerant: "burgers" matches "burger", "sandwiches" matches "sandwich".
function same(a: string, b: string) {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return (
    long === short + "s" ||
    long === short + "es" ||
    (short.length >= 5 &&
      long.startsWith(short) &&
      long.length - short.length <= 3)
  );
}
const mentions = (text: string[], terms: readonly string[]) =>
  terms.filter((term) => text.some((word) => same(word, term))).length;

type StyleText = { bestFor: string[]; other: string[]; specialized: boolean };
const texts = new WeakMap<PhotoStyle, StyleText>();
function textFor(style: PhotoStyle) {
  let text = texts.get(style);
  if (!text) {
    const scene = normalize(
      [style.name, style.cue, ...(style.traits || [])].join(" "),
    );
    text = {
      bestFor: words(style.bestFor),
      other: words(
        [style.name, style.cue, style.description, ...(style.traits || [])]
          .filter(Boolean)
          .join(" "),
      ),
      // Hands in frame or takeaway packaging suit fewer dishes and restaurants.
      specialized: /\bhands?\b|hand held|takeout|takeaway/.test(scene),
    };
    texts.set(style, text);
  }
  return text;
}

/** Drink photos keep their glass: only drink looks suit them, and vice versa. */
export function suitsSubject(style: PhotoStyle, drink = false) {
  const category = style.category || "";
  return drink
    ? ["bar", "beverage"].includes(category)
    : category !== "beverage";
}

function relevantTerms(context: StyleRelevanceContext) {
  return context.drink
    ? drinkTerms[context.drinkKind || "other"] || []
    : familyTerms[context.family || ""] || [];
}

function scoreStyle(
  style: PhotoStyle,
  context: StyleRelevanceContext,
  curated: string[],
  general: string[],
  subject: string[],
) {
  const category = style.category || "";
  const family = context.family || "";
  const text = textFor(style);
  let score = 0;
  const pick = curated.indexOf(style.id);
  if (pick >= 0) score += 100 - pick * 5;
  const generalPick = general.indexOf(style.id);
  if (generalPick >= 0) score += 40 - generalPick * 2;
  let matched = 0;
  if (family && style.subjects?.length) {
    if (style.subjects.includes(family)) {
      score += 16;
      matched++;
    } else score -= 8;
  } else if (family) {
    const terms = relevantTerms(context);
    const strong = Math.min(2, mentions(text.bestFor, terms));
    matched += strong;
    score +=
      strong * (context.drink ? 10 : 8) +
      Math.min(2, mentions(text.other, terms)) * 2;
  }
  if (subject.length) {
    const strong = Math.min(3, mentions(text.bestFor, subject));
    matched += strong;
    score += strong * 6 + Math.min(2, mentions(text.other, subject)) * 2;
  }
  if (text.specialized && pick < 0 && !matched) score -= 10;
  score += context.drink
    ? drinkPriors[context.drinkKind || "other"]?.[category] ||
      drinkPriors.other[category] ||
      0
    : (familyPriors[family] || familyPriors[""])[category] || 0;
  score += destinationPriors[context.destination || ""]?.[category] || 0;
  // Once the photo itself is understood, the restaurant type only nudges.
  const cuisine = normalize(context.cuisine);
  if (cuisine)
    for (const [pattern, priors] of cuisinePriors)
      if (pattern.test(cuisine))
        score += (priors[category] || 0) * (family ? 0.2 : 1);
  // A favorite or a look this restaurant keeps using is a strong signal of
  // taste, unless the photo is clearly something the look wasn't made for.
  const fits = !family || pick >= 0 || matched > 0;
  if (context.favorites?.includes(style.id)) score += fits ? 45 : 12;
  const recent = context.recent?.indexOf(style.id) ?? -1;
  if (recent >= 0) score += (fits ? 28 : 8) + Math.max(0, 12 - recent * 3);
  return score;
}

/**
 * Every eligible look, most relevant first. Ties keep catalog order, so the
 * ranking is stable for a given photo, restaurant and catalog version.
 */
export function rankStyles(
  context: StyleRelevanceContext = {},
  catalog: PhotoStyle[] = photoStyles,
) {
  const curated = context.family
    ? recommendedPhotoStyles(
        context.family,
        context.destination,
        context.drinkKind,
      ).map((style) => style.id)
    : [];
  const general = context.family
    ? []
    : generalPicks[context.drink ? "drink" : "food"];
  const subject = subjectWords(context.subject);
  return catalog
    .map((style, index) => ({ style, index }))
    .filter(
      ({ style }) =>
        !style.legacy &&
        !context.unavailable?.includes(style.id) &&
        suitsSubject(style, !!context.drink),
    )
    .map((entry) => ({
      ...entry,
      score: scoreStyle(entry.style, context, curated, general, subject),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

/**
 * A short, varied set of the most relevant looks. Repeating a collection or
 * a mood costs a little relevance, so the first screen shows a real range of
 * light, color and setting instead of near-duplicates.
 */
export function suggestedStyles(
  context: StyleRelevanceContext = {},
  count = 12,
  catalog: PhotoStyle[] = photoStyles,
) {
  const pool = rankStyles(context, catalog).map((entry) => ({
    ...entry,
    category: entry.style.category || "",
    mood: styleMoods(entry.style)[0] || "",
  }));
  const picked: PhotoStyle[] = [];
  const repeats = new Map<string, number>();
  while (picked.length < count && pool.length) {
    let best = 0,
      bestValue = -Infinity;
    for (let index = 0; index < pool.length; index++) {
      const { score, category, mood } = pool[index];
      const value =
        score -
        4 * (repeats.get("c:" + category) || 0) -
        4 * (mood ? repeats.get("m:" + mood) || 0 : 0);
      if (value > bestValue) {
        bestValue = value;
        best = index;
      }
    }
    const [{ style, category, mood }] = pool.splice(best, 1);
    picked.push(style);
    repeats.set("c:" + category, (repeats.get("c:" + category) || 0) + 1);
    if (mood) repeats.set("m:" + mood, (repeats.get("m:" + mood) || 0) + 1);
  }
  return picked;
}

// The studio asks for the same suggestions on every render; the result is a
// pure function of the context, so the last answer is reused until it changes.
let lastSuggestions = { key: "", styles: [] as PhotoStyle[] };
export function cachedSuggestions(context: StyleRelevanceContext, count = 12) {
  const key = JSON.stringify([context, count]);
  if (key !== lastSuggestions.key)
    lastSuggestions = { key, styles: suggestedStyles(context, count) };
  return lastSuggestions.styles;
}

const subjectLabels: Record<string, string> = {
  "Plated mains": "plated dishes",
  "Burgers & sandwiches": "burgers and sandwiches",
  Pizza: "pizza",
  "Bowls & salads": "bowls and salads",
  Desserts: "desserts",
  Takeout: "takeout",
  Drinks: "drinks",
};
const drinkLabels: Record<string, string> = {
  beer: "beer",
  wine: "wine",
  cocktail: "cocktails",
  spirits: "spirits",
  coffee: "coffee",
  tea: "tea",
  juice: "juices",
  smoothie: "smoothies",
};
/** Plain words for what suggestions are based on, e.g. "coffee". */
export function subjectLabel(family = "", drinkKind = "") {
  return family === "Drinks"
    ? drinkLabels[drinkKind] || subjectLabels.Drinks
    : subjectLabels[family] || "";
}

/** One honest reason a look was suggested, or "" when it is only general. */
export function suggestionReason(
  style: PhotoStyle,
  context: StyleRelevanceContext = {},
) {
  if (context.favorites?.includes(style.id)) return "One of your favorites";
  if (context.recent?.includes(style.id)) return "Recently used";
  const label = subjectLabel(context.family, context.drinkKind);
  if (label) {
    const curated = recommendedPhotoStyles(
      context.family,
      context.destination,
      context.drinkKind,
    ).some((entry) => entry.id === style.id);
    const terms = [...relevantTerms(context), ...subjectWords(context.subject)];
    if (curated || mentions(textFor(style).bestFor, terms))
      return `Made for ${label}`;
  }
  if (context.destination === "delivery" && style.category === "delivery")
    return "Made for delivery apps";
  return "";
}

/** The relevance context for a studio draft; guesses never count as facts. */
export function draftRelevanceContext(
  draft: Row,
  extra: Pick<
    StyleRelevanceContext,
    "cuisine" | "favorites" | "recent" | "unavailable"
  > = {},
): StyleRelevanceContext {
  const confirmed =
    draft.mode === "photo" &&
    !!draft.sourceId &&
    draft.analysisSourceId === draft.sourceId &&
    ["ready", "manual"].includes(draft.analysisStatus) &&
    !draft.menuDocument &&
    !!draft.recommendationFamily;
  return {
    family: confirmed ? draft.recommendationFamily : "",
    drinkKind:
      confirmed && draft.recommendationFamily === "Drinks"
        ? draft.recommendationDrink || "other"
        : "",
    subject: confirmed
      ? draft.analysisSubject || ""
      : draft.mode === "description"
        ? `${draft.name || ""} ${draft.description || ""}`
        : "",
    drink: draft.family === "Drinks",
    destination: draft.destination,
    ...extra,
  };
}
