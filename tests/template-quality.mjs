// Export regressions plus a representative art-direction proof, using the real renderers.
import "./workspace-exports.mjs";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { renderPost } from "../lib/creation-export.ts";
import { postTemplates, postTemplateExample } from "../lib/post-templates.ts";
const root =
  (await import("node:os")).tmpdir() + "/menu-template-art-direction";
mkdirSync(root, { recursive: true });
const sheet = createCanvas(1500, 880),
  sc = sheet.getContext("2d");
sc.fillStyle = "#e8e7e0";
sc.fillRect(0, 0, 1500, 880);
for (const [n, t] of postTemplates.entries()) {
  const draft = { ...postTemplateExample(t.id), compositionVersion: 2 };
  for (const channel of ["feed", "story"]) {
    const c = createCanvas(1, 1);
    const result = await renderPost(
      c,
      draft,
      { name: draft.restaurantName, currency: "USD" },
      channel,
    );
    for (let i = 0; i < result.textBoxes.length; i++)
      for (let j = i + 1; j < result.textBoxes.length; j++) {
        const a = result.textBoxes[i],
          b = result.textBoxes[j];
        const overlapX =
            Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
          overlapY =
            Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        assert(
          overlapX < 2 || overlapY < 2,
          `${t.id}/${channel}: text regions must not collide`,
        );
      }
    writeFileSync(
      `${root}/post-${t.id}-${channel}.png`,
      c.toBuffer("image/png"),
    );
    if (channel === "feed") {
      const x = (n % 5) * 300 + 10,
        y = Math.floor(n / 5) * 440 + 10;
      sc.drawImage(c, x, y, 280, 350);
      sc.fillStyle = "#28342b";
      sc.font = '16px "Post Sans"';
      sc.fillText(t.name, x, y + 377);
    }
  }
}
writeFileSync(`${root}/post-collection.jpg`, sheet.toBuffer("image/jpeg"));
console.log(`PASS: 20 representative post proofs. Artifacts: ${root}`);

const ordinaryTitle = "Wood-roasted chicken with preserved lemon";
for (const id of ["special", "brunch", "event"]) {
  for (const channel of ["feed", "story"]) {
    const draft = {
      ...postTemplateExample(id),
      title: ordinaryTitle,
      compositionVersion: 2,
    };
    const c = createCanvas(1, 1),
      result = await renderPost(
        c,
        draft,
        { name: "The Neighborhood Kitchen", currency: "USD" },
        channel,
      );
    assert(result.renderedText.includes(ordinaryTitle));
    assert(
      result.photoBoxes[0].height >= 400,
      "Ordinary names must leave a substantial photograph",
    );
    writeFileSync(
      `${root}/ordinary-${id}-${channel}.png`,
      c.toBuffer("image/png"),
    );
  }
}
console.log(
  "PASS: ordinary 40-character customer headlines retain generous photography in Post and Story formats",
);
