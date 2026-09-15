// Run only against an isolated local preview (see docs/PROMOTION_EXPANSION.md).
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { localTime } from "../lib/promotions.ts";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  acceptDownloads: true,
});
const request = context.request,
  base = process.env.PLATED_QA_ORIGIN || "http://localhost:5174";
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Browser tests require an isolated local preview.",
);
async function api(path, body) {
  const res = await request[body === undefined ? "get" : "post"](
    base + "/api/" + path,
    body === undefined ? {} : { data: body },
  );
  const data = await res.json();
  assert(res.ok(), path + ": " + JSON.stringify(data));
  return data;
}
const artifactDir = "outputs/promotion-qa";
mkdirSync(artifactDir, { recursive: true });
await api("auth/dev", {});
let state = await api("state");
assert(
  state.local &&
    (state.restaurant.name.startsWith("QA ·") ||
      (state.restaurant.name === "Your restaurant" && !state.dishes.length)),
  "Use a separate DISHLIGHT_DATA_DIR for browser tests.",
);
for (const promo of state.promotions || [])
  if (promo.published) await api("promotions/" + promo.id + "/unpublish", {});
await api("restaurant", {
  name: "QA · Orchard Kitchen",
  cuisine: "Seasonal neighborhood cooking",
  brand: "",
  currency: "USD",
  timezone: "America/New_York",
  style: {
    primary: "#283a2c",
    accent: "#ede0bf",
    tone: "Warm and welcoming",
    photoStyle: "Natural daylight",
    referenceIds: [],
  },
  orderingUrl: "https://example.com/order",
  hours: Array.from({ length: 7 }, (_, day) => ({
    day,
    open: "11:00",
    close: "21:00",
    closed: false,
  })),
});
let dish = state.dishes.find((d) => d.name === "Tomato basil pasta");
if (!dish) {
  dish = await api("dishes", {
    name: "Tomato basil pasta",
    description: "Spaghetti with tomato sauce, basil and Parmesan.",
    price: 15,
    category: "Pasta",
    preserve: "Keep the same pasta portion and basil leaves.",
    confirmed: true,
  });
  const upload = await request.post(base + "/api/assets", {
    multipart: {
      file: {
        name: "qa-pasta.jpg",
        mimeType: "image/jpeg",
        buffer: readFileSync("public/pasta.jpg"),
      },
      normalized: {
        name: "working.jpg",
        mimeType: "image/jpeg",
        buffer: readFileSync("public/pasta.jpg"),
      },
      dishId: dish.id,
    },
  });
  const photo = await upload.json();
  assert(upload.ok(), JSON.stringify(photo));
  await api("assets/" + photo.id + "/approve", { accurate: true });
}
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base, { waitUntil: "networkidle" });
await page
  .getByRole("button", { name: "Promote tonight’s special", exact: true })
  .click();
const workspace = page.locator(".promotion-workspace");
await page.waitForTimeout(1000);

await page.screenshot({ path: artifactDir + "/debug.png", fullPage: true });
await workspace.getByLabel("Dish", { exact: true }).selectOption(dish.id);
await workspace
  .getByLabel("Offer title", { exact: true })
  .fill("Tonight’s tomato basil pasta");
await workspace.getByLabel("Offer price (USD)", { exact: true }).fill("14.50");
await workspace
  .getByLabel("Starts", { exact: true })
  .fill(localTime(Date.now() - 3600000, "America/New_York"));
await workspace
  .getByLabel("Ends", { exact: true })
  .fill(localTime(Date.now() + 3600000, "America/New_York"));
await page.waitForTimeout(1200);
await page.screenshot({
  path: artifactDir + "/desktop-special.png",
  fullPage: true,
});
await workspace
  .getByText("I checked the food, quantities, price, caption and times.", {
    exact: false,
  })
  .click();
await workspace
  .getByRole("button", { name: "Approve package", exact: true })
  .click();
await workspace
  .getByRole("button", { name: "Publish special to hosted menu", exact: true })
  .waitFor({ state: "visible" });
