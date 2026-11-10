import { FREE_SIGNUP_IMAGES } from "./plans";
import { siteSummary } from "./site-links";
import { fixedPages, pagesOfKind, type ContentPage } from "./site-pages";

/**
 * /llms.txt: a plain-text map of the public site for AI assistants, in the
 * llms.txt convention (a title, a one-paragraph summary, then lists of
 * links with a line about each).
 */
export function llmsText(origin: string) {
  const link = (path: string, label: string, summary: string) =>
    `- [${label}](${new URL(path, origin).href}): ${summary}`;
  const pages = (kind: ContentPage["kind"]) =>
    pagesOfKind(kind).map((page) => link(page.path, page.label, page.summary));
  const fixed = (path: string) =>
    link(path, fixedPages[path].label, fixedPages[path].summary);
  return [
    "# Menu Material",
    "",
    `> ${siteSummary}`,
    "",
    `Every image starts from the restaurant's own photo of a real dish; the light, backdrop and setting change, and the owner approves each result. Every account starts with ${FREE_SIGNUP_IMAGES} free images, with no credit card. Menu Material does not take orders or post to social media.`,
    "",
    "## Product",
    "",
    ...pages("product"),
    fixed("/pricing"),
    "",
    "## Who it is for",
    "",
    ...pages("audience"),
    "",
    "## Guides",
    "",
    ...pages("hub"),
    ...pages("guide"),
    "",
    "## Company",
    "",
    fixed("/about"),
    fixed("/guidelines"),
    fixed("/privacy"),
    "",
  ].join("\n");
}
