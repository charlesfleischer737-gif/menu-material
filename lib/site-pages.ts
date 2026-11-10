import { channelRules } from "./channel-rules";
import { libraryStyleCount } from "./homepage-showcase";
import { FREE_LIVE_MENUS, FREE_SIGNUP_IMAGES, proFeatures } from "./plans";
import { formats, type PhotoFormat } from "./studio";

/**
 * The public site's search pages: what the product does (product), who it is
 * for (audience) and how each platform wants its photos (guide). Each page
 * answers one thing people search for, in its title and first sentence.
 *
 * Copy is plain text; [label](/path) makes a link (lib/inline-links.ts).
 * Numbers come from the product's own settings (plans, export sizes, channel
 * rules), so the pages can't drift from what the product does.
 * app/components/content-page.tsx draws a page, app/sitemap.ts and
 * app/llms.txt list them, and tests/site-pages.mjs checks titles,
 * descriptions, links and numbers. docs/SEO.md explains how to add one.
 */

export type Faq = { question: string; answer: string };
export type Source = { label: string; url: string };
export type Block =
  | { kind: "text"; paragraphs: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: { title: string; text: string }[] }
  | { kind: "specs"; rows: [string, string][] }
  /** Every look in one collection of the style library, with its example. */
  | { kind: "styles"; category: string }
  /** The library's collections, one example each. */
  | { kind: "collections" }
  /** Examples from the homepage showcase, by style id. */
  | { kind: "showcase"; ids: string[] }
  /** Links to other pages, by path, with each page's summary. */
  | { kind: "cards"; paths: string[] };
export type Section = { id: string; title: string; blocks: Block[] };
export type ContentPage = {
  path: string;
  kind: "product" | "audience" | "guide" | "hub";
  /** For <title>, before " · Menu Material". */
  title: string;
  /** For search results: what the page answers, in a sentence or two. */
  description: string;
  heading: string;
  intro: string;
  /** A short name, for breadcrumbs, cards and lists of pages. */
  label: string;
  /** One line about the page, for cards and llms.txt. */
  summary: string;
  /** The day the copy last changed (YYYY-MM-DD). */
  updated: string;
  sections: Section[];
  faqs: Faq[];
  /** Pages to read next, by path. */
  related: string[];
  /** Guides: the day the rules were last checked against the sources. */
  checked?: string;
  sources?: Source[];
};

export const siteTitle = (page: Pick<ContentPage, "title">) =>
  `${page.title} · Menu Material`;