await page.waitForTimeout(600);
const exportOne = await Promise.all([
  page.waitForEvent("download"),
  workspace.getByRole("button", { name: "Download feed", exact: true }).click(),
]);
await exportOne[0].saveAs(artifactDir + "/feed.png");
await workspace.getByLabel("Offer price (USD)", { exact: true }).fill("16.75");
await page.waitForTimeout(1200);
assert(
  await workspace
    .getByRole("button", {
      name: "Publish special to hosted menu",
      exact: true,
    })
    .isDisabled(),
  "Price edit requires review",
);
await workspace
  .getByText("I checked the food, quantities, price, caption and times.", {
    exact: false,
  })
  .click();
await workspace
  .getByRole("button", { name: "Approve package", exact: true })
  .click();
await page.waitForTimeout(600);
const exportTwo = await Promise.all([
  page.waitForEvent("download"),
  workspace.getByRole("button", { name: "Download feed", exact: true }).click(),
]);
await exportTwo[0].saveAs(artifactDir + "/feed-price-edited.png");
await workspace
  .getByRole("button", { name: "Publish special to hosted menu", exact: true })
  .click();
await page.waitForTimeout(600);
state = await api("state");
const p = state.promotions[0];
assert(p.published);
assert.equal(p.published.price, 1675);
assert.equal(
  state.jobs.length,
  0,
  "No image generation while editing/exporting",
);
await workspace.getByRole("tab", { name: "Story", exact: true }).click();
await page.waitForTimeout(500);
const story = await Promise.all([
  page.waitForEvent("download"),
  workspace
    .getByRole("button", { name: "Download story", exact: true })
    .click(),
]);
await story[0].saveAs(artifactDir + "/story.png");
await workspace.getByRole("tab", { name: "Sign", exact: true }).click();
await page.waitForTimeout(500);
const sign = await Promise.all([
  page.waitForEvent("download"),
  workspace.getByRole("button", { name: "Download sign", exact: true }).click(),
]);
await sign[0].saveAs(artifactDir + "/sign.png");
await page.reload({ waitUntil: "networkidle" });
await workspace.getByLabel("Offer price (USD)", { exact: true }).waitFor();
assert.equal(
  await workspace.getByLabel("Offer price (USD)", { exact: true }).inputValue(),
  "16.75",
  "Saved price survives refresh",
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: artifactDir + "/phone-special.png",
  fullPage: true,
});
assert(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "No phone horizontal overflow",
);
await page.getByRole("button", { name: "Menu tools", exact: true }).click();
await page.getByRole("tab", { name: "Weekly assistant", exact: true }).click();
await page
  .getByRole("button", { name: "Suggest promotions", exact: true })
  .click();
await page
  .getByRole("button", { name: "Edit this promotion" })
  .first()
  .waitFor();
await page.screenshot({
  path: artifactDir + "/phone-weekly.png",
  fullPage: true,
});
await page
  .getByRole("button", { name: "Restaurant settings", exact: true })
  .click();
await page.waitForTimeout(600);
await page.screenshot({ path: artifactDir + "/phone-settings.png" });
await page.keyboard.press("Escape");
const publicPage = await context.newPage();
await publicPage.setViewportSize({ width: 390, height: 844 });
await publicPage.goto(base + "/m/" + state.restaurant.slug, {
  waitUntil: "domcontentloaded",
});
await publicPage.getByText("$16.75", { exact: true }).first().waitFor();
await publicPage.waitForTimeout(1200);
assert(
  await publicPage.getByText("$16.75", { exact: true }).first().isVisible(),
);
await publicPage.screenshot({
  path: artifactDir + "/phone-public-menu.png",
  fullPage: true,
});
assert.equal(errors.length, 0, JSON.stringify(errors));
console.log(
  JSON.stringify({
    passed: true,
    checks:
      "Core creation, editing, approval, PNG exports, explicit publication, persistence, mobile overflow, weekly suggestions and customer menu",
    artifacts: artifactDir,
    errors,
  }),
);
await browser.close();
