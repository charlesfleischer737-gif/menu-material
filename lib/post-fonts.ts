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
] as const;
let fontLoad: Promise<void> | undefined;
export function loadPostFonts() {
  if (typeof FontFace === "undefined" || !document.fonts)
    return Promise.resolve();
  return (fontLoad ||= Promise.all(
    postFonts.map(async (f) => {
      const face = new FontFace(
        f.family,
        `url("/fonts/social/${encodeURIComponent(f.file)}")`,
        { weight: f.weight },
      );
      document.fonts.add(await face.load());
    }),
  )
    .then(() => {})
    .catch(() => {
      fontLoad = undefined;
      throw Error("The design fonts could not load. Please try again.");
    }));
}
