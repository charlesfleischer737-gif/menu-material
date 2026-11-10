import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// The public site's search pages (lib/site-pages.ts): every page has its own
// title, description and questions, every link and photo it names exists,
// and its numbers match the product's settings.
const {
  audienceCollections,
  contentPage,
  contentPages,
  fixedPages,
  longDate,
  pageCard,
  pagesOfKind,
  siteTitle,
} = await import("../lib/site-pages.ts");
const { inlineHrefs, inlineParts, plainText } =
  await import("../lib/inline-links.ts");
const { footerGroups, siteSummary } = await import("../lib/site-links.ts");
const { homeFaqs } = await import("../lib/home-faqs.ts");
const { llmsText } = await import("../lib/llms-text.ts");
const { photoStyles, styleCategories } = await import("../lib/photo-styles.ts");
const { showcaseStyles } = await import("../lib/homepage-showcase.ts");
const { channelRules } = await import("../lib/channel-rules.ts");
const { formats } = await import("../lib/studio.ts");
const { FREE_SIGNUP_IMAGES } = await import("../lib/plans.ts");
let checks = 0;

// Copy markup: [label](/path) is a link, everything else is plain text.
const sample =
  "See the [DoorDash guide](/guides/doordash) and [pricing](/pricing).";
assert.deepEqual(inlineParts(sample), [
  "See the ",
  { label: "DoorDash guide", href: "/guides/doordash" },
  " and ",
  { label: "pricing", href: "/pricing" },
  ".",
]);
assert.equal(plainText(sample), "See the DoorDash guide and pricing.");
assert.deepEqual(inlineHrefs(sample), ["/guides/doordash", "/pricing"]);
assert.deepEqual(inlineParts("No links."), ["No links."]);
assert.equal(longDate("2026-11-10"), "November 10, 2026");
checks += 5;

// Every address a page may link to.
const known = new Set([
  ...contentPages.map((page) => page.path),
  ...Object.keys(fixedPages),
]);
const day = /^\d{4}-\d{2}-\d{2}$/;
const size = (format) => `${formats[format].width} × ${formats[format].height}`;

/** All of a page's copy, for link and wording checks. */
function copy(page) {
  const text = [page.intro];
  for (const section of page.sections)
    for (const block of section.blocks) {
      if (block.kind === "text") text.push(...block.paragraphs);
      if (block.kind === "list") text.push(...block.items);
      if (block.kind === "steps")
        text.push(...block.items.map((item) => `${item.title} ${item.text}`));
      if (block.kind === "specs")
        text.push(...block.rows.map((row) => row.join(": ")));
    }
  for (const faq of page.faqs) text.push(faq.question, faq.answer);
  return text;
}

