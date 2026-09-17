import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { purposeFixtures } from "./menu-purpose-fixtures.mjs";
import { installWorkerGraphics } from "./menu-worker-graphics.mjs";
import { renderDesignedMenuPdf } from "../lib/menu-pdf-v2.ts";
import { menuPrice } from "../lib/menu-document.ts";
import {
  menuContrast,
  menuTheme,
  recommendMenuDesigns,
} from "../lib/menu-design-system.ts";

installWorkerGraphics();
const root = "/private/tmp/menu-purpose-quality";
mkdirSync(root, { recursive: true });
const report = [];
for (const fixture of purposeFixtures())
  for (const paper of ["letter", "a4"]) {
    const menu = { ...fixture.menu, paper };
    const proof = await renderDesignedMenuPdf(menu);
    assert.equal(proof.pages, 1, `${fixture.key} stays a readable single page`);
    if (["bar", "cocktail", "smoothie"].includes(menu.design))
      assert.equal(recommendMenuDesigns(menu)[0].id, menu.design);
    const text = proof.layout.pages.flatMap((p) =>
      p.elements.filter((e) => e.kind === "text"),
    );
    const all = text.map((t) => t.text).join(" ");
    const placed = proof.layout.pages.flatMap((p) =>
      p.hits.map((h) => h.entryId),
    );
    for (const section of menu.sections)
      for (const item of section.items) {
        assert.equal(placed.filter((id) => id === item.id).length, 1);
        const itemText = text
          .filter((t) => t.entryId === item.id)
          .map((t) => t.text)
          .join(" ");
        assert(itemText.includes(item.name), `${item.name} is retained`);
        if (item.description)
          assert(
            itemText.includes(item.description),
            `${item.name}: description retained`,
          );
        for (const option of [...item.variants, ...item.additions]) {
          assert(all.includes(option.label), `${option.label} is retained`);
          assert(
            itemText.includes(menuPrice(option.price, "USD", menu.priceFormat)),
            `${item.name}: ${option.label} price retained`,
          );
        }
      }
    for (const page of proof.layout.pages) {
      const elements = page.elements.filter((e) => e.kind === "text");
      for (let i = 0; i < elements.length; i++) {
        const a = elements[i];
        assert(a.x >= 30 && a.x + a.width <= proof.layout.width - 30 + 0.1);
        assert(a.y >= 20 && a.y + a.height <= proof.layout.height - 20);
        if (
          [
            "item",
            "description",
            "price",
            "price-option",
            "price-column",
          ].includes(a.role)
        )
          assert(a.size >= 11);
        for (const b of elements.slice(i + 1)) {
          const dx =
            Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const dy =
            Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          assert(
            dx < 0.2 || dy < 0.2,
            `${fixture.key}: text collision between ${a.text} and ${b.text}`,
          );
        }
      }
    }
    const bytes = new Uint8Array(await proof.blob.arrayBuffer());
    assert.equal((await PDFDocument.load(bytes)).getPageCount(), proof.pages);
    writeFileSync(`${root}/${fixture.key}-${paper}.pdf`, bytes);
    report.push({
      purpose: fixture.key,
      paper,
      items: placed.length,
      pages: proof.pages,
      warnings: proof.warnings,
    });
  }
// Column labels must follow their prices across both columns and pages.
const base = purposeFixtures().find(
  (fixture) => fixture.key === "dive-bar",
).menu;
const tap = base.sections[0];
const expanded = {
  ...base,
  pageTarget: 0,
  sections: [
    {
      ...tap,
      items: Array.from({ length: 40 }, (_, n) => ({
        ...tap.items[n % tap.items.length],
        id: `tap-${n}`,
        name: `Tap selection ${n + 1}`,
      })),
    },
  ],
};
const continuation = await renderDesignedMenuPdf(expanded);
assert(continuation.pages > 1);
for (const page of continuation.layout.pages) {
  const headings = page.elements.filter(
    (e) => e.kind === "text" && e.role === "section",
  );
  const labels = page.elements.filter(
    (e) => e.kind === "text" && e.role === "price-column",
  );
  assert(headings.length > 0);
  for (const label of ["Half pint", "Pint"])
    assert.equal(
      labels.filter((e) => e.text === label).length,
      headings.length,
    );
}
const mixed = structuredClone(base);
mixed.sections = [mixed.sections[0]];
mixed.sections[0].items[1].variants[0].label = "Taster";
const mixedProof = await renderDesignedMenuPdf(mixed);
const mixedText = mixedProof.layout.pages.flatMap((p) =>
  p.elements.filter((e) => e.kind === "text"),
);
assert(!mixedText.some((e) => e.role === "price-column"));
for (const label of ["Half pint", "Pint", "Taster"])
  assert(
    mixedText.some((e) => e.text.includes(label)),
    `${label} remains correctly attached when options differ`,
  );
for (const design of ["cafe", "smoothie"])
  for (const appearance of ["light", "dark"])
    for (const color of ["#ffffff", "#000000", "#f0c940", "#23604b"]) {
      const theme = menuTheme({
        ...base,
        design,
        appearance,
        colorMode: "custom",
        color,
      });
      assert(menuContrast(theme.accent, theme.background) >= 4.5);
      assert(menuContrast(theme.accent, theme.subtle) >= 4.5);
    }
writeFileSync(`${root}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(
  `Purpose-specific menu proofs passed: content, prices, text bounds, collisions, readable type, and actual PDF page counts. Artifacts: ${root}`,
);
