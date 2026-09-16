import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { photoStyles, styleCategories } from "../lib/photo-styles.ts";
import { styleFor } from "../lib/studio.ts";
import {
  postTemplates,
  getPostTemplate,
  applyPostTemplate,
  postTemplateExample,
} from "../lib/post-templates.ts";
const hashes = new Set();
assert.equal(styleCategories.length, 7);
assert.equal(photoStyles.length, 56);
for (const category of styleCategories)
  assert.equal(photoStyles.filter((s) => s.category === category.id).length, 8);
for (const style of photoStyles) {
  const bytes = readFileSync("public" + style.image);
  assert.equal(bytes.subarray(0, 4).toString(), "RIFF", style.id);
  assert.equal(bytes.subarray(8, 12).toString(), "WEBP", style.id);
  hashes.add(createHash("sha256").update(bytes).digest("hex"));
  const configured = styleFor(
    { look: style.id },
    { style: { primary: "#235b48", accent: "#eeeeee", referenceIds: [] } },
  );
  assert.equal(configured.photoStyle, style.prompt);
  if (["bar", "beverage"].includes(style.category)) {
    assert.match(configured.photoStyle, /original (glass|cup|vessel)/);
    assert.match(configured.photoStyle, /visible branding/);
  }
  assert(
    configured.photoStyle.length <= 300,
    "Preset exceeds live generation schema: " + style.id,
  );
  if (style.angle === "overhead") {
    const keepAngle = styleFor({ look: style.id, angle: "keep" }, {});
    assert(!keepAngle.photoStyle.includes("Straight overhead"), style.id);
    assert(keepAngle.photoStyle.length <= 300, style.id);
  }
  assert.deepEqual(
    configured.referenceIds,
    [],
    "Example photos must never replace the customer source",
  );
}
assert.equal(hashes.size, 56, "Every preset needs its own photograph");
assert.equal(new Set(photoStyles.map((s) => s.prompt)).size, 56);
assert.equal(postTemplates.length, 10);
assert.equal(new Set(postTemplates.map((t) => t.example)).size, 10);
const customer = {
  title: "Our confirmed offer",
  price: "17.50",
  validity: "Tuesday at noon",
  caption: "Keep my wording",
  items: [{ name: "Our real dish", photoId: "private-source" }],
  layouts: { feed: { x: 37, y: 60, zoom: 1.2 } },
};
for (const t of postTemplates) {
  const example = postTemplateExample(t.id),
    patch = applyPostTemplate(customer, t.id),
    result = { ...customer, ...patch };
  assert.equal(example.items[0].photoUrl, t.example);
  assert.equal(result.price, customer.price);
  assert.equal(result.validity, customer.validity);
  assert.equal(result.caption, customer.caption);
  assert.equal(result.title, customer.title);
  assert.deepEqual(
    result.items,
    customer.items,
    "Selecting a template must never replace the real food with example imagery",
  );
  assert.equal(result.layouts.feed.x, 37);
}
assert.equal(getPostTemplate("photo").id, "editorial");
assert.equal(getPostTemplate("price").id, "special");
assert.equal(getPostTemplate("story").id, "chef");
console.log(
  "PASS: 56 distinct style photos and generation prompts; 7 categories with 8 styles each; 10 template examples; customer facts and legacy drafts preserved.",
);