/** "2026-11-10" as "November 10, 2026". */
export function longDate(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

const MB = 1024 * 1024;
const size = (width: number, height: number) => `${width} × ${height}`;
const exportSize = (format: PhotoFormat) =>
  size(formats[format].width, formats[format].height);
const megabytes = (bytes = 0) => `${bytes / MB} MB`;
const { doordash, uber, google, toast } = channelRules;
const doordashMinimum = size(doordash.minWidth, doordash.minHeight);
const uberBest = size(
  uber.recommended?.width ?? 0,
  uber.recommended?.height ?? 0,
);
const googleMinimum = size(google.minWidth, google.minHeight);
const googleBest = size(
  google.recommended?.width ?? 0,
  google.recommended?.height ?? 0,
);
const toastSize = size(toast.minWidth, toast.minHeight);
const free = `${FREE_SIGNUP_IMAGES} free images`;
const updated = "2026-11-10";
// Guides whose rules were re-read at their sources on this day. The year in
// a guide's title is the year it was last checked.
const checkedToday = "2026-11-10";
const year = (day: string) => day.slice(0, 4);
// The product's own upload steps, reworded for a reader who isn't mid-download.
const uploadSteps = (text: string) => text.replace("this photo", "the photo");

/** Which collection of the style library each audience page shows. */
export const audienceCollections: Record<string, string> = {
  "/for/bakeries": "bakery",
  "/for/coffee-shops": "beverage",
  "/for/bars": "bar",
  "/for/fine-dining": "fine",
  "/for/takeout-and-delivery": "delivery",
};

const exportRows: [string, string][] = [
  ["DoorDash item photo", `${exportSize("doordash")} pixels (16:9)`],
  ["Uber Eats item photo", `${exportSize("uber")} pixels (5:4)`],
  ["Toast item photo", `${exportSize("toast")} pixels (5:3)`],
  ["Menu and website", `${exportSize("menu")} pixels (square)`],
  ["Instagram post", `${exportSize("feed")} pixels (4:5)`],
  ["Instagram Story", `${exportSize("story")} pixels (9:16)`],
];

const productPages: ContentPage[] = [
  {
    path: "/ai-food-photography",
    kind: "product",
    title: "AI food photography for restaurants",
    description: `Turn a phone photo of your real dish into a studio-quality image for menus, delivery apps and Instagram. ${libraryStyleCount} looks, no watermark, ${free}.`,
    heading: "AI food photography for restaurants.",
    intro:
      "Menu Material turns a phone photo of the dish you actually serve into a studio-quality image, sized for your menu, delivery apps and Instagram.",
    label: "AI food photography",
    summary:
      "How Menu Material turns a phone photo of a real dish into a studio-quality image.",
    updated,
    sections: [
      {
        id: "how-it-works",
        title: "How it works",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Add a photo.",
                text: "Take one with your phone or upload one you already have. You can prepare it before you create an account.",
              },
              {
                title: "Choose a look.",
                text: `Pick from ${libraryStyleCount} looks, from a clean delivery shot to a candlelit dining room, then fine-tune the result.`,
              },
              {
                title: "Download it for each place you use it.",
                text: "One photo exports at the right size for DoorDash, Uber Eats, Toast, your website and Instagram.",
              },
            ],
          },
        ],
      },
      {
        id: "real-dish",
        title: "Your real dish, in a better setting",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              "Every image starts from your own photo. The light, backdrop and setting change; your plating, ingredients and portions are meant to stay as you serve them.",
              "AI can still get details wrong, so you compare each result with your original before you approve it. If the food changed, you can report it and have it corrected.",
              "The [usage guidelines](/guidelines) cover what to check before you publish a photo.",
            ],
          },
        ],
      },
      {
        id: "looks",
        title: `${libraryStyleCount} looks, in collections for every kind of kitchen`,
        blocks: [
          { kind: "collections" },
          {
            kind: "text",
            paragraphs: [
              "Every realistic look is free to use, at full quality and without a watermark. Food Fantasy, a set of deliberately exaggerated creative styles, is part of Pro.",
            ],
          },
        ],
      },
      {
        id: "sizes",
        title: "Sized for where it’s going",
        blocks: [
          { kind: "specs", rows: exportRows },
          {
            kind: "text",
            paragraphs: [
              "A download never enlarges a photo past the detail it has, and delivery downloads are checked against each platform’s minimum size first. The [photo size guides](/guides) explain what each platform asks for.",
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        question: "Is the photo still my real dish?",
        answer:
          "Yes. Menu Material edits the photo you upload: it restyles the light, backdrop and setting, and aims to keep your plating, ingredients and portions as they are. Always compare the result with the dish you serve before you share it.",
      },
      {
        question: "Do I need a professional camera?",
        answer:
          "No. A recent phone is enough. Show the whole dish, use soft window light and avoid digital zoom. [How to photograph food with your phone](/guides/phone-food-photography) has more.",
      },
      {
        question: "Can I use the photos on DoorDash and Uber Eats?",
        answer:
          "You can download each photo at the size those apps ask for. Both review every photo and can reject one that doesn’t look like the real item, so start from a real photo and choose a natural setting. The [DoorDash](/guides/doordash-photo-requirements) and [Uber Eats](/guides/uber-eats-photo-requirements) guides list the rules.",
      },
      {
        question: "Is there a watermark?",
        answer:
          "No. Every image is full quality with no watermark, on every plan.",
      },
      {
        question: "What does it cost?",
        answer: `Every account starts with ${free}, with no credit card and no expiry. [Plans and pricing](/pricing) has the rest.`,
      },
    ],
    related: [
      "/delivery-app-photos",
      "/restaurant-social-media-posts",
      "/qr-code-menu",
      "/guides",
    ],
  },
  {
    path: "/delivery-app-photos",
    kind: "product",
    title: "DoorDash & Uber Eats menu photos",
    description:
      "Make delivery menu photos from your phone: sized for DoorDash, Uber Eats and Toast, and checked against each platform’s rules before you upload.",
    heading: "Menu photos for DoorDash, Uber Eats and Toast.",
    intro:
      "Take a phone photo of the real dish. Menu Material restyles it and exports it at the size each ordering platform asks for, with a check against that platform’s rules before you upload.",
    label: "Delivery app photos",
    summary:
      "Photos sized and checked for DoorDash, Uber Eats and Toast listings.",
    updated,
    sections: [
      {
        id: "sizes",
        title: "One photo, every listing",
        blocks: [
          { kind: "specs", rows: exportRows.slice(0, 3) },
          {
            kind: "text",
            paragraphs: [
              "Each platform wants a different shape, so one photo downloads once for each. Nothing is stretched, and a photo is never enlarged past the detail it has.",
            ],
          },
          {
            kind: "showcase",
            ids: ["delivery-white", "delivery-takeout", "delivery-overhead"],
          },
        ],
      },
      {
        id: "checks",
        title: "Checked before you upload",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              "Each download is checked against the platform’s minimum size. Menu Material also warns you when a look is likely to be turned down: DoorDash, for example, often rejects colorful and plain white studio backdrops.",
              "For delivery listings, a natural setting such as Neighborhood table, or Polish my original, is the safest choice.",
            ],
          },
        ],
      },
      {
        id: "rules",
        title: "What each platform asks for",
        blocks: [
          {
            kind: "list",
            items: [
              `[DoorDash](/guides/doordash-photo-requirements): landscape 16:9, at least ${doordashMinimum} pixels, on a simple, natural background.`,
              `[Uber Eats](/guides/uber-eats-photo-requirements): between 5:4 and 6:4, at least ${uber.minHeight} pixels tall, best at ${uberBest}.`,
              `[Toast](/guides/toast-menu-photo-requirements): JPG or PNG up to ${megabytes(toast.maxBytes)}, ${toastSize} pixels recommended.`,
              `[Google Business Profile](/guides/google-business-profile-photo-requirements): at least ${googleMinimum} pixels, and true to what you serve.`,
            ],
          },
        ],
      },
      {
        id: "honest",
        title: "A straight answer about AI and delivery apps",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              "Delivery platforms want a photo of the item a customer will actually receive, and they review every upload. Menu Material starts from your photo of the real dish; it doesn’t invent one. Images made only from a description are illustrations, and they aren’t offered for delivery apps or Google.",
              "No tool can promise approval. If a photo is rejected, the platform tells you why, and the [guides](/guides) list the usual reasons.",
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        question: "What size should a DoorDash photo be?",
        answer: `Landscape 16:9 and at least ${doordashMinimum} pixels. Menu Material exports DoorDash photos at ${exportSize("doordash")}.`,
      },
      {
        question: "What size should an Uber Eats photo be?",
        answer: `Between 5:4 and 6:4, at least ${uber.minHeight} pixels tall, as a JPG or PNG up to ${megabytes(uber.maxBytes)}. Uber Eats shows photos best at ${uberBest}, which is the size Menu Material exports.`,
      },
      {
        question: "Will DoorDash or Uber Eats accept an AI-edited photo?",
        answer:
          "They judge the photo, not the tool. It has to show the actual item on a simple, natural-looking background, with no text or logos. DoorDash asks for photos that look as they were photographed and rejects creative or edited-in backgrounds, so choose Polish my original or a natural setting for delivery listings.",
      },
      {
        question: "Can I do my whole menu at once?",
        answer: `Yes, with Pro: give up to 8 dishes the same look in one batch, and download a pack with every delivery and social size. [Plans and pricing](/pricing) has the details.`,
      },
    ],
    related: [
      "/guides/doordash-photo-requirements",
      "/guides/uber-eats-photo-requirements",
      "/guides/toast-menu-photo-requirements",
      "/for/takeout-and-delivery",
    ],
  },
  {
    path: "/restaurant-social-media-posts",
    kind: "product",
    title: "Instagram posts for restaurants",
    description:
      "Turn a dish photo into a finished Instagram post or Story with a caption you can edit. Sized 4:5, 3:4 and 9:16, in designs made for restaurants.",
    heading: "Instagram posts and Stories for restaurants.",
    intro:
      "Give today’s special its moment. Menu Material turns a dish photo into a finished post or Story, with a caption you can make your own.",
    label: "Instagram posts",
    summary:
      "Finished Instagram posts and Stories from a dish photo, with an editable caption.",
    updated,
    sections: [
      {
        id: "how-it-works",
        title: "From photo to post",
        blocks: [
          {
            kind: "steps",
            items: [
              {
                title: "Choose a photo.",
                text: "Use one you made in Photo Studio, or start from a new dish.",
              },
              {
                title: "Pick a design.",
                text: "Three post designs are free. Pro has all ten, with carousels and offers for several dishes.",
              },
              {
                title: "Make the caption yours.",
                text: "Menu Material drafts a caption from the dish. Edit it, and check prices, hours and offers yourself.",
              },
              {
                title: "Share it.",
                text: "Send the finished post to Instagram from your phone, or download it.",
              },
            ],
          },
          {
            kind: "showcase",
            ids: ["studio-color", "bold-crimson", "studio-sunbeam"],
          },
        ],
      },
      {
        id: "sizes",
        title: "The right size, every time",
        blocks: [
          {
            kind: "specs",
            rows: [
              ["Post, 4:5", `${exportSize("feed")} pixels`],
              ["Post, 3:4", "1080 × 1440 pixels"],
              ["Story, 9:16", `${exportSize("story")} pixels`],
            ],
          },
          {
            kind: "text",
            paragraphs: [
              "Story text and logos stay clear of Instagram’s own buttons. [Instagram food photo sizes](/guides/instagram-food-photo-sizes) explains each shape.",
            ],
          },
        ],
      },
      {
        id: "campaigns",
        title: "Campaigns for specials and offers",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              `With Pro, one dish becomes a campaign: ${lowerFirst(proFeatures.campaigns.detail)} Your restaurant look puts your colors and fonts on all of it.`,
            ],
          },
        ],
      },
      {
        id: "posting",
        title: "You stay in charge of posting",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              "Menu Material doesn’t post for you or ask for your Instagram password. You review each post, then share or download the finished files.",
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        question: "What size is an Instagram post?",
        answer: `${exportSize("feed")} pixels (4:5) or 1080 × 1440 (3:4) for feed posts, and ${exportSize("story")} (9:16) for Stories. [Instagram food photo sizes](/guides/instagram-food-photo-sizes) has the details.`,
      },
      {
        question: "Does Menu Material write the caption?",
        answer:
          "It drafts one from your dish, and you edit it before you post. Check prices, hours and offers yourself.",
      },
      {
        question: "Does it post to Instagram automatically?",
        answer:
          "No. You share or download the finished post and publish it yourself.",
      },
      {
        question: "Can I use my restaurant’s colors and fonts?",
        answer:
          "Yes, with Pro. Your restaurant look applies your colors, fonts and photo style to every post.",
      },
    ],
    related: [
      "/guides/instagram-food-photo-sizes",
      "/ai-food-photography",
      "/qr-code-menu",
      "/for/bars",
    ],
  },
  {
    path: "/qr-code-menu",
    kind: "product",
    title: "Free QR code menu for restaurants",
    description:
      "Publish a live menu with its own QR code, PDF and table card. Import the menu you have, add dish photos and update prices in seconds. One menu is free.",
    heading: "A QR code menu that looks like your restaurant.",
    intro:
      "Publish a live menu that guests open from a QR code or a link. One menu is free, with its QR code, a printable PDF and a table card.",
    label: "QR code menus",
    summary:
      "A live menu with its own QR code, PDF and table card. One menu is free.",
    updated,
    sections: [
      {
        id: "included",
        title: "What you get",
        blocks: [
          {
            kind: "list",
            items: [
              "A live menu at its own link, which you can also embed on your website.",
              "A high-resolution QR code that stays the same when the menu changes.",
              "A 4 × 6 inch table card, ready to print.",
              "A PDF of the menu.",
              "Photos on the dishes you feature.",
            ],
          },
          {
            kind: "showcase",
            ids: ["menu-courtyard", "menu-stone", "menu-terrazzo"],
          },
        ],
      },
      {
        id: "import",
        title: "Start from the menu you have",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              "Import your current menu from a PDF or a photo. Menu Material reads the dishes and prices, and you review them before anything is published.",
            ],
          },
        ],
      },
      {
        id: "guests",
        title: "Easy for guests",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              "Guests can search the menu, filter for vegetarian, vegan or gluten-free dishes, and hide dishes that list an allergen. Dietary and allergen details are the ones you enter; nothing is guessed from a photo.",
              "The menu can link to the ordering service you already use. Menu Material doesn’t take orders or payments.",
            ],
          },
        ],
      },
      {
        id: "updates",
        title: "Keep it current",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              "Change a price or mark a dish sold out, then publish again. The link and the QR code don’t change, so printed codes keep working.",
            ],
          },
        ],
      },
      {
        id: "plans",
        title: "Free and Pro",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              `Free includes ${FREE_LIVE_MENUS === 1 ? "one live menu" : `${FREE_LIVE_MENUS} live menus`} in The Brasserie design, with a small “Made with Menu Material” credit. Pro adds ${lowerFirst(proFeatures.menus.title)}, every menu design, a photo for every dish, your own colors, menu insights and no credit. See [plans and pricing](/pricing).`,
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        question: "Is the QR code menu really free?",
        answer:
          "Yes. One live menu with its QR code, PDF and table card is part of the free plan, with no credit card. Free menus carry a small “Made with Menu Material” credit.",
      },
      {
        question: "Does the QR code change when I update the menu?",
        answer:
          "No. The link and the QR code stay the same when you publish again, so printed codes keep working.",
      },
      {
        question: "Can guests order from the menu?",
        answer:
          "The menu can link to the ordering service you already use. Menu Material doesn’t process orders or payments.",
      },
      {
        question: "Can I have separate lunch, dinner and drinks menus?",
        answer: `Yes, with Pro: ${lowerFirst(proFeatures.menus.title)}, each with its own QR code.`,
      },
    ],
    related: [
      "/ai-food-photography",
      "/restaurant-social-media-posts",
      "/guides/toast-menu-photo-requirements",
      "/for/coffee-shops",
    ],
  },
];

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

