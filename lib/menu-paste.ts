import {
  currencyDigits,
  newMenuEntry,
  type MenuDocument,
  type MenuEntry,
  type MenuSection,
} from "./menu-document";
import { dietaryTag, normalizeDietary } from "./dietary";

type Purpose = MenuDocument["purpose"];
type Uncertain = MenuEntry["sourceUncertain"][number];

// A price at the end of a line: "12", "12.50", "$12.50", "12,50 €", "1,200".
const amount = String.raw`(?:\d{1,3}(?:[,.]\d{3})+|\d{1,6})(?:[.,]\d{1,2})?`;
const price = String.raw`(?:[$€£¥]\s*)?${amount}(?:\s*[$€£¥])?`;
const endsWithPrice = new RegExp(String.raw`^(.*?)\s*(${price})$`);
const onlyPrice = new RegExp(String.raw`^${price}$`);
const marketPrice = /^(.*?)\s+(?:mp|m\.p\.|market(?: price)?)$/i;
// A price range: "38-45", "$38–$45", "38 to 45". A spaced hyphen still
// separates a name from its price ("Route 66 - 12").
const endsWithRange = new RegExp(
  String.raw`^(.*?)\s*(${price}(?:-|\s*[–—]\s*|\s+to\s+)${price})$`,
  "i",
);
// A bare 19xx or 20xx that may be a year ("Chateau Margaux 2015").
const yearLike = /^(?:19|20)\d{2}$/;
const wine =
  /(?<!\p{L})(?:wines?|vino|vins?|red|white|ros[ée]|sparkling|champagne|prosecco|cava|ch[aâ]teau|domaine|bodega|cuv[ée]e|brut|vintage|reserv[ae]|riserva|cabernet|merlot|pinot|chardonnay|sauvignon|riesling|syrah|shiraz|malbec|zinfandel|tempranillo|sangiovese|nebbiolo|grenache|rioja|barolo|chianti|bordeaux|bourgogne|burgundy|sancerre|chablis|port|sherry|bottles?)(?!\p{L})/iu;
// Lines that carry on from the dish above: "with fries", "served warm".
const continuation =
  /^(?:with|served|topped|finished|and|or|on|in|plus|includes?|choice of)(?!\p{L})/iu;
const smallWord =
  /^(?:a|an|and|the|of|to|from|with|on|in|for|by|or|de|del|la|le|les|du|des|al|alla|e|y|et)$/i;
