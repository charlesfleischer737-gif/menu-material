import { newMenuEntry, type MenuSection } from "./menu-document";

/** Deliberately conservative: only explicit terminal prices are read; all rows require review. */
export function parsePastedMenu(text: string): MenuSection[] {
  const sections: MenuSection[] = [];
  let section: MenuSection = {
    id: crypto.randomUUID(),
    name: "Dishes",
    description: "",
    pageBreakBefore: false,
    items: [],
  };
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    const match = line.match(
      /^(.*?)\s+(?:[$€£]\s*)?(\d{1,6}(?:[.,]\d{2})?)\s*$/,
    );
    if (
      !match &&
      (line.endsWith(":") ||
        (line === line.toUpperCase() && /[A-Z]/.test(line) && line.length < 70))
    ) {
      if (section.items.length) sections.push(section);
      section = {
        id: crypto.randomUUID(),
        name: line.replace(/:$/, ""),
        description: "",
        pageBreakBefore: false,
        items: [],
      };
    } else if (match) {
      const [name, ...description] = match[1].split(/\s+[—–|]\s+/);
      section.items.push(
        newMenuEntry({
          name: name.trim(),
          description: description.join(" — "),
          price: Math.round(Number(match[2].replace(",", ".")) * 100),
          sourceReviewed: false,
        }),
      );
    } else if (section.items.length)
      section.items[section.items.length - 1].description +=
        (section.items.at(-1)!.description ? " " : "") + line;
    else
      section.items.push(
        newMenuEntry({
          name: line.slice(0, 120),
          description: line.slice(120),
          price: null,
          sourceReviewed: false,
        }),
      );
  }
  if (section.items.length) sections.push(section);
  return sections;
}