const audience = (
  page: Pick<
    ContentPage,
    "path" | "title" | "description" | "heading" | "intro" | "label" | "faqs"
  > & {
    summary: string;
    looksTitle: string;
    tip: string;
    uses: string;
    related: string[];
  },
): ContentPage => ({
  path: page.path,
  kind: "audience",
  title: page.title,
  description: page.description,
  heading: page.heading,
  intro: page.intro,
  label: page.label,
  summary: page.summary,
  updated,
  sections: [
    {
      id: "looks",
      title: page.looksTitle,
      blocks: [
        { kind: "styles", category: audienceCollections[page.path] },
        {
          kind: "text",
          paragraphs: [
            `These are examples of each look. Yours starts from your own photo, and every look here is free to use with your ${free}.`,
          ],
        },
      ],
    },
    {
      id: "real",
      title: "What stays real",
      blocks: [{ kind: "text", paragraphs: [page.tip] }],
    },
    {
      id: "uses",
      title: "Where the photos go",
      blocks: [{ kind: "text", paragraphs: [page.uses] }],
    },
  ],
  faqs: page.faqs,
  related: page.related,
});

const audiencePages: ContentPage[] = [
  audience({
    path: "/for/bakeries",
    title: "Food photos for bakeries & pastry shops",
    description:
      "Turn a phone photo from the counter into a bakery photo worth framing: golden crusts, glossy fruit and real crumb, for your menu, website and Instagram.",
    heading: "Food photos for bakeries.",
    intro:
      "Golden crusts, delicate layers and handcrafted details, beautifully lit. Start with a phone photo from the counter.",
    label: "Bakeries",
    summary: "Eight looks for bread, pastry and cakes.",
    looksTitle: "Eight looks made for baking",
    tip: "The setting changes; the bake doesn’t. Real crumb, frosting and pastry texture stay visible, and no decoration is invented. Compare each result with your original before you use it.",
    uses: "Use them on your café menu, your website, a [QR code menu](/qr-code-menu) at the counter, and [Instagram posts](/restaurant-social-media-posts) for the morning bake.",
    faqs: [
      {
        question: "Which look works best for croissants and bread?",
        answer:
          "Fresh from the oven suits croissants and breakfast pastries, with warm morning light on the layers. Artisan bread is made for sourdough, rolls and rustic baking, on warm wood with directional light.",
      },
      {
        question: "Can it photograph a whole display case?",
        answer:
          "It works best with one item or one plate in the frame. Photograph your bakes one at a time, then give them all the same look so the menu matches.",
      },
      {
        question: "Will it change my decoration or toppings?",
        answer:
          "It isn’t meant to. The looks restyle the light and the setting and keep the bake itself. AI can still get details wrong, so check each result against your original.",
      },
    ],
    related: [
      "/for/coffee-shops",
      "/ai-food-photography",
      "/guides/phone-food-photography",
      "/guides/instagram-food-photo-sizes",
    ],
  }),
  audience({
    path: "/for/coffee-shops",
    title: "Drink photos for coffee shops & juice bars",
    description:
      "Make coffee, matcha, juice and smoothie photos from your phone: fresh color, real ice and clear glass, for café menus, seasonal launches and Instagram.",
    heading: "Drink photos for coffee shops and juice bars.",
    intro:
      "Fresh, luminous drinks with beautiful color, texture and clarity. Start with a phone photo of the drink you just made.",
    label: "Coffee shops",
    summary: "Eight looks for coffee, tea, juice and smoothies.",
    looksTitle: "Eight looks made for drinks",
    tip: "Your glass, liquid level, ice and garnish stay true to what you serve. Compare each result with your original before you use it.",
    uses: "Use them on your coffee menu, a [QR code menu](/qr-code-menu) at the till, a seasonal drink launch and [Instagram posts](/restaurant-social-media-posts).",
    faqs: [
      {
        question: "Which look works best for iced coffee and lattes?",
        answer:
          "Morning café is made for iced coffee, lattes and café drinks, with soft window light that shows the layers. The morning ritual suits flat whites and cappuccinos, with a hand lifting the cup.",
      },
      {
        question: "Can it keep my latte art?",
        answer:
          "It aims to keep the drink as you photographed it, latte art included. Check the result against your original; if the drink changed, report it and have it corrected.",
      },
      {
        question: "What about cold drinks in clear glasses?",
        answer:
          "Light through glass and Botanical light are made for iced teas, spritzes and clear cold drinks, with backlighting that shows color and ice.",
      },
    ],
    related: [
      "/for/bakeries",
      "/for/bars",
      "/ai-food-photography",
      "/guides/phone-food-photography",
    ],
  }),
  audience({
    path: "/for/bars",
    title: "Cocktail & drink photos for bars",
    description:
      "Turn a phone photo from the bar into a cocktail photo with real atmosphere: amber light, deep shadows and glowing glassware, for menus and Instagram.",
    heading: "Cocktail photos for bars.",
    intro:
      "After-dark atmosphere, rich shadows and precise highlights that make glassware glow. Start with a phone photo from the bar.",
    label: "Bars",
    summary: "Eight looks for cocktails, wine, beer and bar food.",
    looksTitle: "Eight looks made for the bar",
    tip: "Moody light still leaves the drink, garnish and serving clearly visible, and they stay as you made them. Compare each result with your original before you use it.",
    uses: "Use them on your cocktail list, a [QR code menu](/qr-code-menu) on the tables, and [Instagram posts and Stories](/restaurant-social-media-posts) for tonight’s special.",
    faqs: [
      {
        question: "Which look works best for whiskey cocktails?",
        answer:
          "Amber hour is made for whiskey cocktails and dark spirits, with rich amber highlights on a walnut bar. Velvet lounge suits martinis, coupes and signature cocktails.",
      },
      {
        question: "Does it work for beer and wine?",
        answer:
          "Yes. The perfect pint is made for stouts, ales and draft beer, and Cellar reserve for red wine and wine flights.",
      },
      {
        question: "My bar is dark. Can I still take the photo there?",
        answer:
          "Move the drink near a window or a brighter spot for the photo; a dark, grainy original has little detail to work with. The look adds the evening atmosphere afterwards.",
      },
    ],
    related: [
      "/for/fine-dining",
      "/restaurant-social-media-posts",
      "/ai-food-photography",
      "/guides/instagram-food-photo-sizes",
    ],
  }),
  audience({
    path: "/for/fine-dining",
    title: "Food photography for fine dining",
    description:
      "Give signature dishes the setting they deserve: quiet luxury and considered light, made from a phone photo of your real plating, for menus and reservations.",
    heading: "Food photography for fine dining.",
    intro:
      "Quiet luxury, considered light and an elegant setting for your signature dishes. Start with a phone photo of the plate at the pass.",
    label: "Fine dining",
    summary: "Eight looks for tasting menus and signature dishes.",
    looksTitle: "Eight looks made for the dining room",
    tip: "The surroundings are elevated; your plating, ingredients and portion stay intact. Compare each result with your original before you use it.",
    uses: "Use them on your tasting menu, your website and reservation pages, and [Instagram posts](/restaurant-social-media-posts) for a new course.",
    faqs: [
      {
        question: "Will it change my plating?",
        answer:
          "It isn’t meant to. The looks change the room, the surface and the light, and keep the plate as you composed it. Check every result against your original, as you would a photographer’s proof.",
      },
      {
        question: "Which look works best for rich, dark dishes?",
        answer:
          "Dark degustation is made for steak, duck and rich signature dishes, with charcoal tones and sculpted contrast. Obsidian tasting puts a precise spotlight on colorful starters.",
      },
      {
        question: "Does this replace a photographer?",
        answer:
          "For a new menu, a weekly special or a reservation page, a phone photo and a considered look are often enough. For a cookbook or a press campaign, a photographer still gives you direction and control that a tool doesn’t.",
      },
    ],
    related: [
      "/for/bars",
      "/ai-food-photography",
      "/qr-code-menu",
      "/guides/google-business-profile-photo-requirements",
    ],
  }),
  audience({
    path: "/for/takeout-and-delivery",
    title: "Food photos for takeout & delivery kitchens",
    description:
      "Clear, appetizing item photos for delivery listings, made from a phone photo and sized for DoorDash, Uber Eats and Toast. Built for busy kitchens.",
    heading: "Food photos for takeout and delivery kitchens.",
    intro:
      "Clear, appetizing item photos that make each dish easy to recognize at a glance. Start with a phone photo from the line.",
    label: "Takeout & delivery",
    summary: "Eight looks for delivery listings and takeout menus.",
    looksTitle: "Eight looks made for delivery",
    tip: "Show the complete serving. The background stays simple, with no added text or props, and the food stays as you serve it. Compare each result with your original before you use it.",
    uses: "Download each photo sized for [DoorDash, Uber Eats and Toast](/delivery-app-photos). For those apps, natural settings such as Natural daylight and Takeout, elevated are the safest choice; DoorDash often rejects colorful and plain white studio backdrops.",
    faqs: [
      {
        question: "Which look is safest for DoorDash and Uber Eats?",
        answer:
          "A natural setting. Natural daylight, Takeout, elevated and Paper & crunch keep the food on a real surface. Menu Material warns you before you download a look that a platform is likely to reject.",
      },
      {
        question: "Can I do the whole menu at once?",
        answer:
          "Yes, with Pro: give up to 8 dishes the same look in one batch, so the listing matches from top to bottom.",
      },
      {
        question: "Should I photograph the food in its packaging?",
        answer:
          "If that’s how it arrives, it can help. Takeout, elevated is made for poke, grain bowls and boxed meals in an open takeout box. Show the complete serving either way.",
      },
    ],
    related: [
      "/delivery-app-photos",
      "/guides/doordash-photo-requirements",
      "/guides/uber-eats-photo-requirements",
      "/guides/phone-food-photography",
    ],
  }),
];