// One page per address, each with its own title, description and heading.
for (const field of ["path", "title", "description", "heading", "label"]) {
  const values = contentPages.map((page) => page[field]);
  assert.equal(new Set(values).size, values.length, `${field} is unique`);
  checks++;
}
assert(contentPages.length >= 16);
for (const page of contentPages) {
  const at = page.path;
  assert.match(at, /^\/[a-z0-9-]+(\/[a-z0-9-]+)?$/, at);
  assert.equal(contentPage(at), page);
  // Search results cut long titles and descriptions short.
  assert(siteTitle(page).length <= 60, `${at} title: ${siteTitle(page)}`);
  assert(siteTitle(page).endsWith(" · Menu Material"), at);
  assert(
    page.description.length >= 110 && page.description.length <= 160,
    `${at} description is ${page.description.length} characters`,
  );
  assert.match(page.heading, /\.$/, `${at} heading`);
  // The first sentence answers the search by itself.
  assert(page.intro.length >= 80, `${at} intro`);
  assert.match(page.updated, day, at);
  assert(page.summary.length <= 110, `${at} summary`);
  assert(page.sections.length >= 2, `${at} sections`);
  const ids = page.sections.map((section) => section.id);
  assert.equal(new Set(ids).size, ids.length, `${at} section ids`);
  assert(page.faqs.length >= 2, `${at} questions`);
  for (const faq of page.faqs) {
    assert.match(faq.question, /\?$/, `${at}: ${faq.question}`);
    assert(faq.answer.length >= 40, `${at}: ${faq.question}`);
  }
  // Every link goes somewhere real, and never to the page itself.
  for (const text of copy(page))
    for (const href of inlineHrefs(text)) {
      assert(known.has(href), `${at} links to ${href}`);
      assert.notEqual(href, at, `${at} links to itself`);
    }
  assert(page.related.length >= 3 && page.related.length <= 4, at);
  assert.equal(new Set(page.related).size, page.related.length, at);
  for (const path of page.related) {
    assert(pageCard(path), `${at} reads next ${path}`);
    assert.notEqual(path, at);
  }
  for (const section of page.sections)
    for (const block of section.blocks) {
      if (block.kind === "styles") {
        const looks = photoStyles.filter(
          (style) => style.category === block.category,
        );
        assert(looks.length >= 6, `${at}: ${block.category} looks`);
        for (const look of looks) {
          assert(look.description && look.bestFor, look.id);
          assert(existsSync("public" + look.image), look.image);
          assert(
            existsSync(
              "public" +
                look.image.replace("/studio/styles/", "/studio/styles/thumbs/"),
            ),
            look.id,
          );
        }
      }
      if (block.kind === "showcase")
        for (const id of block.ids) {
          assert(
            showcaseStyles.some((style) => style.id === id),
            `${at}: ${id}`,
          );
          assert(existsSync(`public/homepage/showcase/${id}-640.webp`), id);
        }
      if (block.kind === "cards")
        for (const path of block.paths) assert(pageCard(path), path);
      if (block.kind === "specs")
        for (const row of block.rows)
          assert(row[0] && row[1] && !/undefined|NaN/.test(row[1]), at);
    }
  assert.doesNotMatch(
    JSON.stringify(page),
    /undefined|NaN|\b0 × 0\b/,
    `${at} has a missing number`,
  );
  checks += 12;
}

