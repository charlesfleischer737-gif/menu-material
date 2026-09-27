// Screenshots for the homepage's Menus & QR codes and Posts sections: a
// sample restaurant set up in Menu Material itself, with dish photos from the
// style library (docs/HOMEPAGE_IMAGES.md). Each is a set of WebP copies in
// public/homepage/product/; tests/web-assets.mjs checks their sizes, shape and
// weight against these entries.

export type ProductScreenshot = {
  name: string;
  /** Widths of the copies, smallest first; the last is the largest. */
  widths: number[];
  /** The largest copy's size, for the img element's width and height. */
  width: number;
  height: number;
  /** The width it's shown at, for the browser to choose a copy. */
  sizes: string;
  alt: string;
  caption: string;
};

export const productScreenshotPath = (name: string, width: number) =>
  `/homepage/product/${name}-${width}.webp`;

export const productScreenshotSrcSet = ({ name, widths }: ProductScreenshot) =>
  widths.map((w) => `${productScreenshotPath(name, w)} ${w}w`).join(", ");

export const productScreenshots = {
  menu: {
    name: "menu-phone",
    widths: [320, 640, 960],
    width: 960,
    height: 2081,
    // A 300 px phone frame, 72% of the screen on a phone.
    sizes: "(max-width: 760px) min(72vw, 300px), 300px",
    alt: "A sample restaurant’s dinner menu on a phone: open now until 10 PM, buttons to call and get directions, search, a diet choice and Hide allergens, then dishes labeled “Contains: gluten, milk” and “Allergens not listed — ask us”.",
    caption:
      "A sample menu as guests see it after scanning. Its dish photos are illustrative AI images.",
  },
  post: {
    name: "post-maker",
    widths: [400, 800, 1200],
    width: 1200,
    height: 1937,
    sizes: "(max-width: 760px) min(420px, calc(100vw - 44px)), 420px",
    alt: "Post Maker with a sample post for Burnt Basque cheesecake, $11.00, in The daily special design, with two more designs for the dish below it.",
    caption:
      "A sample post in Post Maker. Its dish photo is an illustrative AI image.",
  },
} satisfies Record<string, ProductScreenshot>;