const helps = (text: string): Section => ({
  id: "menu-material",
  title: "How Menu Material helps",
  blocks: [{ kind: "text", paragraphs: [text] }],
});

const guidePages: ContentPage[] = [
  {
    path: "/guides/doordash-photo-requirements",
    kind: "guide",
    title: `DoorDash photo requirements (${year(checkedToday)})`,
    description: `DoorDash item photos must be landscape 16:9, at least ${doordashMinimum} pixels and under ${megabytes(doordash.maxBytes)}, on a natural background with no text. The full checklist.`,
    heading: "DoorDash photo requirements.",
    intro: `DoorDash item photos must be landscape, 16:9 and at least ${doordashMinimum} pixels, under ${megabytes(doordash.maxBytes)}. Each one has to show the actual item on a simple, natural-looking background, with no text, borders, watermarks or people.`,
    label: "DoorDash photo requirements",
    summary: `Landscape 16:9, at least ${doordashMinimum} pixels, natural background, no text.`,
    updated,
    checked: checkedToday,
    sources: [
      {
        label:
          "DoorDash Merchant Help: Why your DoorDash menu photos were rejected",
        url: "https://help.doordash.com/en-us/merchants/article/common-photo-issues-explained",
      },
    ],
    sections: [
      {
        id: "specs",
        title: "Size and format",
        blocks: [
          {
            kind: "specs",
            rows: [
              [
                "Shape",
                "Landscape, 16:9. Vertical and square photos aren’t accepted.",
              ],
              ["Minimum size", `${doordashMinimum} pixels`],
              [
                "File size",
                `Under ${megabytes(doordash.maxBytes)} for item photos`,
              ],
              ["Background", "Simple and natural-looking"],
              ["Subject", "One item, centered and mostly in frame"],
              [
                "Not allowed",
                "Added text, graphic overlays, borders and watermarks",
              ],
              ["People", "None. Hands only if they don’t distract"],
            ],
          },
        ],
      },
      {
        id: "rejections",
        title: "Why DoorDash rejects photos",
        blocks: [
          {
            kind: "list",
            items: [
              `The photo is vertical or square, or smaller than ${doordashMinimum} pixels.`,
              "The background is creative, very colorful, transparent or edited in.",
              "Text, a logo, a border or a watermark was added.",
              "It’s blurry, dark, pixelated or enlarged from a small image.",
              "It shows several items that are sold separately.",
              "It’s a stock photo or an illustration, or it doesn’t show the item as served.",
              "The item is cropped or off-center, so the portion is hard to judge.",
            ],
          },
          {
            kind: "text",
            paragraphs: [
              "DoorDash asks for original photos of the real item that look as they were photographed. A light, honest photo on a plain table does better than a dramatic one.",
            ],
          },
        ],
      },
      {
        id: "upload",
        title: "How to upload",
        blocks: [{ kind: "text", paragraphs: [uploadSteps(doordash.upload)] }],
      },
      helps(
        `Menu Material exports DoorDash photos at ${exportSize("doordash")} pixels, checks the size before you download, and warns you when a look uses a backdrop DoorDash often rejects. For DoorDash, choose Polish my original or a natural setting such as Neighborhood table. See [delivery app photos](/delivery-app-photos).`,
      ),
    ],
    faqs: [
      {
        question: "What size are DoorDash menu photos?",
        answer: `At least ${doordashMinimum} pixels, landscape, in a 16:9 shape. ${exportSize("doordash")} is a safe size.`,
      },
      {
        question: "Can I use a square or vertical photo on DoorDash?",
        answer:
          "No. DoorDash accepts landscape 16:9 item photos only. Take the photo in landscape, with space around the dish.",
      },
      {
        question: "Does DoorDash allow AI-generated photos?",
        answer:
          "DoorDash’s photo rules don’t name AI. They ask for a real photo of the actual item that looks as it was photographed, and they reject illustrations, stock images and creative or edited-in backgrounds. An image generated from a description alone doesn’t meet that.",
      },
      {
        question: "Can I use the same photo on DoorDash and Uber Eats?",
        answer:
          "Use the same shot, exported twice: DoorDash wants 16:9, and Uber Eats wants a shape between 5:4 and 6:4.",
      },
    ],
    related: [
      "/guides/uber-eats-photo-requirements",
      "/guides/toast-menu-photo-requirements",
      "/guides/phone-food-photography",
      "/delivery-app-photos",
    ],
  },
  {
    path: "/guides/uber-eats-photo-requirements",
    kind: "guide",
    title: `Uber Eats photo requirements (${year(uber.verified)})`,
    description: `Uber Eats menu photos must be JPG or PNG up to ${megabytes(uber.maxBytes)}, between 5:4 and 6:4, and at least ${uber.minHeight} pixels tall. Best at ${uberBest}. The full checklist.`,
    heading: "Uber Eats photo requirements.",
    intro: `Uber Eats menu photos must be JPG or PNG, up to ${megabytes(uber.maxBytes)}, between 5:4 and 6:4 in shape, and at least ${uber.minHeight} pixels tall. Uber Eats shows photos best at ${uberBest} pixels or larger.`,
    label: "Uber Eats photo requirements",
    summary: `JPG or PNG up to ${megabytes(uber.maxBytes)}, between 5:4 and 6:4, best at ${uberBest}.`,
    updated,
    checked: uber.verified,
    sources: [
      {
        label: "Uber Help: Merchant-submitted menu catalog photo guidelines",
        url: uber.sources[0],
      },
      {
        label: "Uber Eats for Merchants: Menu photos",
        url: "https://merchants.ubereats.com/ca/en/menu-photos/",
      },
    ],
    sections: [
      {
        id: "specs",
        title: "Size and format",
        blocks: [
          {
            kind: "specs",
            rows: [
              ["File type", (uber.fileTypes ?? []).join(" or ")],
              ["File size", `Up to ${megabytes(uber.maxBytes)}`],
              [
                "Shape",
                "Between 5:4 and 6:4 (1.25 to 1.5 wide for every 1 tall)",
              ],
              [
                "Height",
                `${uber.minHeight} to ${(uber.maxHeight ?? 0).toLocaleString("en-US")} pixels`,
              ],
              ["Best quality", `${uberBest} pixels or larger`],
              [
                "Subject",
                "One centered item that accurately represents the dish",
              ],
              ["Not allowed", "Text, logos and watermarks"],
            ],
          },
        ],
      },
      {
        id: "tips",
        title: "What Uber Eats suggests",
        blocks: [
          {
            kind: "list",
            items: [
              "Use indirect light from a window. Avoid direct sun and fluorescent light.",
              "Shoot plates and bowls from above, so customers can see the ingredients.",
              "Shoot burgers, sandwiches and taller items from about 45 degrees.",
              "Cut burgers, sandwiches, wraps and burritos, and stack the halves to show the inside.",
              "Photograph food straight after plating, while it still looks fresh.",
              "Skip extreme close-ups: the ingredients and the portion should be easy to see.",
            ],
          },
        ],
      },
      {
        id: "upload",
        title: "How to upload",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              uploadSteps(uber.upload),
              "Uber Eats reviews each photo before it goes live. If one is rejected, the reason appears on the item in Uber Eats Manager.",
            ],
          },
        ],
      },
      helps(
        `Menu Material exports Uber Eats photos at ${exportSize("uber")} pixels (5:4), the size Uber Eats shows best, and never enlarges a photo past the detail it has. See [delivery app photos](/delivery-app-photos).`,
      ),
    ],
    faqs: [
      {
        question: "What size are Uber Eats menu photos?",
        answer: `Between 5:4 and 6:4, at least ${uber.minHeight} pixels tall, as a JPG or PNG up to ${megabytes(uber.maxBytes)}. Uber Eats shows photos best at ${uberBest} pixels or larger.`,
      },
      {
        question: "Why was my Uber Eats photo rejected?",
        answer: `The usual reasons are the wrong shape (outside 5:4 to 6:4), a photo under ${uber.minHeight} pixels tall, added text or logos, more than one item, or a photo that doesn’t show the dish accurately. Uber Eats gives the reason on the item’s page in Uber Eats Manager.`,
      },
      {
        question: "Can I use the same photo on Uber Eats and DoorDash?",
        answer:
          "Use the same shot, exported twice: Uber Eats wants a shape between 5:4 and 6:4, and DoorDash wants 16:9.",
      },
    ],
    related: [
      "/guides/doordash-photo-requirements",
      "/guides/toast-menu-photo-requirements",
      "/guides/phone-food-photography",
      "/delivery-app-photos",
    ],
  },
  {
    path: "/guides/toast-menu-photo-requirements",
    kind: "guide",
    title: "Toast menu photo size & requirements",
    description: `Toast menu item images must be JPG or PNG and no larger than ${megabytes(toast.maxBytes)}. Toast recommends ${toastSize} pixels and may crop images on some displays.`,
    heading: "Toast menu photo requirements.",
    intro: `Toast menu item images must be JPG or PNG and no larger than ${megabytes(toast.maxBytes)}. Toast recommends ${toastSize} pixels, and may crop or zoom an image to fit some displays, so keep the dish in the center.`,
    label: "Toast menu photo requirements",
    summary: `JPG or PNG up to ${megabytes(toast.maxBytes)}, ${toastSize} pixels recommended.`,
    updated,
    checked: checkedToday,
    sources: [
      {
        label: "Toast Central: Adding images to menu items",
        url: toast.sources[0],
      },
    ],
    sections: [
      {
        id: "specs",
        title: "Size and format",
        blocks: [
          {
            kind: "specs",
            rows: [
              ["File type", "JPG or PNG"],
              ["File size", `Up to ${megabytes(toast.maxBytes)}`],
              ["Recommended size", `${toastSize} pixels (5:3)`],
              [
                "Where it shows",
                "On the item in the POS and in Toast Online Ordering",
              ],
              ["Cropping", "May be cropped or zoomed on some displays"],
            ],
          },
        ],
      },
      {
        id: "upload",
        title: "How to upload",
        blocks: [{ kind: "text", paragraphs: [uploadSteps(toast.upload)] }],
      },
      helps(
        `Menu Material exports Toast photos at ${exportSize("toast")} pixels, the same 5:3 shape at twice the recommended size. Keep the dish centered, so a crop doesn’t cut it off. See [delivery app photos](/delivery-app-photos).`,
      ),
    ],
    faqs: [
      {
        question: "What size should Toast menu photos be?",
        answer: `Toast recommends ${toastSize} pixels, a 5:3 rectangle, as a JPG or PNG no larger than ${megabytes(toast.maxBytes)}.`,
      },
      {
        question: "Why does my photo look cropped in Toast?",
        answer:
          "Toast fits images to different displays and may crop or zoom them. Leave space around the dish and keep it in the center of the frame.",
      },
    ],
    related: [
      "/guides/doordash-photo-requirements",
      "/guides/uber-eats-photo-requirements",
      "/qr-code-menu",
      "/delivery-app-photos",
    ],
  },
  {
    path: "/guides/google-business-profile-photo-requirements",
    kind: "guide",
    title: "Google Business Profile photo size",
    description: `Google Business Profile photos must be JPG or PNG, 10 KB to ${megabytes(google.maxBytes)}, and at least ${googleMinimum} pixels. Google recommends ${googleBest} and photos that represent reality.`,
    heading: "Google Business Profile photo requirements.",
    intro: `Google Business Profile photos must be JPG or PNG, between 10 KB and ${megabytes(google.maxBytes)}, and at least ${googleMinimum} pixels; Google recommends ${googleBest}. Photos should be in focus, well lit and true to life, without significant alterations or heavy filters.`,
    label: "Google Business Profile photo requirements",
    summary: `JPG or PNG, 10 KB to ${megabytes(google.maxBytes)}, ${googleBest} pixels recommended.`,
    updated,
    checked: checkedToday,
    sources: [
      {
        label: "Google Business Profile Help: Photo guidelines",
        url: google.sources[0],
      },
    ],
    sections: [
      {
        id: "specs",
        title: "Size and format",
        blocks: [
          {
            kind: "specs",
            rows: [
              ["File type", "JPG or PNG"],
              ["File size", `10 KB to ${megabytes(google.maxBytes)}`],
              ["Minimum size", `${googleMinimum} pixels`],
              ["Recommended size", `${googleBest} pixels`],
              [
                "Quality",
                "In focus and well lit, with no significant alterations or excessive filters",
              ],
            ],
          },
        ],
      },
      {
        id: "reality",
        title: "Keep it true to life",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              "Google asks that photos represent reality. For your Business Profile, a light polish of a real photo is the safest choice; a new studio backdrop may not be accepted, and an illustration made from a description doesn’t belong there.",
            ],
          },
        ],
      },
      {
        id: "upload",
        title: "How to upload",
        blocks: [{ kind: "text", paragraphs: [uploadSteps(google.upload)] }],
      },
      helps(
        "For Google, Menu Material suggests Polish my original or a natural setting such as Neighborhood table rather than a studio backdrop. See [AI food photography](/ai-food-photography).",
      ),
    ],
    faqs: [
      {
        question: "What is the best size for Google Business Profile photos?",
        answer: `Google recommends ${googleBest} pixels, as a JPG or PNG between 10 KB and ${megabytes(google.maxBytes)}. The minimum is ${googleMinimum} pixels.`,
      },
      {
        question: "Can I use edited or AI photos on Google Business Profile?",
        answer:
          "Google’s photo guidelines ask for images that represent reality, with no significant alterations or excessive filters. A light polish of your real photo is the safest choice.",
      },
    ],
    related: [
      "/guides/instagram-food-photo-sizes",
      "/guides/phone-food-photography",
      "/ai-food-photography",
      "/for/fine-dining",
    ],
  },
  {
    path: "/guides/instagram-food-photo-sizes",
    kind: "guide",
    title: `Instagram food photo sizes (${year(checkedToday)})`,
    description: `Instagram feed posts look best at ${exportSize("feed")} pixels (4:5) or 1080 × 1440 (3:4), and Stories at ${exportSize("story")} (9:16). Sizes and framing tips for food.`,
    heading: "Instagram food photo sizes.",
    intro: `Instagram feed posts look best at ${exportSize("feed")} pixels (4:5) or 1080 × 1440 (3:4), and Stories at ${exportSize("story")} (9:16). The profile grid shows a 3:4 preview, so keep the dish in the center.`,
    label: "Instagram food photo sizes",
    summary: `${exportSize("feed")} or 1080 × 1440 for posts, ${exportSize("story")} for Stories.`,
    updated,
    checked: checkedToday,
    sources: [
      {
        label: "Buffer: Instagram image size guide",
        url: "https://buffer.com/library/instagram-image-size",
      },
    ],
    sections: [
      {
        id: "specs",
        title: "Sizes",
        blocks: [
          {
            kind: "specs",
            rows: [
              ["Portrait post, 4:5", `${exportSize("feed")} pixels`],
              ["Tall post, 3:4", "1080 × 1440 pixels"],
              ["Square post, 1:1", "1080 × 1080 pixels"],
              ["Story, 9:16", `${exportSize("story")} pixels`],
              ["Profile grid", "A 3:4 preview of each post"],
            ],
          },
        ],
      },
      {
        id: "framing",
        title: "Framing food for Instagram",
        blocks: [
          {
            kind: "list",
            items: [
              "Go vertical. A portrait post fills more of the screen than a square one.",
              "Keep the dish in the middle, so the 3:4 grid preview doesn’t cut it off.",
              "In Stories, leave the top and bottom clear for Instagram’s own buttons.",
              "Put any text on the post in large type; it’s read on a phone.",
            ],
          },
        ],
      },
      helps(
        `Menu Material makes posts at 4:5 and 3:4 and Stories at 9:16, with text kept clear of Instagram’s buttons and a caption you can edit. See [Instagram posts for restaurants](/restaurant-social-media-posts).`,
      ),
    ],
    faqs: [
      {
        question: "What is the best Instagram post size for food photos?",
        answer: `${exportSize("feed")} pixels (4:5) or 1080 × 1440 (3:4). Both are portrait, so the dish fills more of the feed.`,
      },
      {
        question: "Are square posts still fine?",
        answer:
          "Yes. Square posts at 1080 × 1080 still work, but portrait posts take up more of the feed and fit the 3:4 profile grid better.",
      },
      {
        question: "What size is an Instagram Story?",
        answer: `${exportSize("story")} pixels, a 9:16 shape. Keep text and logos away from the top and bottom edges.`,
      },
    ],
    related: [
      "/restaurant-social-media-posts",
      "/guides/phone-food-photography",
      "/guides/google-business-profile-photo-requirements",
      "/for/bars",
    ],
  },
  {
    path: "/guides/phone-food-photography",
    kind: "guide",
    title: "How to photograph food with your phone",
    description:
      "Use soft window light, show the whole dish, skip digital zoom and shoot straight after plating. A short guide to menu-ready food photos from a phone.",
    heading: "How to photograph food with your phone.",
    intro:
      "Use soft window light, show the whole dish, shoot at your phone’s full resolution without digital zoom, and take the photo straight after the food is plated.",
    label: "Food photos with your phone",
    summary: "Light, angle, framing and timing for menu-ready phone photos.",
    updated,
    sources: [
      {
        label: "Uber Eats for Merchants: Menu photos",
        url: "https://merchants.ubereats.com/ca/en/menu-photos/",
      },
      {
        label:
          "DoorDash Merchant Help: Why your DoorDash menu photos were rejected",
        url: "https://help.doordash.com/en-us/merchants/article/common-photo-issues-explained",
      },
    ],
    sections: [
      {
        id: "light",
        title: "Light",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              "Put the dish near a window, out of direct sun. Soft daylight from the side shows texture without hard shadows. Turn off the flash, and move away from fluorescent light.",
              "If the frame is dark, move closer to the window and tap the food on your screen to set the exposure. If the food looks washed out, lower the exposure.",
            ],
          },
        ],
      },
      {
        id: "angle",
        title: "Angle",
        blocks: [
          {
            kind: "list",
            items: [
              "From above for plates, bowls and pizza, so every ingredient shows.",
              "From about 45 degrees for burgers, sandwiches and anything tall.",
              "Cut sandwiches, wraps and burritos, and stack the halves to show the inside.",
            ],
          },
        ],
      },
      {
        id: "framing",
        title: "Framing",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              "Show the whole dish, with a little space around it. Delivery apps crop photos to their own shapes, and an extreme close-up hides the portion.",
              `Hold the phone sideways for delivery apps: DoorDash only accepts landscape photos. With space around the dish, the same photo can be cropped square or portrait for Instagram.`,
            ],
          },
        ],
      },
      {
        id: "sharpness",
        title: "Sharpness and size",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              `Shoot at your phone’s full resolution, and move closer instead of using digital zoom. Menu Material asks you to retake a photo under 800 pixels on its short side, and DoorDash needs at least ${doordashMinimum} pixels. Enlarging a small photo doesn’t add detail.`,
              "Wipe the lens, hold still, and rest your elbows on the table if photos come out soft.",
            ],
          },
        ],
      },
      {
        id: "timing",
        title: "Timing and honesty",
        blocks: [
          {
            kind: "text",
            paragraphs: [
              "Photograph the dish straight after plating, before greens wilt and sauces set. Plate it the way a customer receives it: the photo is a promise about the portion and the ingredients.",
            ],
          },
        ],
      },
      helps(
        "Once you have a clear phone photo, Menu Material restyles the light and the setting and exports it for each platform. You can prepare a photo before you create an account. See [AI food photography](/ai-food-photography).",
      ),
    ],
    faqs: [
      {
        question: "Do I need a tripod or lights?",
        answer:
          "No. A window and a steady hand are enough for menu photos. Rest your elbows on the table if the photo comes out soft.",
      },
      {
        question: "Should I shoot in portrait or landscape?",
        answer:
          "Landscape for delivery apps, since DoorDash needs 16:9. Leave room around the dish and the same photo can be cropped square or portrait for Instagram.",
      },
      {
        question: "Should I use portrait mode?",
        answer:
          "Usually not. Portrait mode blurs the background, and it can smear the rim of a plate or a garnish along with it. A normal photo keeps the whole dish sharp.",
      },
    ],
    related: [
      "/guides/doordash-photo-requirements",
      "/guides/uber-eats-photo-requirements",
      "/guides/instagram-food-photo-sizes",
      "/ai-food-photography",
    ],
  },
];

