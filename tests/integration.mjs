import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
// Deterministic time advance for the persisted polling backoff; no real sleeps.
const realNow = Date.now;
let clockAdvance = 0;
Date.now = () => realNow() + clockAdvance;
const root = mkdtempSync(join(tmpdir(), "menu-material-test-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
process.env.IMAGE_COST_ESTIMATE_USD = "0.12";
process.env.BOOTSTRAP_OWNER_EMAIL = "bootstrap@example.test";
process.env.APP_ORIGIN = "http://localhost";
const { handle } = await import("../lib/server/api.ts");
const { run } = await import("../lib/server/core.ts");
const { env } = await import("../lib/local-runtime.ts");
const photos = readFileSync("public/pasta.jpg");
const generatedPng = readFileSync("public/og.png");
let cookie = "",
  checks = 0,
  providerCalls = 0,
  promptSeen = "",
  phase = "partial";
const imageRequests = [];
let publicCheckMode = "open";
globalThis.fetch = async (url, init = {}) => {
  if (String(url).startsWith("http://localhost/api/public/")) {
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "manual");
    assert(!new Headers(init.headers).has("cookie"));
    assert(!new Headers(init.headers).has("authorization"));
    return publicCheckMode === "open"
      ? handle(new Request(url, { headers: init.headers }))
      : new Response(null, {
          status: 302,
          headers: { location: "/signin-with-chatgpt" },
        });
  }
  assert(String(url).startsWith("https://api.openai.com/v1/"));
  if (String(url).startsWith("https://api.openai.com/v1/images/")) {
    providerCalls++;
    imageRequests.push({ url: String(url), body: init.body });
    if (phase === "offline") throw new TypeError("fetch failed");
    // During the partial phase every other image is rejected.
    if (phase === "partial" && providerCalls % 2 === 1)
      return Response.json(
        { error: { message: "Fixture rejection" } },
        { status: 400 },
      );
    return Response.json({
      data: [
        {
          b64_json:
            phase === "invalid" ? "not-a-png" : generatedPng.toString("base64"),
        },
      ],
      usage: { input_tokens: 200, output_tokens: 100 },
    });
  }
  assert.equal(init.method, "POST");
  promptSeen = JSON.parse(init.body).instructions;
  return Response.json({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: "Meet our tomato pasta, made with tomatoes and basil.",
          },
        ],
      },
    ],
    usage: { input_tokens: 30, output_tokens: 15 },
  });
};
async function call(path, b, expected = 200, opts = {}) {
  if (path === "jobs/tick") clockAdvance += 31000;
  // Keep the original two-candidate regression cases explicit; the studio default is now one.
  if (path === "jobs" && b) b = { candidateCount: 2, ...b };
  const headers = { cookie, ...opts.headers };
  if (b !== undefined && !(b instanceof FormData))
    headers["Content-Type"] = "application/json";
  const req = new Request("http://localhost/api/" + path, {
    method: opts.method || (b === undefined ? "GET" : "POST"),
    headers,
    body:
      b === undefined
        ? undefined
        : b instanceof FormData
          ? b
          : JSON.stringify(b),
  });
  const res = await handle(req);
  let v;
  try {
    v = await res.clone().json();
  } catch {
    v = null;
  }
  assert.equal(
    res.status,
    expected,
    `${path}: ${res.status} ${JSON.stringify(v)}`,
  );
  checks++;
  if (res.headers.get("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return v;
}
try {
  await call("auth/owner-invite", {}, 403);
  await call("auth/owner-invite", {}, 403, {
    headers: {
      "oai-authenticated-user-email": "other@example.test",
      "oai-authenticated-user-id": "signed-user",
    },
  });
  await call("auth/owner-invite", {}, 403, {
    headers: { "oai-authenticated-user-email": "bootstrap@example.test" },
  });
  await call("auth/owner-invite", {}, 200, {
    headers: {
      "oai-authenticated-user-email": "bootstrap@example.test",
      "oai-authenticated-user-id": "signed-owner",
    },
  });
  await call("dishes", { name: "No account" }, 401);
  await call("auth/dev", {});
  const adminCookie = cookie;
  const adminState = await call("state");
  assert.equal(adminState.user.role, "admin");
  const invite = await call("admin/invite", {
    email: "one@example.test",
    allowance: 2,
  });
  cookie = "";
  await call(
    "auth/signup",
    {
      email: "wrong@example.test",
      password: "correct horse battery staple",
      invite: invite.invite,
      restaurant: "Wrong",
    },
    403,
  );
  await call("auth/signup", {
    email: "one@example.test",
    password: "correct horse battery staple",
    invite: invite.invite,
    restaurant: "Test Kitchen",
  });
  const ownerCookie = cookie;
  await call(
    "auth/signup",
    {
      email: "one@example.test",
      password: "correct horse battery staple",
      invite: invite.invite,
      restaurant: "Reuse",
    },
    403,
  );
  const d = await call("dishes", {
    name: "Tomato pasta",
    description: "Spaghetti, tomatoes and basil",
    portion: "250 g",
    plating: "White bowl",
    setting: "Natural daylight",
    price: 14,
    available: true,
    confirmed: true,
  });
  const dishId = d.id;
  const fd = new FormData();
  fd.set("file", new File([photos], "photo.jpg", { type: "image/jpeg" }));
  fd.set(
    "normalized",
    new File([photos], "working.jpg", { type: "image/jpeg" }),
  );
  fd.set("dishId", dishId);
  const asset = await call("assets", fd, 201);
  const sourceId = asset.id;
  const profile = (await call("state")).restaurant;
  const savedLook = {
    primary: "#183e31",
    accent: "#e4cc92",
    tone: "Warm and welcoming",
    typography: "editorial",
    autoApply: true,
    photoPreset: "menu-stone",
    photoStyle: "Private photographic instructions",
    referenceIds: [],
    photoDefaults: {
      surface: "Pale stone",
      lighting: "Soft daylight",
      plate: "keep",
      angle: "keep",
      composition: "Room around the plate",
    },
  };
  await call("restaurant", {
    ...profile,
    brand: "Private preferences",
    style: savedLook,
  });
  assert.deepEqual(
    (await call("state")).restaurant.style,
    savedLook,
    "restaurant look settings persist together",
  );
  const menu = {
    sections: [
      { id: "mains", name: "Mains", items: [{ dishId, photoId: sourceId }] },
    ],
  };
  await call("menu", menu);
  await call("menu/publish", {}, 400);
  await call(`assets/${sourceId}/approve`, { accurate: true });
  await call("menu/publish", {});
  assert.equal((await call("sharing/check", {})).accessible, true);
  publicCheckMode = "locked";
  assert.equal(
    (await call("sharing/check", {})).accessible,
    false,
    "a sign-in redirect is not a working guest link",
  );
  publicCheckMode = "open";
  let state = await call("state");
  const slug = state.restaurant.slug;
  cookie = "";
  await call("sharing/check", {}, 401);
  await call("restaurant", { ...profile, style: savedLook }, 401);
  await call("menu/publish", {}, 401);
  await call("creation-drafts", undefined, 401);
  await call("assets/" + sourceId, undefined, 401);
  let pub = await call("public/" + slug);
  assert.equal(pub.menu.sections[0].items[0].name, "Tomato pasta");
  assert.deepEqual(pub.menu.restaurant.style, {
    primary: savedLook.primary,
    accent: savedLook.accent,
    typography: "editorial",
  });
  assert.equal(
    pub.menu.restaurant.brand,
    undefined,
    "private brand notes never appear in the diner payload",
  );
  assert.equal(pub.menu.restaurant.style.photoStyle, undefined);
  assert.equal(pub.menu.restaurant.style.referenceIds, undefined);
  await call(`public/${slug}/assets/${sourceId}`);
  cookie = ownerCookie;
  await call("dishes/" + dishId, {
    name: "Private draft name",
    description: "Updated privately",
    price: 16,
    confirmed: true,
  });
  pub = await call("public/" + slug);
  assert.equal(pub.menu.sections[0].items[0].name, "Tomato pasta");
  await call("menu/publish", {});
  pub = await call("public/" + slug);
  assert.equal(pub.menu.sections[0].items[0].name, "Private draft name");
  const request = { dishId, sourceId, requestKey: crypto.randomUUID() };
  const duplicates = await Promise.all([
    call("jobs", request, 202),
    call("jobs", request, 202),
  ]);
  assert.equal(duplicates[0].id, duplicates[1].id);
  state = await call("state");
  assert.equal(state.remaining, 0);
  assert.equal(state.outputs.length, 2);
  await call(
    "jobs",
    { ...request, revision: "Different", requestKey: request.requestKey },
    409,
  );
  await call("jobs", { ...request, requestKey: crypto.randomUUID() }, 402);
  const legacyDetails = JSON.parse(duplicates[0].details);
  delete legacyDetails.rendering;
  legacyDetails.model = "gpt-image-2";
  await run(
    "UPDATE jobs SET details=? WHERE id=?",
    JSON.stringify(legacyDetails),
    duplicates[0].id,
  );
  await call("jobs/tick", {});
  assert.equal(providerCalls, 2);
  // Both images start together and go straight to the image endpoint.
  const [first] = imageRequests;
  assert.equal(first.url, "https://api.openai.com/v1/images/edits");
  assert(first.body instanceof FormData, "photos are uploaded as multipart");
  assert.equal(first.body.getAll("image").length, 1, "one photo, one field");
  assert.equal(first.body.get("image").type, "image/jpeg");
  assert.equal(first.body.get("model"), "gpt-image-2");
  assert.equal(first.body.get("output_format"), "png", "legacy PNG jobs");
  assert(!first.body.has("output_compression"), "unset settings are omitted");
  assert.match(
    first.body.get("prompt"),
    /^INPUT IMAGES\nImage 1: ORIGINAL DISH PHOTO:/,
  );
  await Promise.all([call("jobs/tick", {}), call("jobs/tick", {})]);
  state = await call("state");
  assert.equal(state.remaining, 1);
  assert.equal(state.jobs[0].status, "partial");
  assert.equal(state.outputs.filter((o) => o.status === "completed").length, 1);
  assert.equal(state.outputs.filter((o) => o.status === "failed").length, 1);
  await call("jobs/tick", {});
  assert.equal(providerCalls, 2);
  const generated = state.assets.find((a) => a.kind === "generated");
  assert.equal(
    generated.mime,
    "image/png",
    "legacy PNG output remains supported",
  );
  await call(`assets/${generated.id}?download=1`, undefined, 403);
  await call(`assets/${generated.id}/approve`, { accurate: false }, 400);
  await call(`assets/${generated.id}/approve`, { accurate: true });
  await call(`assets/${generated.id}?download=1`);
  await call(`public/${slug}/assets/${generated.id}`, undefined, 404);
  await call("captions/generate", { dishId });
  assert(promptSeen.includes("Do not invent ingredients"));
  await call("captions", { dishId, body: "Our own edited caption." });
  await call("menu/unpublish", {});
  cookie = "";
  await call("public/" + slug, undefined, 404);
  await call(`public/${slug}/assets/${sourceId}`, undefined, 404);
  cookie = ownerCookie;
  await call("menu/publish", {});
  await call("assets/" + sourceId, undefined, 200, { method: "DELETE" });
  pub = await call("public/" + slug);
  assert.equal(pub.menu.sections[0].items[0].photoId, null);
  await call(`public/${slug}/assets/${sourceId}`, undefined, 404);
  cookie = adminCookie;
  const second = await call("admin/invite", {
    email: "two@example.test",
    allowance: 2,
  });
  cookie = "";
  await call("auth/signup", {
    email: "two@example.test",
    password: "correct horse battery staple",
    invite: second.invite,
    restaurant: "Other Kitchen",
  });
  await call(
    "dishes/" + dishId,
    { name: "Intrusion", description: "Nope" },
    404,
  );
  await call("assets/" + generated.id, undefined, 404);
  await call("admin", undefined, 403);
  await call(
    "menu",
    { sections: [{ id: "x", name: "No", items: [{ dishId }] }] },
    400,
  );
  await call("restaurant", { name: "CSRF" }, 403, {
    headers: { origin: "https://evil.example" },
  });
  cookie = adminCookie;
  const restaurants = await call("admin");
  const target = restaurants.restaurants.find(
    (r) => r.email === "one@example.test",
  );
  await call("admin/restaurant", { id: target.id, allowance: 4, paused: true });
  cookie = ownerCookie;
  await call(
    "jobs",
    { dishId, parentId: generated.id, requestKey: crypto.randomUUID() },
    403,
  );
  cookie = adminCookie;
  await call("admin/restaurant", {
    id: target.id,
    allowance: 4,
    paused: false,
  });
  cookie = ownerCookie;
  phase = "success";
  await call(
    "jobs",
    {
      dishId,
      parentId: generated.id,
      revision: "Softer light",
      requestKey: crypto.randomUUID(),
    },
    202,
  );
  await call("jobs/tick", {});
  await call("jobs/tick", {});
  state = await call("state");
  assert.equal(state.remaining, 1);
  assert.equal(state.jobs[0].status, "completed");
  assert.equal(state.jobs[0].parent_id, generated.id);
  assert.equal(providerCalls, 4);
  cookie = adminCookie;
  await call("admin/restaurant", {
    id: target.id,
    allowance: 8,
    paused: false,
  });
  cookie = ownerCookie;
  phase = "invalid";
  await call("jobs", { dishId, requestKey: crypto.randomUUID() }, 202);
  await call("jobs/tick", {});
  await call("jobs/tick", {});
  state = await call("state");
  assert.equal(state.remaining, 5);
  assert.equal(state.jobs[0].status, "failed");
  const uncertain = await call(
    "jobs",
    { dishId, requestKey: crypto.randomUUID() },
    202,
  );
  // A call cut off mid-render, like an older interrupted request, has nothing
  // to retrieve: it fails at once, is not counted and is never resubmitted.
  await run(
    "UPDATE outputs SET status=CASE slot WHEN 0 THEN 'submitting' ELSE 'uncertain' END,submitted_at=?,lease_until=0 WHERE job_id=?",
    Date.now(),
    uncertain.id,
  );
  const beforeRecovery = providerCalls;
  await call("jobs/tick", {});
  state = await call("state");
  assert.equal(state.remaining, 5);
  assert.equal(providerCalls, beforeRecovery);
  assert.equal(state.jobs.find((j) => j.id === uncertain.id).status, "failed");
  phase = "offline";
  const dropped = await call(
    "jobs",
    { dishId, requestKey: crypto.randomUUID() },
    202,
  );
  await call("jobs/tick", {});
  await call("jobs/tick", {});
  state = await call("state");
  assert.equal(providerCalls, beforeRecovery + 2, "never resubmitted");
  assert.equal(state.jobs.find((j) => j.id === dropped.id).status, "failed");
  assert(
    state.outputs
      .filter((o) => o.job_id === dropped.id)
      .every((o) => /interrupted/.test(o.error)),
  );
  assert.equal(state.remaining, 5, "dropped images are not counted");
  // A direct result cannot be fetched again later, so an image that arrives
  // while storage is full fails at once and is not counted.
  phase = "success";
  env.WORKSPACE_STORAGE_MB = "0.001";
  const full = await call(
    "jobs",
    { dishId, requestKey: crypto.randomUUID() },
    202,
  );
  await call("jobs/tick", {});
  delete env.WORKSPACE_STORAGE_MB;
  state = await call("state");
  assert.equal(state.jobs.find((j) => j.id === full.id).status, "failed");
  assert(
    state.outputs
      .filter((o) => o.job_id === full.id)
      .every((o) => /storage is full/.test(o.error)),
  );
  assert.equal(state.remaining, 5, "unsaved images are not counted");
  const independent = new DatabaseSync(join(root, "menu-material.sqlite"));
  assert.equal(
    independent.prepare("SELECT count(*) AS n FROM captions").get().n,
    2,
  );
  assert.equal(
    independent
      .prepare(
        "SELECT count(*) AS n FROM ai_spend WHERE kind='image' AND status='uncertain'",
      )
      .get().n,
    2,
    "possibly billed dropped calls stay a reconciliation item",
  );
  independent.close();
  await call("auth/logout", {});
  await call("dishes", { name: "Logged out" }, 401);
  await call(
    "auth/login",
    { email: "one@example.test", password: "incorrect" },
    401,
  );
  await call("auth/login", {
    email: "one@example.test",
    password: "correct horse battery staple",
  });
  cookie = adminCookie;
  const reset = await call("admin/invite", {
    email: "one@example.test",
    reset: true,
  });
  cookie = "";
  await call("auth/signup", {
    email: "one@example.test",
    password: "replacement correct password",
    invite: reset.invite,
  });
  cookie = ownerCookie;
  await call("dishes", { name: "Old session" }, 401);
  cookie = "";
  await call(
    "auth/signup",
    {
      email: "one@example.test",
      password: "replacement correct password",
      invite: reset.invite,
    },
    403,
  );
  console.log(
    `PASS: ${checks} API assertions; invitation access, tenant isolation, persistent storage, image privacy, atomic quota/idempotency, partial-failure refunds, revisions, approvals, caption editing, menu snapshot isolation, publish/republish/unpublish, deletion, and password-reset session revocation.`,
  );
  console.log(
    "Provider HTTP calls used deterministic fixtures. Live OpenAI quality, latency and billing are NOT verified.",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
