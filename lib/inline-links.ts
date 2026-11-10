// Page copy for the public site is plain text with one piece of markup:
// [label](/path) for a link. Pages render the links; structured data and
// llms.txt use the plain text.

export type InlinePart = string | { href: string; label: string };

const link = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** The text split into plain runs and links, in order. */
export function inlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of text.matchAll(link)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ label: match[1], href: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** The text with each link replaced by its label. */
export const plainText = (text: string) => text.replace(link, "$1");

/** Every address the text links to. */
export const inlineHrefs = (text: string) =>
  [...text.matchAll(link)].map((match) => match[2]);