const sizeWord =
  /^(?:x?s|m|x?l|sm|md|lg|small|medium|regular|reg\.?|large|x-large|extra[- ]large|glass|bottle|carafe|half[- ]bottle|pitcher|pint|half[- ]pint|half|full|single|double|triple|cup|bowl|slice|whole|pie|hot|iced|kids?|\d+(?:[.,]\d+)?\s*(?:oz|ml|cl|l|in|inch|["”]|pc|pcs|pieces?|ct))\.?$/i;
const addonStart = /^(?:\+|add(?:[- ]on)?\b)\s*:?\s*/i;

export const isSizeLabel = (text: string) => sizeWord.test(text.trim());
/** "Add bacon 3.00" or "+ oat milk 0.75" belongs to the dish above it. */
export const isAddonName = (name: string) => addonStart.test(name.trim());
export function addonLabel(name: string) {
  const label = name.trim().replace(addonStart, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

function cents(raw: string) {
  let value = raw.replace(/[$€£¥\s]/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(value))
    value = value.replace(/,/g, "");
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value))
    value = value.replace(/\./g, "").replace(",", ".");
  else value = value.replace(",", ".");
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100000000, Math.round(n * 100)) : null;
}
function isHeading(line: string) {
  return (
    line.endsWith(":") ||
    (line === line.toUpperCase() && /\p{L}/u.test(line) && line.length < 70)
  );
}
const dietaryLine = (line: string) =>
  !!dietaryTag(normalizeDietary([line])[0] || "");
/** "BEEF, CHEDDAR, PICKLES" or "WITH FRIES" under a dish describes it. */
const describesDish = (line: string) =>
  line.includes(",") ||
  continuation.test(line) ||
  line.split(/\s+/).length > 5 ||
  dietaryLine(line);
/**
 * "Starters", "Small Plates", "From the Grill", or a course such as "Small
 * plates" or "To share" — never a note like "Served warm" or "Vegan".
 */
function headingLike(line: string) {
  const words = line.split(/\s+/);
  if (
    words.length > 5 ||
    line.length > 40 ||
    /[\d,.;!?]/.test(line) ||
    !/^\p{Lu}/u.test(line) ||
    continuation.test(line) ||
    dietaryLine(line)
  )
    return false;
  return (
    words.every(
      (word, i) => /^[\p{Lu}&]/u.test(word) || (i > 0 && smallWord.test(word)),
    ) ||
    courseIndex(line) >= 0 ||
    /(?<!\p{L})specials?(?!\p{L})/iu.test(line)
  );
}
/** A dish named and priced on one line ("Burger 14"), not a description. */
function dishLine(line: string) {
  const head =
    sizedPrices(line)?.head ??
    (line.match(endsWithRange) ||
      line.match(endsWithPrice) ||
      line.match(marketPrice))?.[1];
  const name = head ? splitName(head).name : "";
  return (
    !!name &&
    !name.includes(",") &&
    !/^\p{Ll}/u.test(name) &&
    !isAddonName(name)
  );
}
function newSection(name: string): MenuSection {
  return {
    id: crypto.randomUUID(),
    name,
    description: "",
    pageBreakBefore: false,
    items: [],
  };
}
/** "COFFEE (12oz / 16oz)", "Wine — glass | bottle", or a "Small / Large" row. */
function sizeHeading(line: string) {
  const parts = line.replace(/[)\]:]+$/, "").split(/\s*[/|]\s*/);
  if (parts.length < 2 || parts.length > 4) return null;
  const rest = parts.slice(1);
  if (!rest.every(isSizeLabel)) return null;
  const words = parts[0].split(/\s+/);
  for (const n of [2, 1]) {
    if (words.length < n) continue;
    const label = words.slice(-n).join(" ").replace(/^[([]/, "");
    if (!isSizeLabel(label)) continue;
    const before = words.slice(0, -n).join(" ");
    const name = before.replace(/[\s([—–:-]+$/, "").trim();
    const labels = [label, ...rest].map(capitalize);
    if (!name) return { name: "", labels };
    return /[([—–:]/.test(before.slice(name.length)) || isHeading(name)
      ? { name, labels }
      : null;
  }
  return null;
}
/** "Latte 4.75 / 5.50" or "Wings 6pc 9 / 12pc 16" — two to four prices. */
function sizedPrices(line: string) {
  const parts = line.split(/\s*[/|]\s*/);
  if (parts.length < 2 || parts.length > 4) return null;
  const matches = parts.map((part) => part.match(endsWithPrice));
  if (matches.some((m) => !m)) return null;
  const [first, ...rest] = matches as RegExpMatchArray[];
  if (rest.some((m) => m[1] && !isSizeLabel(m[1]))) return null;
  let head = first[1].trim();
  const later = rest.map((m) => m[1].trim());
  let labels: string[] | null = null;
  if (later.every(Boolean)) {
    // The first size label ends the dish name: "Latte 12oz 4.75 / 16oz 5.50".
    const words = head.split(/\s+/);
    for (const n of [2, 1])
      if (words.length > n && isSizeLabel(words.slice(-n).join(" "))) {
        labels = [words.slice(-n).join(" "), ...later].map(capitalize);
        head = words.slice(0, -n).join(" ");
        break;
      }
  }
  const prices = [first[2], ...rest.map((m) => m[2])].map(cents);
  if (!head || prices.some((p) => p == null)) return null;
  return { head, labels, prices: prices as number[] };
}
function defaultSizes(count: number, section: string) {
  if (
    count === 2 &&
    /wine|vino|\bred\b|white|ros[eé]|sparkling|bubbl|champagne|prosecco/i.test(
      section,
    )
  )
    return ["Glass", "Bottle"];
  return ["Small", "Medium", "Large", "Extra large"].filter((_, index) =>
    count === 2 ? index === 0 || index === 2 : index < count,
  );
}
function splitName(head: string) {
  const [name, ...description] = head
    .replace(/[\s.·…_]{2,}$/, "")
    .split(/\s+[—–|]\s+|\s+-\s+/);
  return {
    name: name
      .trim()
      .replace(/[\s.·…_]{2,}$/, "")
      .slice(0, 120),
    description: description.join(" — ").trim(),
  };
}

/**
 * Deliberately conservative: only explicit prices at the end of a line are
 * read, and anything the reader had to guess (size names, which dish an add-on
 * belongs to, a price range, a wine's price below its vintage) is marked so
 * the owner checks it before publishing. Yen prices such as 1980 aren't
 * mistaken for years unless the line is clearly a wine.
 */
export function parsePastedMenu(
  text: string,
  options: { currency?: string } = {},
): MenuSection[] {
  const sections: MenuSection[] = [];
  const sizes = new Map<string, string[]>();
  const flags = new Map<string, Set<Uncertain>>();
  const flag = (item: MenuEntry, field: Uncertain) =>
    flags.set(item.id, new Set([...(flags.get(item.id) || []), field]));
  const yearsAreNames = currencyDigits(options.currency) > 0;
  let section = newSection("Dishes"),
    // The last line that made, priced or described the current dish.
    dishAt = -1;
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n],
      next = lines[n + 1] || "",
      previous = section.items.at(-1),
      afterDish = !!previous && dishAt === n - 1;
    const heading = sizeHeading(line);
    if (heading) {
      if (heading.name) {
        if (section.items.length) sections.push(section);
        section = newSection(heading.name);
      }
      sizes.set(section.id, heading.labels);
      continue;
    }
    if (onlyPrice.test(line)) {
      // A price on its own line belongs to the dish above it.
      if (previous && previous.priceMode === "single" && previous.price == null)
        previous.price = cents(line);
      else if (previous) {
        previous.description += (previous.description ? " " : "") + line;
        flag(previous, "price");
      } else {
        // Nothing above it to price: keep it for the owner to name.
        const entry = newMenuEntry({
          name: "",
          price: cents(line),
          sourceReviewed: false,
        });
        flag(entry, "name");
        section.items.push(entry);
      }
      dishAt = n;
      continue;
    }
    const sized = sizedPrices(line);
    const range = sized ? null : line.match(endsWithRange);
    let single = sized || range ? null : line.match(endsWithPrice);
    // A year ends a wine's name rather than giving its price.
    const vintage =
      !!single &&
      yearLike.test(single[2]) &&
      (yearsAreNames || wine.test(line) || wine.test(section.name));
    if (vintage) single = null;
    const market = sized || single || range ? null : line.match(marketPrice);
    if (
      !sized &&
      !(single && single[1].trim()) &&
      !(range && range[1].trim()) &&
      !market
    ) {
      const below = next.match(endsWithPrice);
      if (onlyPrice.test(next) && !line.endsWith(":")) {
        // A dish name with its price on the next line, even in capitals.
        const { name, description } = splitName(line);
        section.items.push(
          newMenuEntry({
            name,
            description,
            price: cents(lines[++n]),
            sourceReviewed: false,
          }),
        );
        dishAt = n;
      } else if (vintage) {
        // A wine's region and price often follow on the line below.
        const region =
          below?.[1].trim() &&
          !yearLike.test(below[2]) &&
          !sizedPrices(next) &&
          !isHeading(next)
            ? below
            : null;
        const entry = newMenuEntry({
          name: line.slice(0, 120),
          description: region
            ? region[1].replace(/[\s.·…_]{2,}$/, "").trim()
            : "",
          price: region ? cents(region[2]) : null,
          sourceReviewed: false,
        });
        if (region) {
          flag(entry, "price");
          n++;
        }
        section.items.push(entry);
        dishAt = n;
      } else if (
        (isHeading(line) && !(afterDish && describesDish(line))) ||
        (headingLike(line) && dishLine(next))
      ) {
        if (section.items.length) sections.push(section);
        section = newSection(line.replace(/:$/, ""));
      } else if (previous) {
        previous.description += (previous.description ? " " : "") + line;
        if (range) flag(previous, "price");
        dishAt = n;
      } else {
        section.items.push(
          newMenuEntry({
            name: line.slice(0, 120),
            description: line.slice(120),
            price: null,
            sourceReviewed: false,
          }),
        );
        dishAt = n;
      }
      continue;
    }
    const head = sized
      ? sized.head
      : single
        ? single[1]
        : range
          ? range[1]
          : market![1];
    const { name, description } = splitName(head);
    dishAt = n;
    if (single && previous && isAddonName(name)) {
      previous.additions = [
        ...previous.additions,
        {
          id: crypto.randomUUID(),
          label: addonLabel(name).slice(0, 120),
          price: cents(single[2]) ?? 0,
        },
      ].slice(0, 12);
      flag(previous, "addons");
      continue;
    }
    const entry = newMenuEntry({
      name,
      description,
      sourceReviewed: false,
      price: single ? cents(single[2]) : null,
      priceMode: sized ? "variants" : market || range ? "label" : "single",
      // A range stays as written ("38–45") for the owner to check.
      priceLabel: market
        ? "Market price"
        : range
          ? range[2].replace(/\s*[–—]\s*|\s+to\s+|-/i, "–")
          : "",
    });
    if (range) flag(entry, "price");
    if (sized) {
      const heading = sizes.get(section.id);
      const labels =
        sized.labels ||
        (heading?.length === sized.prices.length ? heading : null);
      if (!labels) flag(entry, "sizes");
      entry.variants = sized.prices.map((value, index) => ({
        id: crypto.randomUUID(),
        label: (labels || defaultSizes(sized.prices.length, section.name))[
          index
        ],
        price: value,
      }));
    }
    section.items.push(entry);
  }
  if (section.items.length) sections.push(section);
  for (const item of sections.flatMap((s) => s.items))
    item.sourceUncertain = [...(flags.get(item.id) || [])];
  return sections;
}

/** Attach "Add bacon"-style dishes from any import to the dish above them. */
export function attachAddons(sections: MenuSection[]): MenuSection[] {
  return sections.map((section) => {
    const items: MenuEntry[] = [];
    for (const item of section.items) {
      const parent = items.at(-1);
      if (
        parent &&
        isAddonName(item.name) &&
        item.priceMode === "single" &&
        item.price != null &&
        !item.dishId &&
        parent.additions.length < 12
      ) {
        items[items.length - 1] = {
          ...parent,
          additions: [
            ...parent.additions,
            {
              id: crypto.randomUUID(),
              label: addonLabel(item.name).slice(0, 120),
              price: item.price,
            },
          ],
          sourceUncertain: [
            ...new Set([...parent.sourceUncertain, "addons" as const]),
          ],
        };
      } else items.push(item);
    }
    return { ...section, items };
  });
}

// Courses in the order guests read them, matched as whole words (with
// plurals), so "Steaks" isn't tea and "Barbecue" isn't the bar.
const courses = [
  /breakfast|brunch|morning/,
  /baker(?:y|ies)|pastr(?:y|ies)|breads?/,
  /snacks?|small plates?|shar(?:e|es|ing)|appeti[sz]ers?|starters?|antipast[io]s?/,
  /soups?|salads?/,
  /mains?|entr[ée]es?|plates?|pastas?|pizzas?|burgers?|sandwich(?:es)?|tacos?|bowls?/,
  /sides?/,
  /desserts?|sweets?/,
  /kids?/,
  /coffees?|teas?|drinks?|beverages?|juices?|smoothies?/,
  /cocktails?|wines?|beers?|bars?/,
].map((words) => new RegExp(`(?<!\\p{L})(?:${words.source})(?!\\p{L})`, "iu"));
export const courseCount = courses.length;
/** Where a section sits in a menu's course order, or -1 when unknown. */
export const courseIndex = (name: string) =>
  courses.findIndex((pattern) => pattern.test(name));

const purposeSignals: [Purpose, RegExp][] = [
  ["cocktails", /cocktail|martini|spritz|negroni|margarita|mocktail/i],
  [
    "bar",
    /\bbeers?\b|draft|draught|on tap|\btaps?\b|\bcans?\b|lager|\bipas?\b|\bales?\b|\bshots?\b/i,
  ],
  ["smoothies", /smoothie|juice|a[cç]a[ií]|\bshakes?\b/i],
  [
    "drinks",
    /\bwines?\b|\bvino\b|by the glass|sparkling|bubbles|\bred\b|\bwhite\b|ros[eé]|spirits|whisk(?:e)?y|bourbon|tequila|mezcal|\bgin\b|\brum\b|vodka|\bdrinks?\b|beverages?|\bsodas?\b/i,
  ],
  [
    "cafe",
    /coffee|espresso|\blattes?\b|\bteas?\b|pastr|bakery|baked|viennoiserie|from the oven|\bcakes?\b|matcha/i,
  ],
  [
    "brunch",
    /breakfast|brunch|morning|\beggs?\b|pancakes?|waffles?|benedict|omelet/i,
  ],
  ["lunch", /sandwich|\bsalads?\b|\bsoups?\b|\bwraps?\b|\blunch\b|panini/i],
  [
    "dinner",
    /starters?|appeti[sz]ers?|small plates|to share|sharing|antipast|entr[ée]es?|\bmains?\b|main courses?|\bpastas?\b|steaks?|from the grill|\bdinner\b|\bsupper\b|large plates/i,
  ],
  ["tasting", /\bcourses?\b|tasting/i],
];
const drinkPurposes: Purpose[] = ["cocktails", "bar", "smoothies", "drinks"];

/**
 * A menu type from section names, or null when the sections don't say.
 * "Breakfast, Pastries, Coffee" is a café menu; "Beer, Wine, Cocktails" a
 * drinks list.
 */
export function inferMenuPurpose(names: string[]): Purpose | null {
  const total = names.length;
  if (!total) return null;
  const count = (purpose: Purpose) =>
    names.filter((name) =>
      purposeSignals.some(
        ([p, pattern]) => p === purpose && pattern.test(name),
      ),
    ).length;
  const drinks = names.filter((name) =>
    purposeSignals.some(
      ([p, pattern]) => drinkPurposes.includes(p) && pattern.test(name),
    ),
  ).length;
  if (count("tasting") >= Math.max(2, total / 2)) return "tasting";
  if (drinks / total >= 0.6) {
    const specific = (["cocktails", "bar", "smoothies"] as Purpose[]).filter(
      (p) => count(p),
    );
    return specific.length === 1 ? specific[0] : "drinks";
  }
  const dinner = count("dinner");
  if (dinner) return "dinner";
  if (count("cafe")) return "cafe";
  if (count("brunch")) return "brunch";
  if (count("lunch")) return "lunch";
  return null;
}
