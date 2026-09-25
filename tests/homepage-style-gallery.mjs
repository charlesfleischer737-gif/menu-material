// Browser checks of the homepage style gallery's choices, in the desktop
// list, the phone row and the Enlarge dialog: arrow keys choose a look however
// briefly the key is down (an instant press is what on-screen keyboards, voice
// control and switch devices send), Tab lands on the chosen look without
// changing it, and clicking still chooses. The page is read, never changed.
//
// Run against a local dev server (npm run dev):
//   MENU_MATERIAL_QA_ORIGIN=http://localhost:5173 node tests/homepage-style-gallery.mjs
// (set PLAYWRIGHT_MODULE to Playwright's index.mjs if it isn't installed here).
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.MENU_MATERIAL_QA_ORIGIN || "http://localhost:5173";
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Homepage browser checks run against a local server.",
);
const looks = [
  "Original photo",
  "New backdrop",
  "From above",
  "Served by hand",
  "Close-up",
];
const browser = await chromium.launch();
let checks = 0;

async function check(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator(".pw-style-gallery").scrollIntoViewIfNeeded();
  const label = `${width}px`;

  async function chosen(scope) {
    return page.evaluate(
      (scope) => ({
        focused: document.activeElement?.getAttribute("aria-label"),
        checked: document
          .querySelector(`${scope} [role=radio][data-state=checked]`)
          ?.getAttribute("aria-label"),
      }),
      scope,
    );
  }
  // The photo and its name follow once the chosen photo has loaded.
  async function shows(name, where) {
    await page.waitForFunction(
      ([name, where]) => document.querySelector(where)?.textContent === name,
      [name, where],
    );
  }
  // Key down and up in one task, before the focus move Radix defers to a
  // timer: an instant press.
  async function instant(key) {
    await page.evaluate((key) => {
      const target = document.activeElement;
      for (const type of ["keydown", "keyup"])
        target.dispatchEvent(
          new KeyboardEvent(type, { key, bubbles: true, cancelable: true }),
        );
    }, key);
  }
  // Focus moves on a timer after the key, so wait (briefly) for it to settle.
  async function expectChosen(scope, name, how) {
    await page
      .waitForFunction(
        ([scope, name]) =>
          document.activeElement?.getAttribute("aria-label") === name &&
          document
            .querySelector(`${scope} [role=radio][data-state=checked]`)
            ?.getAttribute("aria-label") === name,
        [scope, name],
        { timeout: 2000 },
      )
      .catch(() => {});
    assert.deepEqual(
      await chosen(scope),
      { focused: name, checked: name },
      `${label} ${how}`,
    );
    checks++;
  }

  const gallery = ".pw-style-workbench";
  const caption = ".pw-style-result figcaption strong";
  await page.locator(".pw-style-result-button").focus();
  await page.keyboard.press("Tab");
  await expectChosen(gallery, looks[1], "Tab lands on the chosen look");
  await instant("ArrowDown");
  await expectChosen(gallery, looks[2], "an instant ArrowDown chooses");
  await shows(looks[2], caption);
  await instant("ArrowRight");
  await expectChosen(gallery, looks[3], "an instant ArrowRight chooses");
  await page.keyboard.press("ArrowUp");
  await expectChosen(gallery, looks[2], "ArrowUp chooses the previous look");
  await page.keyboard.press("ArrowLeft");
  await expectChosen(gallery, looks[1], "ArrowLeft chooses the previous look");
  await page.keyboard.press("ArrowLeft");
  await expectChosen(gallery, looks[0], "ArrowLeft reaches the first look");
  await page.keyboard.press("ArrowLeft");
  await expectChosen(gallery, looks[4], "arrows wrap from first to last");
  await shows(looks[4], caption);
  await page.locator(`${gallery} .pw-style-option`).nth(2).click();
  await shows(looks[2], caption);
  assert.equal((await chosen(gallery)).checked, looks[2], `${label} click`);
  checks++;

  const dialog = ".pw-style-dialog";
  await page.locator(".pw-style-result-button").click();
  await page.locator(`${dialog} [role=radio][data-state=checked]`).focus();
  await instant("ArrowRight");
  await expectChosen(dialog, looks[3], "an instant arrow chooses in Enlarge");
  await shows(looks[3], `${dialog} [data-slot="dialog-title"]`);
  checks++;
  await page.close();
}

await check(1440, 900);
await check(390, 844);
await browser.close();
console.log(
  `Homepage style gallery: ${checks} browser checks passed (arrow keys at any key speed, Tab, click and Enlarge, desktop and phone).`,
);
