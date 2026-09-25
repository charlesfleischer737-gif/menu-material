// Campaigns: a special needs a real price, and its graphics use the post fonts
// and keep a Story's words clear of Instagram's bars.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createCanvas,
  GlobalFonts,
  loadImage,
  DOMMatrix,
  Path2D,
  ImageData,
} from "@napi-rs/canvas";
const root = mkdtempSync(join(tmpdir(), "menu-material-campaigns-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
const { handle } = await import("../lib/server/api.ts");
const { localTime, defaultStyle } = await import("../lib/promotions.ts");
const { renderOffer } = await import("../lib/offer-export.ts");
const { postFonts } = await import("../lib/post-fonts.ts");
for (const f of postFonts)
  GlobalFonts.registerFromPath("public/fonts/social/" + f.file, f.family);
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData });
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.createImageBitmap = async (blob) => {
  const im = await loadImage(Buffer.from(await blob.arrayBuffer()));
  im.close = () => {};
  return im;
};
const jpg = readFileSync("public/pasta.jpg");
globalThis.fetch = async (url) => {
  assert(String(url).startsWith("/api/assets/"), `Unexpected fetch ${url}`);
  return new Response(jpg, { headers: { "Content-Type": "image/jpeg" } });
};
let cookie = "",
  checks = 0;
async function call(path, b, expected = 200) {
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method: b === undefined ? "GET" : "POST",
      headers: {
        cookie,
        ...(b === undefined || b instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: b instanceof FormData ? b : JSON.stringify(b),
    }),
  );
  const data = await res
    .clone()
    .json()
    .catch(() => null);
  assert.equal(res.status, expected, `${path}: ${JSON.stringify(data)}`);
  if (res.headers.has("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return data;
}
try {
  await call("auth/dev", {});
  await call("restaurant", {
    name: "Campaign Kitchen",
    cuisine: "Italian",
    brand: "Simple",
    currency: "USD",
    timezone: "America/New_York",
    style: defaultStyle,
    hours: Array.from({ length: 7 }, (_, day) => ({
      day,
      open: "11:00",
      close: "22:00",
      closed: false,
    })),
  });
  const dish = (
    await call("dishes", {
      name: "Pasta",
      description: "Tomatoes and basil",
      price: 14,
      category: "Pasta",
      confirmed: true,
    })
  ).id;
  const upload = new FormData();
  upload.set("file", new File([jpg], "dish.jpg", { type: "image/jpeg" }));
  upload.set("normalized", new File([jpg], "dish.jpg", { type: "image/jpeg" }));
  upload.set("dishId", dish);
  const photo = (await call("assets", upload, 201)).id;
  await call("assets/" + photo + "/approve", { accurate: true });
  const offer = {
    type: "special",
    title: "Pasta tonight",
    description: "Our tomato pasta",
    price: 0,
    caption: "Dinner is ready.",
    startsLocal: localTime(Date.now() - 3600000, "America/New_York"),
    endsLocal: localTime(Date.now() + 3600000, "America/New_York"),
    items: [{ dishId: dish, quantity: 1, photoId: photo }],
    style: defaultStyle,
  };
  let promo = (await call("promotions", offer)).promotion;
  const approve = (expected) =>
    call(
      "promotions/" + promo.id + "/approve",
      { revision: promo.revision, accurate: true },
      expected,
    );
  const refused = await approve(400);
  assert.match(refused.error, /Add the offer price/);
  promo = (
    await call("promotions/" + promo.id, {
      ...offer,
      price: 1250,
      revision: promo.revision,
    })
  ).promotion;
  await approve(200);
  checks += 2;
} finally {
  rmSync(root, { recursive: true, force: true });
}

const restaurant = {
  name: "Campaign Kitchen",
  currency: "USD",
  timezone: "America/New_York",
};
for (const format of ["story", "feed"])
  for (const price of [0, 1850]) {
    const c = createCanvas(1, 1),
      ctx = c.getContext("2d"),
      fill = ctx.fillText.bind(ctx),
      lines = [];
    ctx.fillText = (text, x, y) => {
      lines.push({ text, y, size: Number(ctx.font.match(/([\d.]+)px/)[1]) });
      assert.match(ctx.font, /"Post Sans"/, "Offers use the post fonts");
      return fill(text, x, y);
    };
    await renderOffer(
      c,
      {
        title: "Pasta night",
        description: "Our tomato pasta with basil, made fresh every evening.",
        price,
        items: [{ dishId: "pasta", quantity: 1, photoId: "pasta" }],
        startsLocal: "2026-09-25T17:00",
        endsLocal: "2026-09-25T21:00",
        template: "classic",
      },
      restaurant,
      [{ id: "pasta", name: "Tomato pasta" }],
      format,
    );
    assert.equal(
      lines.some((l) => /0\.00/.test(l.text)),
      false,
      "An offer without a price never shows $0.00",
    );
    assert.equal(
      lines.some((l) => l.text === "$18.50"),
      price > 0,
    );
    if (format === "story")
      for (const l of lines)
        assert(
          l.y >= 270 && l.y + l.size * 1.2 <= 1540,
          `Story text between Instagram's bars: ${l.text} at ${l.y}`,
        );
    checks += 2;
  }
console.log(
  `PASS: ${checks} Campaigns checks: a real price before approval, post fonts, no $0.00, and Story text clear of Instagram's bars.`,
);
