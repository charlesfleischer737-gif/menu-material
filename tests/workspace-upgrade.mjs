import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-workspace-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.LOCAL_DEVELOPMENT = "true";
process.env.OPENAI_API_KEY = "fixture-only";
const { handle } = await import("../lib/server/api.ts");
const { dishStatus, preferredPhoto, dishSnapshot } =
  await import("../lib/dish-library.ts");
const { menuChanges, duplicateMenuRows } =
  await import("../lib/menu-design.ts");
let cookie = "",
  checks = 0,
  requests = [];
globalThis.fetch = async (url, init) => {
  assert(String(url).startsWith("https://api.openai.com/v1/"));
  const request = JSON.parse(init.body);
  requests.push(request);
  const text =
    request.text?.format?.type === "json_object"
      ? JSON.stringify({
          items: [
            {
              name: "House pasta",
              description: "Fresh pasta",
              price: null,
              category: "Mains",
              uncertain: ["price"],
            },
            {
              name: "House pasta",
              description: "",
              price: 19.5,
              category: "Mains",
              uncertain: [],
            },
          ],
        })
      : "House pasta for tonight. $18.50. From our kitchen.";
  return Response.json({
    output: [{ content: [{ type: "output_text", text }] }],
    usage: { input_tokens: 10, output_tokens: 12 },
  });
};
async function call(path, body, expected = 200) {
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        cookie,
        ...(body instanceof FormData
          ? {}
          : { "content-type": "application/json" }),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    }),
  );
  const data = await res.json().catch(() => null);
  assert.equal(res.status, expected, `${path}: ${JSON.stringify(data)}`);
  checks++;
  if (res.headers.has("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return data;
}
async function upload(dishId) {
  const form = new FormData(),
    jpeg = readFileSync("public/pasta.jpg");
  form.set("file", new File([jpeg], "original.jpg", { type: "image/jpeg" }));
  form.set(
    "normalized",
    new File([jpeg], "working.jpg", { type: "image/jpeg" }),
  );
  form.set("dishId", dishId);
  return call("assets", form, 201);
}
try {
  await call("auth/dev", {});
  const dish = await call("dishes", {
    name: "House pasta",
    description: "Fresh pasta",
    category: "Mains",
    price: 18.5,
    confirmed: true,
  });
  let saved = (await call("state")).dishes.find((d) => d.id === dish.id);
  assert.equal(dishStatus(saved, []), "No photo");
  const first = await upload(dish.id),
    second = await upload(dish.id);
  let assets = (await call("state")).assets;
  assert.equal(dishStatus(saved, assets), "Needs review");
  await call(`library/${dish.id}`, { preferredPhotoId: first.id }, 400);
  await call(`assets/${first.id}/approve`, { accurate: true });
  await call(`assets/${second.id}/approve`, { accurate: true });
  await call(`library/${dish.id}`, { preferredPhotoId: first.id });
  let current = await call("state");
  saved = current.dishes.find((d) => d.id === dish.id);
  assert.equal(preferredPhoto(saved, current.assets).id, first.id);
  assert.equal(dishStatus(saved, current.assets), "Ready to use");
  assert.equal(
    dishStatus(
      saved,
      current.assets.map((a) => ({ ...a, deleted_at: 1 })),
    ),
    "No photo",
  );
  const other = await call("dishes", { name: "Other dish", confirmed: true }),
    foreignPhoto = await upload(other.id);
  await call(`assets/${foreignPhoto.id}/approve`, { accurate: true });
  await call(`library/${dish.id}`, { preferredPhotoId: foreignPhoto.id }, 400);
  const draftId = crypto.randomUUID();
  await call("creation-drafts", {
    id: draftId,
    kind: "post",
    revision: 0,
    draft: {
      title: "Tonight",
      items: [
        { dishId: dish.id, name: saved.name, facts: dishSnapshot(saved) },
      ],
    },
  });
  assert.equal(
    (await call(`library/${dish.id}/usage`)).usage[0].changed,
    false,
  );
  await call(`dishes/${dish.id}`, {
    ...saved,
    available: !!saved.available,
    price: 20,
    confirmed: true,
  });
  await call(
    `dishes/${dish.id}`,
    { ...saved, available: !!saved.available, price: 21, confirmed: true },
    409,
  );
  assert.equal((await call(`library/${dish.id}/usage`)).usage[0].changed, true);
  await call(`library/${dish.id}`, { archived: true });
  current = await call("state");
  assert(current.dishes.find((d) => d.id === dish.id).archived_at);
  assert.equal((await call(`library/${dish.id}/usage`)).usage.length, 1);
  await call(`library/${dish.id}`, { archived: false });
  assert.equal(
    (await call("state")).dishes.find((d) => d.id === dish.id).archived_at,
    null,
  );
  const menu = {
    design: "fine",
    density: "spacious",
    printProfile: "press",
    title: "Dinner",
    layout: "featured",
    appearance: "light",
    paper: "a4",
    sections: [
      {
        id: "mains",
        name: "Mains",
        items: [
          {
            dishId: dish.id,
            photoId: first.id,
            featured: true,
            crop: { fit: false, x: 65, y: 40, zoom: 1.2 },
          },
        ],
      },
    ],
  };
  await call("menu", menu);
  await call("menu/publish", {});
  current = await call("state");
  const published = current.restaurant.published;
  assert.equal(published.design, "fine");
  assert.equal(published.title, "Dinner");
  assert.deepEqual(
    published.sections[0].items[0].crop,
    menu.sections[0].items[0].crop,
  );
  assert.equal(published.sections[0].items[0].featured, true);
  const before = current.dishes.find((d) => d.id === dish.id);
  await call(`dishes/${dish.id}`, {
    ...before,
    available: !!before.available,
    price: 24,
    available: false,
    confirmed: true,
  });
  assert.equal(
    (await call("state")).restaurant.published.sections[0].items[0].price,
    2000,
    "Shared facts must not silently change the live menu",
  );
  const changed = structuredClone(published);
  changed.sections[0].items[0].price = 2400;
  changed.sections[0].items[0].available = false;
  assert(
    menuChanges(changed, published).some((c) =>
      c.includes("price, availability"),
    ),
  );
  assert.deepEqual(
    [
      ...duplicateMenuRows([
        { name: " House pasta " },
        { name: "House pasta" },
        { name: "Salad" },
      ]),
    ],
    [0, 1],
  );
  await call("post-caption", {
    dishIds: [dish.id],
    quantities: [{ dishId: dish.id, quantity: 2 }],
    title: "Tonight",
    description: "",
    price: 18.5,
    validity: "Tonight",
    occasion: "combo",
    voice: "Quietly confident",
    mode: "shorter",
    caption: "This evening, House pasta.",
  });
  assert.match(requests.at(-1).instructions, /at most 30 words/);
  assert.match(requests.at(-1).instructions, /not a source of facts/);
  const input = JSON.parse(requests.at(-1).input);
  assert.equal(input.voice, "Quietly confident");
  assert.equal(input.quantities[0].quantity, 2);
  await call(
    "post-caption",
    {
      dishIds: [dish.id],
      quantities: [{ dishId: other.id, quantity: 2 }],
      title: "Tonight",
      description: "",
      price: null,
      validity: "",
      occasion: "showcase",
    },
    400,
  );
  const form = new FormData();
  form.set(
    "file",
    new File([readFileSync("public/pasta.jpg")], "menu.jpg", {
      type: "image/jpeg",
    }),
  );
  const imp = await call("imports", form, 200);
  await call(`imports/${imp.id}/extract`, {});
  current = await call("state");
  const rows = JSON.parse(current.imports.find((i) => i.id === imp.id).draft);
  assert.deepEqual(rows[0].uncertain, ["price"]);
  assert.equal(rows[0].price, null);
  assert(
    requests
      .at(-1)
      .input[0].content.some(
        (c) => c.type === "input_text" && /JSON/.test(c.text),
      ),
  );
  await call(
    `imports/${imp.id}/review`,
    { confirmed: true, replace: true, items: rows },
    400,
  );
  rows[0].price = 18.5;
  await call(`imports/${imp.id}/review`, {
    confirmed: true,
    replace: true,
    items: rows,
  });
  current = await call("state");
  assert.equal(
    current.restaurant.menuDraft.sections.flatMap((s) => s.items).length,
    2,
    "Replace import creates exactly the checked menu, not a second copy of old menu sections",
  );
  assert.equal(current.restaurant.published.sections[0].items[0].price, 2000);
  const oldCookie = cookie;
  cookie = "";
  await call(
    "auth/signup",
    {
      email: "workspace-other@example.test",
      password: "safe-fixture-password",
      restaurant: "Other restaurant",
    },
    200,
  );
  await call(`library/${dish.id}/usage`, undefined, 404);
  await call(`library/${dish.id}`, { archived: true }, 404);
  cookie = oldCookie;
  console.log(
    `PASS: ${checks} workspace API checks, main-photo validation, archived reuse, stale details and revision conflicts, menu snapshot framing, voice rewrites, uncertain imports and tenant boundaries. Provider responses are fixtures.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