// Each kind of page has the file that serves it.
for (const page of contentPages) {
  const file =
    page.kind === "audience"
      ? "app/for/[audience]/page.tsx"
      : page.kind === "guide"
        ? "app/guides/[guide]/page.tsx"
        : `app${page.path}/page.tsx`;
  assert(existsSync(file), `${page.path}: ${file}`);
  if (page.kind === "audience") assert.match(page.path, /^\/for\//);
  if (page.kind === "guide") assert.match(page.path, /^\/guides\//);
  checks++;
}
for (const path of Object.keys(fixedPages))
  assert(
    existsSync(path === "/" ? "app/page.tsx" : `app${path}/page.tsx`),
    path,
  );
checks++;

// Audience pages each show one collection of the style library.
const audiences = pagesOfKind("audience");
assert.deepEqual(
  audiences.map((page) => page.path).sort(),
  Object.keys(audienceCollections).sort(),
);
for (const page of audiences) {
  const collection = audienceCollections[page.path];
  assert(styleCategories.some((category) => category.id === collection));
  assert(
    page.sections.some((section) =>
      section.blocks.some(
        (block) => block.kind === "styles" && block.category === collection,
      ),
    ),
    page.path,
  );
  checks++;
}
// Looks the copy names are in the library under those names.
const everything = contentPages.flatMap(copy).join("\n");
const lookNames = new Set(photoStyles.map((style) => style.name));
for (const name of [
  "Fresh from the oven",
  "Artisan bread",
  "Morning café",
  "The morning ritual",
  "Light through glass",
  "Botanical light",
  "Amber hour",
  "Velvet lounge",
  "The perfect pint",
  "Cellar reserve",
  "Dark degustation",
  "Obsidian tasting",
  "Natural daylight",
  "Takeout, elevated",
  "Paper & crunch",
  "Neighborhood table",
]) {
  assert(lookNames.has(name), `${name} is a look`);
  assert(everything.includes(name), `${name} is named in the copy`);
  checks++;
}
assert.match(readFileSync("lib/studio.ts", "utf8"), /"Polish my original"/);
assert(everything.includes("Polish my original"));
checks++;

// Guides say when they were checked and where; their numbers are the
// product's own channel rules and export sizes.
const guides = pagesOfKind("guide");
assert(guides.length >= 6);
for (const guide of guides) {
  assert(guide.sources?.length, `${guide.path} sources`);
  for (const source of guide.sources) {
    assert.match(source.url, /^https:\/\//, guide.path);
    assert(source.label.length > 8, guide.path);
  }
  if (guide.checked) {
    assert.match(guide.checked, day, guide.path);
    assert(guide.checked <= guide.updated, guide.path);
  }
  checks++;
}
const text = (path) => copy(contentPage(path)).join("\n");
const { doordash, uber, google, toast } = channelRules;
const doordashGuide = text("/guides/doordash-photo-requirements");
assert(doordashGuide.includes(`${doordash.minWidth} × ${doordash.minHeight}`));
assert(doordashGuide.includes(`${doordash.maxBytes / 1048576} MB`));
assert(doordashGuide.includes(size("doordash")));
const uberGuide = text("/guides/uber-eats-photo-requirements");
assert(uberGuide.includes(`${uber.minHeight} pixels tall`));
assert(uberGuide.includes(`${uber.maxBytes / 1048576} MB`));
assert(uberGuide.includes(size("uber")));
assert.equal(
  contentPage("/guides/uber-eats-photo-requirements").checked,
  uber.verified,
);
const toastGuide = text("/guides/toast-menu-photo-requirements");
assert(toastGuide.includes(`${toast.minWidth} × ${toast.minHeight}`));
assert(toastGuide.includes(size("toast")));
const googleGuide = text("/guides/google-business-profile-photo-requirements");
assert(googleGuide.includes(`${google.minWidth} × ${google.minHeight}`));
assert(
  googleGuide.includes(
    `${google.recommended.width} × ${google.recommended.height}`,
  ),
);
const instagramGuide = text("/guides/instagram-food-photo-sizes");
for (const format of ["feed", "story"])
  assert(instagramGuide.includes(size(format)), format);
const delivery = text("/delivery-app-photos");
for (const format of ["doordash", "uber", "toast"])
  assert(delivery.includes(size(format)), format);
assert(
  text("/ai-food-photography").includes(`${FREE_SIGNUP_IMAGES} free images`),
);
checks += 14;

// The footer links to every search page's neighbors, and nowhere else.
const footer = footerGroups.flatMap((group) => group.links);
assert.equal(new Set(footer.map((link) => link.href)).size, footer.length);
for (const link of footer) {
  assert(known.has(link.href), `footer: ${link.href}`);
  assert(link.label, link.href);
}
// Every product and audience page, and the guides, are one click from any
// page.
for (const page of [
  ...pagesOfKind("product"),
  ...audiences,
  ...pagesOfKind("hub"),
])
  assert(
    footer.some((link) => link.href === page.path),
    `footer misses ${page.path}`,
  );
// Every guide is linked from the guides page.
const hub = contentPage("/guides");
const hubCards = hub.sections.flatMap((section) =>
  section.blocks.flatMap((block) =>
    block.kind === "cards" ? block.paths : [],
  ),
);
assert.deepEqual(
  hubCards,
  guides.map((guide) => guide.path),
);
checks += 3;

// The homepage's questions: plain answers with real links, and no mention of
// the paid plan (it is sold only while billing is on).
assert(homeFaqs.length >= 4);
for (const faq of homeFaqs) {
  assert.match(faq.question, /\?$/);
  for (const href of inlineHrefs(faq.answer)) assert(known.has(href), href);
  assert.doesNotMatch(faq.answer, /\bPro\b/, faq.question);
}
assert.match(homeFaqs[0].answer, /AI food photography/);
checks += 2;

// /llms.txt: a title, the one-sentence summary, then every page by its full
// address.
const llms = llmsText("https://menus.example.com");
assert(llms.startsWith("# Menu Material\n\n> " + siteSummary));
for (const path of known)
  if (path !== "/")
    assert(llms.includes(`(https://menus.example.com${path})`), path);
assert.doesNotMatch(llms, /\]\(\//, "no relative links");
assert.match(
  readFileSync("app/llms.txt/route.ts", "utf8"),
  /llmsText\(await siteOrigin\(\)\)/,
);
checks += 4;

console.log(
  `Site pages: ${checks} checks passed (${contentPages.length} search pages: titles, descriptions, questions, links, photos, platform numbers, footer, homepage questions, llms.txt).`,
);
