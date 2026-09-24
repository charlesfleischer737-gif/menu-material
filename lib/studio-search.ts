import { photoStyles, type PhotoStyle } from "./photo-styles";
import { studioOccasions } from "./studio-occasions";
import type { SavedLook } from "./studio-library";

export const maximumStyleQueryLength = 180;
const normalizeStyleQuery = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const stopWords = new Set([
  "a",
  "an",
  "the",
  "for",
  "on",
  "with",
  "at",
  "in",
  "of",
  "my",
  "me",
  "i",
  "want",
  "please",
  "show",
  "some",
  "style",
  "styles",
  "look",
  "looks",
  "photo",
  "photos",
  "picture",
  "pictures",
  "background",
  "backdrop",
]);
const synonyms: Record<string, string[]> = {
  cozy: ["warm", "candle", "cafe"],
  cosy: ["warm", "candle", "cafe"],
  cafe: ["cafe", "coffee"],
  coffee: ["coffee", "cafe"],
  shop: ["cafe", "counter"],
  dark: ["dark", "charcoal", "black", "moody", "shadow"],
  black: ["black", "charcoal", "graphite", "obsidian"],
  bright: ["bright", "white", "daylight", "luminous"],
  white: ["white", "ivory", "pale"],
  wood: ["wood", "oak", "walnut"],
  marble: ["marble"],
  table: ["table", "surface", "counter"],
  colorful: ["color", "cobalt", "coral", "pastel", "vivid"],
  colourful: ["color", "cobalt", "coral", "pastel", "vivid"],
  blue: ["blue", "cobalt", "cornflower"],
  cocktail: ["cocktail", "bar", "lounge"],
  cocktails: ["cocktail", "bar", "lounge"],
  night: ["night", "evening", "midnight", "after dark"],
  outdoor: ["outdoor", "terrace", "garden", "courtyard"],
  romantic: ["romantic", "candle", "velvet", "intimate"],
  burger: ["burger", "sandwich"],
  italian: ["pasta", "bistro", "rustic", "wine"],
  overhead: ["overhead", "flat lay"],
  top: ["overhead", "top down"],
  down: ["overhead", "top down"],
  menu: ["menu", "catalog", "ordering", "delivery"],
};
// One insertion, deletion, substitution or adjacent transposition. Work stays
// linear in token length instead of allocating a matrix per catalog word.
function oneEdit(a: string, b: string) {
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length)
    return (
      a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] &&
        a[i + 1] === b[i] &&
        a.slice(i + 2) === b.slice(i + 2))
    );
  return a.length > b.length
    ? a.slice(i + 1) === b.slice(i)
    : a.slice(i) === b.slice(i + 1);
}
function queryTokens(query: string) {
  return normalizeStyleQuery(query)
    .split(" ")
    .filter(
      (token) =>
        token &&
        !stopWords.has(token) &&
        !(
          token.length >= 6 &&
          [...stopWords].some(
            (word) => word.length >= 6 && oneEdit(token, word),
          )
        ),
    );
}
type SearchDocument = {
  name: string;
  fields: { text: string; weight: number }[];
  text: string;
  words: string[];
};
const documents = new WeakMap<PhotoStyle, SearchDocument>();
function documentFor(style: PhotoStyle): SearchDocument {
  const cached = documents.get(style);
  if (cached) return cached;
  const fields = [
    { text: style.name, weight: 50 },
    { text: style.cue, weight: 25 },
    { text: (style.traits || []).join(" "), weight: 20 },
    { text: style.description || "", weight: 12 },
    { text: style.bestFor || "", weight: 16 },
    { text: style.group, weight: 10 },
    {
      text: studioOccasions
        .filter((o) => (o.looks as readonly string[]).includes(style.id))
        .map((o) => o.keywords)
        .join(" "),
      weight: 30,
    },
  ].map((field) => ({ ...field, text: normalizeStyleQuery(field.text) }));
  const text = fields.map((field) => field.text).join(" ");
  const document = {
    name: normalizeStyleQuery(style.name),
    fields,
    text,
    words: [...new Set(text.split(" "))],
  };
  documents.set(style, document);
  return document;
}
function contains(text: string, term: string) {
  return term.includes(" ")
    ? ` ${text} `.includes(` ${term} `)
    : text
        .split(" ")
        .some(
          (word) =>
            word === term || (term.length >= 3 && word.startsWith(term)),
        );
}
function literal(document: SearchDocument, token: string) {
  return (
    contains(document.text, token) ||
    (synonyms[token] || []).some((term) => contains(document.text, term))
  );
}
export function styleMoods(style: PhotoStyle) {
  const text = documentFor(style).text;
  return [
    /bright|white|daylight|luminous|ivory/.test(text) && "Bright",
    /warm|wood|golden|candle|cafe|oak|rustic/.test(text) && "Warm",
    /dark|charcoal|black|moody|shadow|evening/.test(text) && "Dark",
    /color|cobalt|coral|pastel|pink/.test(text) && "Colorful",
  ].filter(Boolean) as string[];
}
export function searchStyles(
  query: string,
  mood = "All",
  catalog = photoStyles,
) {
  if (query.length > maximumStyleQueryLength)
    return {
      styles: [] as PhotoStyle[],
      related: false,
      relatedIds: [] as string[],
    };
  const normalized = normalizeStyleQuery(query),
    tokens = queryTokens(query);
  const indexed = catalog.map((style) => ({
    style,
    document: documentFor(style),
  }));
  // A known word such as "wood" must not become "food" merely because a
  // category filter or private collection contains no wood treatment.
  const vocabulary = [
    ...photoStyles.map(documentFor),
    ...indexed.map((item) => item.document),
  ];
  const fuzzy = new Set(
    tokens.filter((token) => !vocabulary.some((doc) => literal(doc, token))),
  );
  const scored = indexed
    .map(({ style, document }, index) => {
      const scores = tokens.map((token) => {
        const direct = document.fields.reduce(
          (best, field) =>
            contains(field.text, token) ? Math.max(best, field.weight) : best,
          0,
        );
        if (direct) return { score: direct, direct: true };
        if (
          (synonyms[token] || []).some((term) => contains(document.text, term))
        )
          return { score: 5, direct: false };
        if (
          fuzzy.has(token) &&
          document.words.some((word) => oneEdit(token, word))
        )
          return { score: 1, direct: false };
        return { score: 0, direct: false };
      });
      return {
        style,
        index,
        matches: scores.every((s) => s.score),
        direct: scores.every((s) => s.direct),
        score:
          scores.reduce((sum, s) => sum + s.score, 0) +
          (normalized && document.name === normalized ? 10000 : 0),
      };
    })
    .filter(
      (item) =>
        item.matches &&
        (mood === "All" || styleMoods(item.style).includes(mood)),
    )
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return {
    styles: scored.map((item) => item.style),
    relatedIds: scored
      .filter((item) => !item.direct)
      .map((item) => item.style.id),
    related:
      !!tokens.length && !!scored.length && !scored.some((item) => item.direct),
  };
}
export function findStyles(query: string, mood = "All", catalog = photoStyles) {
  return searchStyles(query, mood, catalog).styles;
}
export function findOccasions(
  query: string,
  collections = [...studioOccasions],
  disabledStyleIds: string[] = [],
) {
  if (query.length > maximumStyleQueryLength) return [];
  const tokens = queryTokens(query);
  return collections.filter((occasion) => {
    if (!occasion.looks.some((id) => !disabledStyleIds.includes(id)))
      return false;
    const text = normalizeStyleQuery(
      `${occasion.name} ${occasion.keywords} ${occasion.description}`,
    );
    return tokens.every(
      (token) =>
        contains(text, token) ||
        text.split(" ").some((word) => oneEdit(token, word)),
    );
  });
}
export type StudioSearchShortcut = {
  id: string;
  section: "surface" | "plate" | "lighting" | "framing";
  title: string;
  description: string;
  action: string;
};
export function styleSearchShortcut(
  query: string,
  family = "",
): StudioSearchShortcut | null {
  if (query.length > maximumStyleQueryLength) return null;
  const text = normalizeStyleQuery(query);
  if (
    /(keep|same|original|do not change|don t change).*(plate|bowl|glass|cup|serving dish|packaging)/.test(
      text,
    )
  )
    return {
      id: "keep-serving-dish",
      section: "plate",
      title: family === "Drinks" ? "Keep my glass" : "Keep my serving dish",
      description:
        family === "Drinks"
          ? "Use the original glass and label from your photo."
          : "Keep the plate, glass or packaging from your original photo.",
      action:
        family === "Drinks"
          ? "Review glass settings"
          : "See serving-dish options",
    };
  if (/(white|new|change|choose).*(plate|bowl|serving dish)/.test(text))
    return {
      id: "serving-dish",
      section: "plate",
      title:
        family === "Drinks"
          ? "Your glass stays yours"
          : "Choose your serving dish",
      description:
        family === "Drinks"
          ? "Glass replacement is not available. Drink photos keep the original glass."
          : "Keep yours, use simple white, or follow the selected look.",
      action:
        family === "Drinks"
          ? "Review glass settings"
          : "See serving-dish options",
    };
  if (
    /(custom|choose|change|build|remove).*(background|setting|components)|build.*my own/.test(
      text,
    )
  )
    return {
      id: "setting",
      section: "surface",
      title: "Choose a setting",
      description:
        "Make the current look your own with a different surface and background.",
      action: "See setting options",
    };
  if (/(change|adjust|choose).*(light|lighting)/.test(text))
    return {
      id: "lighting",
      section: "lighting",
      title: "Choose the light",
      description:
        "Compare the look’s lighting with soft daylight or a warmer treatment.",
      action: "See lighting options",
    };
  if (
    /room around|space around|whole (dish|plate)|keep.*angle|change.*angle/.test(
      text,
    )
  )
    return {
      id: "framing",
      section: "framing",
      title: "Frame your dish",
      description:
        "Keep the original angle and choose how much room surrounds the dish.",
      action: "See framing options",
    };
  return null;
}
export function searchSavedLooks(query: string, saved: SavedLook[]) {
  const entries = saved.map((look) => {
    const base = photoStyles.find((style) => style.id === look.recipe.look);
    return {
      id: look.id,
      name: look.name,
      group: "Saved",
      image: "",
      prompt: "",
      cue: [
        look.recipe.surface,
        look.recipe.lighting,
        look.recipe.composition,
        look.recipe.plate === "white"
          ? "White plate serving dish"
          : look.recipe.plate === "keep"
            ? "Original serving dish plate glass"
            : "Style serving dish",
        look.recipe.angle === "overhead"
          ? "Overhead top down"
          : look.recipe.angle === "three-quarter"
            ? "Angled view"
            : "Original angle",
        look.recipe.photoStyleSnapshot,
        studioOccasions.find(
          (occasion) => occasion.id === look.recipe.occasionId,
        )?.keywords,
        base?.name,
        base?.cue,
      ]
        .filter(Boolean)
        .join(" "),
    };
  });
  const byId = new Map(saved.map((look) => [look.id, look]));
  return findStyles(query, "All", entries).map((style) => byId.get(style.id)!);
}