const guidesHub: ContentPage = {
  path: "/guides",
  kind: "hub",
  title: "Menu photo size guides for restaurants",
  description:
    "Photo sizes and rules for DoorDash, Uber Eats, Toast, Google Business Profile and Instagram in one place, with a guide to food photos from your phone.",
  heading: "Guides for better menu photos.",
  intro:
    "What each platform asks of a menu photo, with the source for every number, and how to take a photo worth uploading.",
  label: "Guides",
  summary:
    "Photo sizes and rules for delivery apps, Google and Instagram, in one place.",
  updated,
  sections: [
    {
      id: "sizes",
      title: "Photo sizes at a glance",
      blocks: [
        {
          kind: "specs",
          rows: [
            [
              "DoorDash",
              `Landscape 16:9, at least ${doordashMinimum} pixels, under ${megabytes(doordash.maxBytes)}`,
            ],
            [
              "Uber Eats",
              `5:4 to 6:4, at least ${uber.minHeight} pixels tall, up to ${megabytes(uber.maxBytes)}, best at ${uberBest}`,
            ],
            [
              "Toast",
              `${toastSize} pixels recommended, up to ${megabytes(toast.maxBytes)}`,
            ],
            [
              "Google Business Profile",
              `At least ${googleMinimum} pixels, ${googleBest} recommended, up to ${megabytes(google.maxBytes)}`,
            ],
            [
              "Instagram",
              `${exportSize("feed")} or 1080 × 1440 for posts, ${exportSize("story")} for Stories`,
            ],
          ],
        },
      ],
    },
    {
      id: "guides",
      title: "The guides",
      blocks: [{ kind: "cards", paths: guidePages.map((page) => page.path) }],
    },
  ],
  faqs: [
    {
      question: "Can one photo work for every platform?",
      answer:
        "One shot can, exported once for each: every platform wants a different shape. Take it in landscape with space around the dish, so it can be cropped to 16:9, 5:4, square or portrait.",
    },
    {
      question: "How often do these rules change?",
      answer:
        "Platforms update their help pages without notice. Each guide shows the day it was last checked and links to its source, so you can confirm before a big upload.",
    },
  ],
  related: [
    "/ai-food-photography",
    "/delivery-app-photos",
    "/restaurant-social-media-posts",
    "/qr-code-menu",
  ],
};

