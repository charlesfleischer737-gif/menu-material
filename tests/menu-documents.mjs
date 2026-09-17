import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-documents-"));
process.env.DISHLIGHT_DATA_DIR = root;
process.env.APP_ORIGIN = "http://localhost";
process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
const { handle } = await import("../lib/server/api.ts");
const { one, run, db, bucket } = await import("../lib/server/core.ts");
const { newMenuDocument, newMenuEntry } =
  await import("../lib/menu-document.ts");
let cookie = "",
  checks = 0,
  providerCalls = 0;
globalThis.fetch = async (url, options) => {
  assert.equal(url, "https://api.openai.com/v1/responses");
  providerCalls++;
  const b = JSON.parse(options.body);
  assert.equal(b.store, false);
  assert.equal(b.text.format.type, "json_schema");
  assert.match(b.instructions, /Never infer/);
  return Response.json({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              description:
                "Roast chicken, charred leeks, potato purée, chicken jus.",
            }),
          },
        ],
      },
    ],
    usage: {},
  });
};
async function call(path, data, expected = 200, method) {
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method: method || (data === undefined ? "GET" : "POST"),
      headers: { cookie, "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  );
  const value = await res.json();
  assert.equal(res.status, expected, `${path}: ${JSON.stringify(value)}`);
  checks++;
  if (res.headers.get("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return value;
}
try {
  await call("auth/dev", {});
  const state = await call("state"),
    adminCookie = cookie;
  const legacyDish = await call("dishes", {
    name: "Legacy soup",
    description: "Seasonal vegetables",
    price: 9,
    available: true,
    confirmed: true,
  });
  const legacy = {
    design: "bistro",
    layout: "classic",
    paper: "letter",
    sections: [
      {
        id: crypto.randomUUID(),
        name: "Lunch",
        items: [
          {
            id: legacyDish.id,
            name: "Legacy soup",
            description: "Seasonal vegetables",
            price: 900,
            available: true,
            photoId: null,
          },
        ],
      },
    ],
    restaurant: { name: state.restaurant.name, currency: "USD" },
  };
  await run(
    "UPDATE restaurants SET menu_draft=?,published=?,published_at=? WHERE id=?",
    JSON.stringify({
      ...legacy,
      sections: legacy.sections.map((s) => ({
        ...s,
        items: s.items.map((i) => ({ dishId: i.id, photoId: null })),
      })),
    }),
    JSON.stringify(legacy),
    Date.now() - 1000,
    state.restaurant.id,
  );
  const savedLegacyId = crypto.randomUUID();
  await run(
    "INSERT INTO creation_drafts (id,restaurant_id,kind,draft,updated_at) VALUES (?,?,'menu',?,?)",
    savedLegacyId,
    state.restaurant.id,
    JSON.stringify(legacy),
    Date.now(),
  );
  await run(
    `CREATE TRIGGER fail_saved_menu_migration BEFORE INSERT ON menu_documents WHEN NEW.id='${savedLegacyId}' BEGIN SELECT RAISE(ABORT, 'simulated interrupted migration'); END`,
  );
  await call("menus/initialize", {}, 500);
  assert.equal(
    (await one("SELECT count(*) AS total FROM menu_documents")).total,
    0,
    "an interrupted migration leaves no partial menu collection",
  );
  assert.equal(
    (await one("SELECT count(*) AS total FROM menu_publication_history")).total,
    0,
  );
  await run("DROP TRIGGER fail_saved_menu_migration");
  const initialized = await call("menus/initialize", {});
  assert.equal(initialized.menus.length, 2);
  assert(initialized.menus.some((m) => m.id === savedLegacyId));
  assert.deepEqual(
    initialized.menus[0].published,
    legacy,
    "migration preserves the exact prior public snapshot",
  );
  assert.equal(
    initialized.menus[0].draft.sections[0].items[0].dishId,
    legacyDish.id,
  );
  const legacyHistory = (await call(`menus/${initialized.menus[0].id}/history`))
    .history;
  assert.equal(
    legacyHistory.length,
    1,
    "old published version is retained in history",
  );
  const firstId = initialized.menus[0].id,
    rid = state.restaurant.id;
  assert.equal((await call("menus/initialize", {})).menus[0].id, firstId);
  await call("menu/unpublish", {}, 409);
  const dish = await call("dishes", {
    name: "Roast chicken",
    description: "Charred leeks, potato purée, chicken jus",
    price: 28,
    available: true,
    confirmed: true,
  });
  const chicken = newMenuEntry({
    dishId: dish.id,
    name: "Roast chicken",
    description: "Charred leeks, potato purée, chicken jus",
    price: 2800,
  });
  const hidden = newMenuEntry({
    name: "Secret draft dish",
    price: 900,
    visible: false,
  });
  const doc = newMenuDocument({
    name: "PRIVATE INTERNAL SERVICE NAME",
    title: "Dinner",
    importSourceText: "PRIVATE ORIGINAL SOURCE TEXT",
    sections: [
      {
        id: crypto.randomUUID(),
        name: "From the kitchen",
        description: "",
        pageBreakBefore: false,
        items: [chicken, hidden],
      },
    ],
  });
  let dinner = await call(
    `menus/${firstId}`,
    { revision: 1, draft: doc },
    200,
    "PUT",
  );
  assert.equal(dinner.revision, 2);
  assert.equal(
    (await call(`menus/${firstId}`, { revision: 1, draft: doc }, 200, "PUT"))
      .revision,
    2,
    "a lost save response can be retried",
  );
  await call(
    `menus/${firstId}`,
    { revision: 1, draft: { ...doc, title: "Stale" } },
    409,
    "PUT",
  );
  const draft = structuredClone(doc);
  draft.name = "Brunch";
  draft.title = "Brunch";
  draft.sections[0].items[0].price = 2400;
  let brunch = await call("menus", { id: crypto.randomUUID(), draft });
  assert.equal(
    (await one("SELECT price FROM dishes WHERE id=?", dish.id)).price,
    2800,
  );
  assert.equal(
    (await call(`menus/${firstId}`)).draft.sections[0].items[0].price,
    2800,
  );
  await call(`menus/${firstId}/publish`, { revision: 2 }, 400);
  dinner = await call(`menus/${firstId}/publish`, {
    revision: 2,
    confirmed: true,
  });
  assert.equal(
    dinner.published.sections[0].items.length,
    1,
    "hidden dishes never enter the public snapshot",
  );
  assert.equal(
    dinner.published.name,
    "Dinner",
    "private saved names remain private",
  );
  assert.equal(dinner.published.importSourceId, null);
  assert.equal(dinner.published.importSourceText, "");
  const slug = state.restaurant.slug;
  let publicMenu = (await call(`public/${slug}`)).menu;
  assert.equal(publicMenu.sections[0].items[0].price, 2800);
  const changed = structuredClone(doc);
  changed.sections[0].items[0].price = 3100;
  dinner = await call(
    `menus/${firstId}`,
    { revision: dinner.revision, draft: changed },
    200,
    "PUT",
  );
  assert.equal(
    (await call(`public/${slug}`)).menu.sections[0].items[0].price,
    2800,
    "draft price stays private",
  );
  brunch = await call(`menus/${brunch.id}/publish`, {
    revision: brunch.revision,
    confirmed: true,
  });
  assert.equal(
    (await call(`public/${slug}?menu=${brunch.id}`)).menu.title,
    "Brunch",
  );
  assert.equal((await call(`public/${slug}`)).menu.menus.length, 2);
  await call(`public/${slug}?menu=${crypto.randomUUID()}`, undefined, 404);
  const history = (await call(`menus/${firstId}/history`)).history;
  dinner = await call(`menus/${firstId}/restore`, {
    revision: dinner.revision,
    historyId: history[0].id,
  });
  assert.equal(dinner.draft.sections[0].items[0].price, 2800);
  assert.equal(
    dinner.draft.name,
    doc.name,
    "restore preserves private menu identity",
  );
  await call(`menus/${brunch.id}/primary`, { revision: brunch.revision });
  assert.equal(
    (await call(`public/${slug}`)).menu.title,
    "Brunch",
    "existing restaurant QR follows primary",
  );
  const suggestion = await call(`menus/${firstId}/shorten`, {
    name: "Roast chicken",
    description:
      "Our delicious roast chicken with charred leeks, potato purée, and chicken jus.",
  });
  assert.match(suggestion.description, /chicken jus/);
  assert.equal(providerCalls, 1);
  const concise = await call(`menus/${firstId}/shorten`, {
    name: "Roast chicken",
    description: chicken.description,
  });
  assert.equal(
    concise.description,
    chicken.description,
    "a longer AI answer never replaces a concise original",
  );
  assert.equal(
    (await call(`menus/${firstId}`)).draft.sections[0].items[0].description,
    chicken.description,
    "AI suggestions do not change saved facts",
  );
  await call(
    `menus/${brunch.id}/unpublish`,
    { revision: brunch.revision - 1, confirmed: true },
    400,
  );
  await call(`menus/${brunch.id}/unpublish`, {
    revision: brunch.revision,
    confirmed: true,
  });
  assert.equal(
    (await call(`public/${slug}`)).menu.title,
    "Dinner",
    "taking main menu offline retains another published menu",
  );
  await call(`public/${slug}?menu=${brunch.id}`, undefined, 404);
  const invite = await call("admin/invite", {
    email: "menus-other@example.test",
    allowance: 1,
  });
  cookie = "";
  await call("auth/signup", {
    email: "menus-other@example.test",
    password: "another safe test password",
    invite: invite.invite,
    restaurant: "Other",
  });
  await call(`menus/${firstId}`, undefined, 404);
  await call("menus", { id: crypto.randomUUID(), draft: doc }, 400);
  cookie = adminCookie;
  const reviewDraft = structuredClone(doc);
  reviewDraft.sections[0].items[0].sourceReviewed = false;
  let pending = await call("menus", {
    id: crypto.randomUUID(),
    draft: reviewDraft,
  });
  await call(
    `menus/${pending.id}/publish`,
    { revision: pending.revision, confirmed: true },
    400,
  );
  await call(`menus/${pending.id}/archive`, {
    revision: pending.revision,
    confirmed: true,
  });
  await call(`menus/${pending.id}`, undefined, 404);
  const archived = (await call("menus/archived")).menus.find(
    (m) => m.id === pending.id,
  );
  assert(archived && !archived.published);
  const restoredDraft = await call(`menus/${pending.id}/unarchive`, {
    revision: archived.revision,
  });
  assert.equal(restoredDraft.published, null);
  assert.equal(restoredDraft.draft.sections[0].items[0].sourceReviewed, false);
  await call(`menus/${pending.id}`, undefined);
  const usage = await call(`library/${dish.id}/usage`);
  assert(usage.usage.some((u) => u.id === firstId && u.kind === "menu"));
  const current = await call(`menus/${firstId}`);
  await call(`menus/${firstId}/unpublish`, {
    revision: current.revision,
    confirmed: true,
  });
  await call(`public/${slug}`, undefined, 404);
  assert.equal(
    (await one("SELECT published FROM restaurants WHERE id=?", rid)).published,
    null,
  );
  const offline = await call(`menus/${firstId}`);
  const legacyRestored = await call(`menus/${firstId}/restore`, {
    revision: offline.revision,
    historyId: legacyHistory[0].id,
  });
  assert.equal(
    legacyRestored.draft.sections[0].items[0].dishId,
    legacyDish.id,
    "old public dish identities reconnect to their owned library dishes",
  );
  assert.equal(
    legacyRestored.published,
    null,
    "restoring history never publishes automatically",
  );
  brunch = await call(`menus/${brunch.id}`);
  brunch = await call(`menus/${brunch.id}/publish`, {
    revision: brunch.revision,
    confirmed: true,
  });
  dinner = await call(`menus/${firstId}/publish`, {
    revision: legacyRestored.revision,
    confirmed: true,
  });
  await call(`menus/${firstId}/primary`, { revision: dinner.revision });
  await Promise.all([
    call(`menus/${firstId}/publish`, {
      revision: dinner.revision,
      confirmed: true,
    }),
    call(`menus/${brunch.id}/primary`, { revision: brunch.revision }),
  ]);
  assert.equal(
    (await call(`public/${slug}`)).menu.title,
    "Brunch",
    "publishing an old main menu preserves a newer concurrent main-menu choice",
  );
  const assetId = crypto.randomUUID(),
    assetKey = `restaurants/${rid}/${assetId}.png`;
  await run(
    "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,mime,name,approved_at,created_at) VALUES (?,?,?,'source',?,'image/png','test-photo.png',?,?)",
    assetId,
    rid,
    dish.id,
    assetKey,
    Date.now(),
    Date.now(),
  );
  await bucket().put(assetKey, new Uint8Array([137, 80, 78, 71]), {
    httpMetadata: { contentType: "image/png" },
  });
  const photoDraft = structuredClone(doc);
  photoDraft.title = "Photo menu";
  photoDraft.sections[0].items[0].photoId = assetId;
  let photoMenu = await call("menus", {
    id: crypto.randomUUID(),
    draft: photoDraft,
  });
  await call(`public/${slug}/assets/${assetId}`, undefined, 404);
  photoMenu = await call(`menus/${photoMenu.id}/publish`, {
    revision: photoMenu.revision,
    confirmed: true,
  });
  const publicAsset = await handle(
    new Request(`http://localhost/api/public/${slug}/assets/${assetId}`),
  );
  assert.equal(publicAsset.status, 200, "a secondary menu's photo is public");
  await publicAsset.arrayBuffer();

  // Pause deletion after it has read the restaurant, then choose a newer main menu.
  const assetRead = Promise.withResolvers(),
    resumeDelete = Promise.withResolvers(),
    database = db(),
    originalPrepare = database.prepare;
  database.prepare = function (sql) {
    const statement = originalPrepare.call(this, sql);
    if (!sql.startsWith("SELECT * FROM assets WHERE id=? AND restaurant_id=?"))
      return statement;
    const originalBind = statement.bind;
    statement.bind = function (...args) {
      const bound = originalBind.apply(this, args),
        originalFirst = bound.first;
      bound.first = async function (...firstArgs) {
        const result = await originalFirst.apply(this, firstArgs);
        database.prepare = originalPrepare;
        assetRead.resolve();
        await resumeDelete.promise;
        return result;
      };
      return bound;
    };
    return statement;
  };
  const deletion = call(`assets/${assetId}`, undefined, 200, "DELETE");
  await assetRead.promise;
  try {
    await call(`menus/${firstId}/primary`, { revision: dinner.revision });
  } finally {
    resumeDelete.resolve();
    database.prepare = originalPrepare;
  }
  await deletion;
  assert.equal(
    (await call(`public/${slug}`)).menu.documentId,
    firstId,
    "photo deletion preserves a newer main-menu choice",
  );
  const prunedPhotoMenu = await call(`menus/${photoMenu.id}`);
  assert.equal(prunedPhotoMenu.draft.sections[0].items[0].photoId, null);
  assert.equal(prunedPhotoMenu.published.sections[0].items[0].photoId, null);
  assert.equal(
    JSON.parse(
      (
        await one(
          "SELECT snapshot FROM menu_publication_history WHERE menu_id=?",
          photoMenu.id,
        )
      ).snapshot,
    ).sections[0].items[0].photoId,
    null,
    "publication history cannot restore a deleted photo",
  );
  await call(`public/${slug}/assets/${assetId}`, undefined, 404);
  await call(`assets/${assetId}`, undefined, 200, "DELETE");
  console.log(
    `${checks} menu document API checks passed: independent content, draft privacy, named publication, stable QR, revision conflicts, history, ownership, and reviewed AI suggestions.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
