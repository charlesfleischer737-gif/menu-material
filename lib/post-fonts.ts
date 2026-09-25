// Weights are the exact cuts shipped, so canvases never synthesize bold or italic.
export const postFonts = [
  { family: "Post Sans", file: "DMSans-Variable.ttf", weight: "100 900" },
  { family: "Post Condensed", file: "BarlowCondensed-Bold.ttf", weight: "700" },
  {
    family: "Post Serif",
    file: "CormorantGaramond-Variable.ttf",
    weight: "300 700",
  },
  {
    family: "Post Italic",
    file: "CormorantGaramond-Italic.ttf",
    weight: "300 700",
  },
  { family: "Post Hand", file: "Caveat-Variable.ttf", weight: "400 700" },
  {
    family: "Post Display",
    file: "InstrumentSerif-Regular.ttf",
    weight: "400",
  },
  {
    family: "Post Display Italic",
    file: "InstrumentSerif-Italic.ttf",
    weight: "400",
  },
  { family: "Post Poster", file: "Anton-Regular.ttf", weight: "400" },
  { family: "Post Soft", file: "Fraunces-SoftSemiBold.ttf", weight: "600" },
  {
    family: "Post Soft Italic",
    file: "Fraunces-SoftItalic.ttf",
    weight: "500",
  },
  {
    family: "Post Grotesk",
    file: "BricolageGrotesque-Bold.ttf",
    weight: "700",
  },
] as const;
export type PostFontFamily = (typeof postFonts)[number]["family"];
const loaded = new Map<string, Promise<void>>();
function loadFamily(font: (typeof postFonts)[number]) {
  let promise = loaded.get(font.family);
  if (!promise) {
    promise = (async () => {
      const face = new FontFace(
        font.family,
        `url("/fonts/social/${encodeURIComponent(font.file.replace(/\.ttf$/, ".woff2"))}")`,
        { weight: font.weight },
      );
      document.fonts.add(await face.load());
    })().catch(() => {
      loaded.delete(font.family);
      throw Error("The design fonts could not load. Please try again.");
    });
    loaded.set(font.family, promise);
  }
  return promise;
}
/** Loads the given families, or every post font. Each file downloads once. */
export function loadPostFonts(families?: readonly string[]) {
  if (typeof FontFace === "undefined" || typeof document === "undefined")
    return Promise.resolve();
  if (!document.fonts) return Promise.resolve();
  const wanted = families
    ? postFonts.filter((f) => families.includes(f.family))
    : postFonts;
  return Promise.all(wanted.map(loadFamily)).then(() => {});
}
