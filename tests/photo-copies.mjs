// Smaller copies of guest-menu photos: the owner's browser uploads them after
// publishing, guests' phones choose one with srcset, the full photo stands in
// for a missing copy, and deleting the photo removes every copy.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-material-photo-copies-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.APP_ORIGIN = "http://localhost";
const { handle } = await import("../lib/server/api.ts");
const { bucket, one } = await import("../lib/server/core.ts");
const { validateImageDimensions } = await import(
  "../lib/server/image-validation.ts"
);
const { newMenuDocument, newMenuEntry } = await import(
  "../lib/menu-document.ts"
);
const { createCanvas } = createRequire(import.meta.url)("@napi-rs/canvas");

let cookie = "",
  checks = 0;
async function send(path, data, method) {
  return handle(
    new Request("http://localhost/api/" + path, {
      method: method || (data === undefined ? "GET" : "POST"),
      headers: {
        cookie,
        ...(data === undefined || data instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        data === undefined
          ? undefined
          : data instanceof FormData
            ? data
            : JSON.stringify(data),
    }),
  );
}
async function call(path, data, expected = 200, method) {
  const res = await send(path, data, method);
  const value = await res.json().catch(() => null);
  assert.equal(res.status, expected, `${path}: ${JSON.stringify(value)}`);
  checks++;
  if (res.headers.get("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return value;
}
const jpeg = (width, height) =>
  new File(
    [createCanvas(width, height).toBuffer("image/jpeg")],
    `w${width}.jpg`,
    { type: "image/jpeg" },
  );
const photo = () =>
  new File([readFileSync("public/pasta.jpg")], "dish.jpg", {
    type: "image/jpeg",
  });

try {
  await call("auth/dev", {});
  await call("restaurant/name", { name: "Corner House" });
  const dish = await call("dishes", {
    name: "Pasta",
    description: "Tomato",
    price: 14,
    confirmed: true,
  });
  const form = new FormData();
  form.set("file", photo());
  form.set("normalized", photo(), "working.jpg");
  form.set("dishId", dish.id);
  form.set("kind", "source");
  const { id: photoId } = await call("assets", form, 201);
  await call(`assets/${photoId}/approve`, { accurate: true });
  const menu = await call("menus", {
    id: crypto.randomUUID(),
    draft: newMenuDocument({
      sections: [
        {
          id: crypto.randomUUID(),
          name: "Mains",
          description: "",
          pageBreakBefore: false,
          items: [
            newMenuEntry({
              dishId: dish.id,
              name: "Pasta",
              description: "Tomato",
              price: 1400,
              photoId,
            }),
          ],
        },
      ],
    }),
  });
  await call(`menus/${menu.id}/publish`, { revision: menu.revision });
  const { slug } = await one("SELECT slug FROM restaurants");

  // Every width is still needed.
  assert.deepEqual((await call("assets/variants", { ids: [photoId] })).needed, {
    [photoId]: [480, 960, 1440],
  });
  // A copy must be a JPEG of the width it claims.
  const wrong = new FormData();
  wrong.set("w480", jpeg(500, 400));
  await call(`assets/${photoId}/variants`, wrong, 400);
  const notJpeg = new FormData();
  notJpeg.set(
    "w480",
    new File([createCanvas(480, 360).toBuffer("image/png")], "w.png", {
      type: "image/png",
    }),
  );
  await call(`assets/${photoId}/variants`, notJpeg, 400);
  // The owner's browser sends two copies; the original is too small for 1440.
  const copies = new FormData();
  copies.set("w480", jpeg(480, 360));
  copies.set("w960", jpeg(960, 720));
  copies.set("skip", "1440");
  await call(`assets/${photoId}/variants`, copies);
  assert.deepEqual(
    (await call("assets/variants", { ids: [photoId] })).needed,
    {},
    "nothing left to make",
  );

  // Guests get the copy their screen asks for, straight away (the photo is
  // live), cached for a week; any other width gets the full photo.
  cookie = "";
  const small = await send(`public/${slug}/assets/${photoId}?w=480`);
  assert.equal(small.status, 200);
  assert.equal(small.headers.get("content-type"), "image/jpeg");
  assert.match(small.headers.get("cache-control"), /public, max-age=604800/);
  const smallSize = validateImageDimensions(
    new Uint8Array(await small.arrayBuffer()),
    "image/jpeg",
  );
  assert.equal(smallSize.width, 480);
  const full = await send(`public/${slug}/assets/${photoId}?w=1440`);
  assert.equal(full.status, 200);
  const fullSize = validateImageDimensions(
    new Uint8Array(await full.arrayBuffer()),
    "image/jpeg",
  );
  assert(fullSize.width > 960, "a missing copy falls back to the full photo");
  checks += 5;

  // Deleting the photo removes it and every copy, public and private.
  await call("auth/dev", {});
  const rid = (await one("SELECT id FROM restaurants")).id;
  assert(await bucket().head(`public/${rid}/${photoId}-w480`));
  assert(await bucket().head(`private/${rid}/variants/${photoId}-w960.jpg`));
  await call(`assets/${photoId}`, { confirm: "DELETE" }, 200, "DELETE");
  for (const key of [
    `public/${rid}/${photoId}-w480`,
    `public/${rid}/${photoId}-w960`,
    `private/${rid}/variants/${photoId}-w480.jpg`,
    `private/${rid}/variants/${photoId}-w1440.none`,
  ])
    assert.equal(await bucket().head(key), null, key);
  checks += 6;

  console.log(
    `Photo copies: ${checks} checks passed (needed widths, JPEG and size checks, skipped widths, guest srcset copies with a week's cache, full-photo fallback, and removal with the photo).`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