export const contentPages: ContentPage[] = [
  ...productPages,
  ...audiencePages,
  guidesHub,
  ...guidePages,
];

const byPath = new Map(contentPages.map((page) => [page.path, page]));
export const contentPage = (path: string) => byPath.get(path);
export const pagesOfKind = (kind: ContentPage["kind"]) =>
  contentPages.filter((page) => page.kind === kind);

/** The day /about (app/about/page.tsx) last changed. */
export const aboutUpdated = updated;

// Pages with their own files under app/, for links and lists of pages.
export const fixedPages: Record<string, { label: string; summary: string }> = {
  "/": {
    label: "Menu Material",
    summary: "AI food photography for restaurants.",
  },
  "/pricing": {
    label: "Plans & pricing",
    summary: `Free to start with ${free}; Pro adds monthly images and every design.`,
  },
  "/about": {
    label: "About",
    summary: "What Menu Material is, who it’s for and what it costs.",
  },
  "/guidelines": {
    label: "Usage guidelines",
    summary: "Photo permissions, reviewing AI results and commercial use.",
  },
  "/privacy": {
    label: "Photo privacy",
    summary: "How photos, drafts and public menus are handled.",
  },
};

/** A page's short name and summary, wherever it is defined. */
export function pageCard(path: string) {
  const page = contentPage(path);
  if (page) return { path, label: page.label, summary: page.summary };
  const fixed = fixedPages[path];
  return fixed ? { path, ...fixed } : undefined;
}
