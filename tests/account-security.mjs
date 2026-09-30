import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const root = mkdtempSync(join(tmpdir(), "menu-material-account-security-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.APP_ORIGIN = "http://localhost";
process.env.OPENAI_API_KEY = "fixture-only";
process.env.ADMIN_SETUP_KEY = "fixture-setup-key-0123456789";
process.env.ERROR_WEBHOOK_URL = "https://hooks.example.test/errors";
const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;
const { handle } = await import("../lib/server/api.ts");
const { caller, wideCaller } = await import("../lib/server/safeguards.ts");
const { all, bucket, digest, one, run, signedInBefore } =
  await import("../lib/server/core.ts");
const { grantHeldImages } = await import("../lib/server/free-grants.ts");
const { validateImageDimensions } =
  await import("../lib/server/image-validation.ts");
const { resolveMenuAddress } = await import("../lib/server/menu-address.ts");
const { newMenuDocument, newMenuEntry } =
  await import("../lib/menu-document.ts");

const photo = readFileSync("public/pasta.jpg");
let imageCalls = 0,
  imagesFail = false;
globalThis.fetch = async (url) => {
  if (String(url).startsWith("https://hooks.example.test/"))
    return new Response("ok");
  if (String(url).startsWith("https://api.openai.com/v1/images/")) {
    imageCalls++;
    // true fails plainly; a string fails with that error code.
    return imagesFail
      ? Response.json(
          {
            error: {
              message: "Fixture failure",
              ...(typeof imagesFail === "string" ? { code: imagesFail } : {}),
            },
          },
          { status: 400 },
        )
      : Response.json({
          data: [{ b64_json: photo.toString("base64") }],
          usage: {},
        });
  }
  if (String(url).startsWith("https://api.openai.com/v1/responses"))
    return Response.json({
      output: [{ content: [{ type: "output_text", text: "Fixture caption" }] }],
      usage: {},
    });
  throw new Error(`Unexpected fetch: ${url}`);
};

let checks = 0;
async function call(
  path,
  { body, method, ip = "203.0.113.1", cookie = "", headers = {} } = {},
) {
  const h = { "cf-connecting-ip": ip, ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined && !(body instanceof FormData))
    h["Content-Type"] = "application/json";
  const res = await handle(
    new Request("http://localhost/api/" + path, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: h,
      body:
        body === undefined || body instanceof FormData
          ? body
          : JSON.stringify(body),
    }),
  );
  let json = null;
  try {
    json = await res.clone().json();
  } catch {}
  // The session cookie, and the device cookie a sign-in also sets.
  const cookies = res.headers.getSetCookie(),
    setCookie = cookies[0] || "",
    deviceCookie =
      cookies.find((c) => c.startsWith("menu_material_device=")) || "";
  return {
    status: res.status,
    json,
    res,
    setCookie,
    cookie: setCookie.split(";")[0],
    deviceCookie,
    device: deviceCookie.split(";")[0],
  };
}
async function expect(path, status, options) {
  const result = await call(path, options);
  assert.equal(
    result.status,
    status,
    `${path}: ${result.status} ${JSON.stringify(result.json)}`,
  );
  checks++;
  return result;
}
const password = "correct horse battery staple";
async function signup(email, restaurant, ip, extra = {}) {
  return expect("auth/signup", 200, {
    body: { email, password, restaurant, ...extra },
    ip,
  });
}

try {
  // 1. Cheap, invalid floods from one IPv6 /64 slow only that network, and no
  // site-wide bucket locks everyone else out of signing in or signing up.
  const network = (ip) =>
    caller(
      new Request("http://localhost/", {
        headers: ip ? { "cf-connecting-ip": ip } : {},
      }),
    );
  assert.equal(network("2001:DB8::1"), "2001:db8:0:0::/64");
  assert.equal(network("2001:db8:0:0:ffff:1:2:3"), "2001:db8:0:0::/64");
  assert.equal(network("2001:db8:0:1::1"), "2001:db8:0:1::/64");
  assert.equal(network("64:ff9b::192.0.2.1"), "64:ff9b:0:0::/64");
  assert.equal(network("::ffff:192.0.2.1"), "192.0.2.1");
  assert.equal(network("192.0.2.1"), "192.0.2.1");
  assert.equal(network(""), "unidentified");
  // Signups also count per IPv6 /48 (tests/plan-limits.mjs).
  const wideNetwork = (ip) =>
    wideCaller(
      new Request("http://localhost/", {
        headers: ip ? { "cf-connecting-ip": ip } : {},
      }),
    );
  assert.equal(wideNetwork("2001:DB8:5:1::1"), "2001:db8:5::/48");
  assert.equal(wideNetwork("2001:db8:5:ff00:1::"), "2001:db8:5::/48");
  assert.equal(wideNetwork("2001:db8::1"), "2001:db8:0::/48");
  assert.equal(wideNetwork("::ffff:192.0.2.1"), null);
  assert.equal(wideNetwork("192.0.2.1"), null);
  assert.equal(wideNetwork(""), null);
  checks++;
  await signup("owner@example.test", "Corner Kitchen", "192.0.2.5");
  const floods = {};
  for (let host = 0; host < 50; host++)
    for (let n = 0; n < 30; n++) {
      const r = await call("auth/login", {
        body: { email: `x${n}@spam.test`, password: 1 },
        ip: `2001:db8::${host.toString(16)}`,
      });
      floods[r.status] = (floods[r.status] || 0) + 1;
    }
  assert.equal(floods[400], 30, "one /64 gets one network's allowance");
  assert.equal(floods[429], 1470);
  checks++;
  await expect("auth/login", 429, {
    body: { email: "owner@example.test", password },
    ip: "2001:db8::ffff:1",
  });
  await expect("auth/login", 200, {
    body: { email: "owner@example.test", password },
    ip: "192.0.2.200",
  });
  // A different /64 is a different network.
  await expect("auth/login", 200, {
    body: { email: "owner@example.test", password },
    ip: "2001:db8:0:1::1",
  });
  for (let host = 0; host < 50; host++)
    for (let n = 0; n < 20; n++)
      await call("auth/signup", {
        body: {},
        ip: `2001:db8:1::${host.toString(16)}`,
      });
  await signup("newcomer@example.test", "Blue Door Cafe", "192.0.2.201");
  // Readiness and browser reports are also limited per network only.
  for (let n = 0; n < 130; n++)
    await call("health/ready", { ip: `2001:db8:2::${n.toString(16)}` });
  await expect("health/ready", 429, { ip: "2001:db8:2::abcd" });
  const ready = await call("health/ready", { ip: "192.0.2.202" });
  assert.notEqual(ready.status, 429);
  checks++;

  // Guessing one account's password from many networks slows down after 20
  // misses instead of locking every account.
  for (let n = 0; n < 20; n++)
    await expect("auth/login", 401, {
      body: { email: "owner@example.test", password: "wrong password " + n },
      ip: `198.51.100.${n + 1}`,
    });
  const slowed = await expect("auth/login", 429, {
    body: { email: "owner@example.test", password },
    ip: "198.51.100.100",
  });
  // It doesn't say when the next attempt opens, so it can't be timed.
  const slowedMessage =
    "Too many sign-in attempts for this account. Please try again later, or request a secure reset link.";
  assert.equal(slowed.json.error, slowedMessage);
  await expect("auth/login", 200, {
    body: { email: "newcomer@example.test", password },
    ip: "198.51.100.101",
  });
  offset += 1000;
  await expect("auth/login", 401, {
    body: { email: "owner@example.test", password: "still wrong" },
    ip: "198.51.100.102",
  });
  const longer = await expect("auth/login", 429, {
    body: { email: "owner@example.test", password },
    ip: "198.51.100.103",
  });
  assert.equal(longer.json.error, slowedMessage);
  offset += 2000;
  await expect("auth/login", 200, {
    body: { email: "owner@example.test", password },
    ip: "198.51.100.104",
  });
  // Signing in clears the slowdown.
  await expect("auth/login", 401, {
    body: { email: "owner@example.test", password: "one more miss" },
    ip: "198.51.100.105",
  });
  await expect("auth/login", 200, {
    body: { email: "owner@example.test", password },
    ip: "198.51.100.106",
  });
  // Parallel attempts cannot share one slot.
  for (let n = 0; n < 20; n++)
    await call("auth/login", {
      body: { email: "newcomer@example.test", password: "wrong " + n },
      ip: `198.18.0.${n + 1}`,
    });
  offset += 1000;
  const burst = await Promise.all(
    Array.from({ length: 5 }, (_, n) =>
      call("auth/login", {
        body: { email: "newcomer@example.test", password: "guess " + n },
        ip: `198.18.1.${n + 1}`,
      }),
    ),
  );
  assert.deepEqual(
    burst.map((r) => r.status).sort(),
    [401, 429, 429, 429, 429],
  );
  checks++;

  // 20. Someone who knows an owner's email can't keep them out: a browser
  // that signed in to the account before skips the per-account slowdown,
  // though its network's own allowance for the email still applies. Only a
  // hash of its device cookie is kept, and each sign-in replaces it.
  offset += 16 * 60000; // past the slowdown above
  const ownersBrowser = await expect("auth/login", 200, {
    body: { email: "owner@example.test", password },
    ip: "192.0.2.90",
  });
  assert.match(
    ownersBrowser.deviceCookie,
    /^menu_material_device=[\w-]{43}; Path=\/api\/auth; HttpOnly; SameSite=Lax; Max-Age=31536000$/,
  );
  const deviceHash = (device) => digest(device.split("=")[1]);
  const ownerId = (
    await one("SELECT id FROM users WHERE email='owner@example.test'")
  ).id;
  assert.equal(
    (
      await one(
        "SELECT user_id FROM trusted_devices WHERE hash=?",
        deviceHash(ownersBrowser.device),
      )
    ).user_id,
    ownerId,
  );
  assert.equal(
    await one(
      "SELECT 1 FROM trusted_devices WHERE hash=?",
      ownersBrowser.device.split("=")[1],
    ),
    null,
    "only a hash is stored",
  );
  const newcomersBrowser = await expect("auth/login", 200, {
    body: { email: "newcomer@example.test", password },
    ip: "192.0.2.95",
  });
  for (let n = 0; n < 25; n++)
    await call("auth/login", {
      body: { email: "owner@example.test", password: "attacker guess " + n },
      ip: `198.51.101.${n + 1}`,
    });
  const newDevice = await expect("auth/login", 429, {
    body: { email: "owner@example.test", password },
    ip: "192.0.2.91",
  });
  assert.equal(newDevice.json.error, slowedMessage);
  // Another account's device cookie doesn't count.
  await expect("auth/login", 429, {
    body: { email: "owner@example.test", password },
    ip: "192.0.2.96",
    cookie: newcomersBrowser.device,
  });
  // The owner's browser gets through, from any network; a wrong password
  // from it is simply wrong.
  await expect("auth/login", 401, {
    body: { email: "owner@example.test", password: "a typo" },
    ip: "192.0.2.97",
    cookie: ownersBrowser.device,
  });
  const rotated = await expect("auth/login", 200, {
    body: { email: "owner@example.test", password },
    ip: "192.0.2.97",
    cookie: ownersBrowser.device,
  });
  assert.notEqual(rotated.device, ownersBrowser.device);
  assert.equal(
    await one(
      "SELECT 1 FROM trusted_devices WHERE hash=?",
      deviceHash(ownersBrowser.device),
    ),
    null,
  );
  // Its network's allowance for the email still applies: 10 tries in 15
  // minutes.
  for (let n = 0; n < 8; n++)
    await expect("auth/login", 401, {
      body: { email: "owner@example.test", password: "another typo " + n },
      ip: "192.0.2.97",
      cookie: rotated.device,
    });
  const paired = await expect("auth/login", 429, {
    body: { email: "owner@example.test", password },
    ip: "192.0.2.97",
    cookie: rotated.device,
  });
  assert.equal(
    paired.json.error,
    "Too many attempts. Please try again in a few minutes.",
  );
  // An expired device cookie is a new device, and one sent over HTTPS is
  // Secure.
  const fromBrowser = (device) =>
    new Request("http://localhost/api/auth/login", {
      headers: { cookie: device },
    });
  assert(
    await signedInBefore(fromBrowser(rotated.device), "owner@example.test"),
  );
  await run(
    "UPDATE trusted_devices SET expires_at=? WHERE hash=?",
    Date.now() - 1,
    deviceHash(rotated.device),
  );
  assert(
    !(await signedInBefore(fromBrowser(rotated.device), "owner@example.test")),
  );
  const overHttps = await handle(
    new Request("https://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "cf-connecting-ip": "192.0.2.98",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "owner@example.test", password }),
    }),
  );
  assert.equal(overHttps.status, 200);
  assert.match(
    overHttps.headers.getSetCookie()[1],
    /^menu_material_device=.+; Secure$/,
  );
  checks += 4;

  // 9. Passwords are stored with their scrypt parameters; older hashes still
  // sign in and are upgraded then.
  const stored = async (email) =>
    (await one("SELECT password FROM users WHERE email=?", email)).password;
  const fresh = (await stored("owner@example.test")).split("$");
  assert.deepEqual(fresh.slice(0, 4), ["scrypt", "16384", "8", "5"]);
  assert.equal(fresh.length, 6);
  assert.match(fresh[5], /^[0-9a-f]{128}$/);
  checks++;
  const legacySalt = "legacy-salt-value";
  await run(
    "UPDATE users SET password=? WHERE email=?",
    `${legacySalt}:${scryptSync(password, legacySalt, 64).toString("hex")}`,
    "newcomer@example.test",
  );
  offset += 16 * 60000; // past the earlier sign-in slowdown for this email
  await expect("auth/login", 401, {
    body: { email: "newcomer@example.test", password: "not the password" },
    ip: "192.0.2.30",
  });
  assert.match(await stored("newcomer@example.test"), /^legacy-salt-value:/);
  await expect("auth/login", 200, {
    body: { email: "newcomer@example.test", password },
    ip: "192.0.2.30",
  });
  assert.match(await stored("newcomer@example.test"), /^scrypt\$16384\$8\$5\$/);
  await expect("auth/login", 200, {
    body: { email: "newcomer@example.test", password },
    ip: "192.0.2.31",
  });
  await expect("auth/login", 401, {
    body: { email: "nobody@example.test", password },
    ip: "192.0.2.31",
  });

  // 11. Sessions in use stay signed in: once a day at most, a session is
  // renewed for seven days and its cookie is sent again.
  const session = await expect("auth/login", 200, {
    body: { email: "owner@example.test", password },
    ip: "192.0.2.40",
  });
  const cookieAttributes = "; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800";
  assert.equal(session.setCookie, session.cookie + cookieAttributes);
  const expiresAt = async () =>
    (
      await one(
        "SELECT expires_at FROM sessions WHERE hash=?",
        digest(session.cookie.split("=")[1]),
      )
    ).expires_at;
  let visit = await expect("state", 200, { cookie: session.cookie });
  assert.equal(visit.json.user.email, "owner@example.test");
  assert.equal(visit.setCookie, "", "a new session is not rewritten");
  offset += 2 * 86400000;
  visit = await expect("state", 200, { cookie: session.cookie });
  assert.equal(visit.setCookie, session.cookie + cookieAttributes);
  assert((await expiresAt()) > Date.now() + 6.9 * 86400000);
  visit = await expect("state", 200, { cookie: session.cookie });
  assert.equal(visit.setCookie, "", "renewed at most once a day");
  // Used every few days, it outlives its first seven.
  for (let day = 0; day < 4; day++) {
    offset += 3 * 86400000;
    await expect("dishes", 200, {
      body: { name: "Soup", description: "Tomato soup" },
      cookie: session.cookie,
    });
  }
  offset += 2 * 86400000;
  const secure = await handle(
    new Request("https://localhost/api/state", {
      headers: { cookie: session.cookie, "cf-connecting-ip": "192.0.2.40" },
    }),
  );
  assert.equal(
    secure.headers.get("set-cookie"),
    session.cookie + cookieAttributes + "; Secure",
  );
  // An unused session still ends seven days after its last renewal.
  offset += 7 * 86400000 + 60000;
  visit = await expect("state", 200, { cookie: session.cookie });
  assert.equal(visit.json.user, null);
  await expect("dishes", 401, {
    body: { name: "Soup", description: "Tomato soup" },
    cookie: session.cookie,
  });

  // 2. Setup invitations made before the first administrator stop working
  // once one exists; a new or used reset link voids the others; open links
  // can be listed and revoked.
  const setupKey = process.env.ADMIN_SETUP_KEY;
  const setup1 = await expect("auth/bootstrap", 200, {
    body: { email: "ops1@example.test", setupKey },
    ip: "192.0.2.50",
  });
  const setup2 = await expect("auth/bootstrap", 200, {
    body: { email: "ops2@example.test", setupKey },
    ip: "192.0.2.50",
  });
  const adminSignup = await signup(
    "ops1@example.test",
    "Ops Diner",
    "192.0.2.51",
    {
      invite: setup1.json.invite,
    },
  );
  const adminCookie = adminSignup.cookie;
  const stale = await expect("auth/signup", 409, {
    body: {
      email: "ops2@example.test",
      password,
      restaurant: "Ops Two",
      invite: setup2.json.invite,
    },
    ip: "192.0.2.52",
  });
  assert.match(stale.json.error, /administrator already exists/);
  assert.equal(
    await one("SELECT id FROM users WHERE email='ops2@example.test'"),
    null,
  );
  const reset = (email) =>
    expect("admin/invite", 200, {
      body: { email, reset: true },
      cookie: adminCookie,
      ip: "192.0.2.51",
    });
  const redeemReset = (email, invite, status, newPassword = password) =>
    expect("auth/signup", status, {
      body: { email, password: newPassword, invite },
      ip: "192.0.2.53",
    });
  const firstReset = await reset("owner@example.test");
  const secondReset = await reset("owner@example.test");
  await redeemReset("owner@example.test", firstReset.json.invite, 403);
  // A reset left over from before still dies when another one is used.
  const leftover = "leftover-reset-link-0123456789abcdefghijk";
  await run(
    "INSERT INTO invites (hash,email,role,allowance,expires_at,created_at) VALUES (?,?,'reset',0,?,?)",
    digest(leftover),
    "owner@example.test",
    Date.now() + 86400000,
    Date.now(),
  );
  const reclaimed = await redeemReset(
    "owner@example.test",
    secondReset.json.invite,
    200,
  );
  // The reset also ends trust in every browser that signed in before; the
  // one that used the link is trusted from now on.
  assert.deepEqual(
    (
      await all("SELECT hash FROM trusted_devices WHERE user_id=?", ownerId)
    ).map((d) => d.hash),
    [deviceHash(reclaimed.device)],
  );
  await redeemReset("owner@example.test", leftover, 403, "attacker password 1");
  await expect("auth/login", 200, {
    body: { email: "owner@example.test", password },
    ip: "192.0.2.54",
  });
  await expect("state", 200, { cookie: reclaimed.cookie });
  // Open links are listed with an id and can be revoked.
  const invitation = await expect("admin/invite", 200, {
    body: { email: "guest@example.test", allowance: 3 },
    cookie: adminCookie,
    ip: "192.0.2.51",
  });
  const pendingReset = await reset("newcomer@example.test");
  let adminData = (await expect("admin", 200, { cookie: adminCookie })).json;
  assert.deepEqual(adminData.invites.map((i) => [i.email, i.role]).sort(), [
    ["guest@example.test", "owner"],
    ["newcomer@example.test", "reset"],
    ["ops2@example.test", "admin"],
  ]);
  const openReset = adminData.invites.find((i) => i.role === "reset");
  assert.equal(openReset.id, digest(pendingReset.json.invite));
  await expect("admin/invite-revoke", 200, {
    body: { id: openReset.id },
    cookie: adminCookie,
  });
  await expect("admin/invite-revoke", 404, {
    body: { id: openReset.id },
    cookie: adminCookie,
  });
  await expect("admin/invite-revoke", 400, {
    body: { id: "not-a-link" },
    cookie: adminCookie,
  });
  await expect("admin/invite-revoke", 403, {
    body: { id: openReset.id },
    cookie: reclaimed.cookie,
  });
  await redeemReset("newcomer@example.test", pendingReset.json.invite, 403);
  adminData = (await expect("admin", 200, { cookie: adminCookie })).json;
  assert.equal(adminData.invites.length, 2);
  assert(
    adminData.invites.some((i) => i.id === digest(invitation.json.invite)),
  );
  checks++;

  // 19. Owners can join the Pro waitlist once; administrators see it among
  // the requests.
  await expect("plan-waitlist", 401, { body: {} });
  for (let n = 0; n < 2; n++)
    assert.deepEqual(
      (
        await expect("plan-waitlist", 200, {
          body: {},
          cookie: reclaimed.cookie,
        })
      ).json,
      { ok: true },
    );
  await expect("plan-waitlist", 403, {
    body: {},
    cookie: reclaimed.cookie,
    headers: { origin: "https://elsewhere.example" },
  });
  await expect("access-requests", 202, {
    body: { email: "visitor@example.test", restaurant: "Visitor Diner" },
    ip: "192.0.2.55",
  });
  const requests = (await expect("admin", 200, { cookie: adminCookie })).json
    .requests;
  assert.deepEqual(
    requests.map((r) => [r.kind, r.email, r.restaurant, r.status]).sort(),
    [
      ["access", "visitor@example.test", "Visitor Diner", "new"],
      ["pro", "owner@example.test", "Corner Kitchen", "new"],
    ],
  );
  checks++;

  // 4. "5 free images, once per account": on the free plan a correction
  // reported as still wrong goes to the team, and a queued correction can't
  // be cancelled for an image back. A correction the service fails still
  // gives one back, and Pro keeps its automatic restorations.
  const free = await signup("free@example.test", "Free Kitchen", "192.0.2.60");
  const freeOpts = { cookie: free.cookie, ip: "192.0.2.60" };
  const freeRid = (await expect("state", 200, freeOpts)).json.restaurant.id;
  await run(
    "UPDATE restaurants SET daily_budget_cents=100000 WHERE id=?",
    freeRid,
  );
  const pasta = (
    await expect("dishes", 200, {
      body: { name: "Pasta", description: "Tomato pasta", confirmed: true },
      ...freeOpts,
    })
  ).json.id;
  const upload = new FormData();
  upload.set("file", new File([photo], "pasta.jpg", { type: "image/jpeg" }));
  upload.set(
    "normalized",
    new File([photo], "dish.jpg", { type: "image/jpeg" }),
  );
  upload.set("dishId", pasta);
  const source = (await expect("assets", 201, { body: upload, ...freeOpts }))
    .json.id;
  const remaining = async () =>
    (await expect("state", 200, freeOpts)).json.remaining;
  async function settled(jobId, status = "completed") {
    for (let n = 0; n < 5; n++) {
      offset += 31000;
      await expect("jobs/tick", 200, { body: {}, ...freeOpts });
      const state = (await expect("state", 200, freeOpts)).json;
      const output = state.outputs.find(
        (o) => o.job_id === jobId && o.status === status,
      );
      if (output) return output.asset_id;
    }
    throw new Error(`Job ${jobId} never became ${status}`);
  }
  async function reportedPhoto() {
    const job = await expect("jobs", 202, {
      body: {
        dishId: pasta,
        sourceId: source,
        requestKey: crypto.randomUUID(),
        candidateCount: 1,
      },
      ...freeOpts,
    });
    const asset = await settled(job.json.id);
    await expect(`photo-corrections/${asset}`, 200, {
      body: { reason: "ingredients", detail: "Wrong garnish" },
      ...freeOpts,
    });
    const created = await expect(`photo-corrections/${asset}/create`, 200, {
      body: {},
      ...freeOpts,
    });
    return { asset, correction: created.json.jobId };
  }
  assert.equal(await remaining(), 5);
  for (let n = 0; n < 4; n++) {
    const { correction } = await reportedPhoto();
    const corrected = await settled(correction);
    const again = await expect(`photo-corrections/${corrected}`, 200, {
      body: { reason: "portion", detail: "Still too small" },
      ...freeOpts,
    });
    assert.equal(again.json.status, "review");
  }
  assert.equal(await remaining(), 1, "8 images made, 4 of the 5 used");
  const queued = await reportedPhoto();
  const refused = await expect(`jobs/${queued.correction}/cancel`, 409, {
    body: {},
    ...freeOpts,
  });
  assert.match(refused.json.error, /can’t be cancelled/);
  await settled(queued.correction);
  assert.equal(await remaining(), 0);
  // An owner cancellation recorded before this change is not a failure.
  await run(
    "UPDATE outputs SET status='failed',error='Cancelled before creation. No images used.' WHERE job_id=?",
    queued.correction,
  );
  await run("UPDATE jobs SET status='failed' WHERE id=?", queued.correction);
  await run(
    "UPDATE photo_corrections SET status='queued' WHERE correction_job_id=?",
    queued.correction,
  );
  const cancelledView = await expect(
    `photo-corrections/${queued.asset}`,
    200,
    freeOpts,
  );
  assert.equal(cancelledView.json.status, "review");
  assert.equal(await remaining(), 0);
  // The service failing to make a correction gives the image back.
  await run("UPDATE restaurants SET allowance=allowance+1 WHERE id=?", freeRid);
  const failing = await reportedPhoto();
  imagesFail = true;
  await settled(failing.correction, "failed");
  imagesFail = false;
  const failedView = await expect(
    `photo-corrections/${failing.asset}`,
    200,
    freeOpts,
  );
  assert.equal(failedView.json.status, "credited");
  assert.equal(await remaining(), 1);
  // On Pro, reporting a correction as still wrong restores automatically.
  const t = Date.now();
  await run(
    "INSERT INTO billing_accounts (restaurant_id,customer_id,subscription_id,status) VALUES (?,'cus_fixture','sub_fixture','active')",
    freeRid,
  );
  await run(
    "INSERT INTO billing_periods (id,restaurant_id,subscription_id,invoice_id,starts_at,ends_at,allowance) VALUES ('sub_fixture:1',?,'sub_fixture','in_fixture',?,?,10)",
    freeRid,
    t - 86400000,
    t + 29 * 86400000,
  );
  assert.equal(await remaining(), 10);
  const pro = await reportedPhoto();
  const proCorrected = await settled(pro.correction);
  const proReport = await expect(`photo-corrections/${proCorrected}`, 200, {
    body: { reason: "portion", detail: "Still too small" },
    ...freeOpts,
  });
  assert.equal(proReport.json.status, "credited");
  assert.equal(await remaining(), 10);
  assert.equal(imageCalls, 14);
  checks++;

  // 21. A photo an unfinished image is made from can't be removed until the
  // image is done. A correction gives an image back only when the service or
  // the site fails it, not when the owner removed its original meanwhile,
  // filled their workspace, or worded the report so the safety check
  // declined it: those go to the team.
  const newSource = async () => {
    const form = new FormData();
    form.set("file", new File([photo], "pasta.jpg", { type: "image/jpeg" }));
    form.set(
      "normalized",
      new File([photo], "dish.jpg", { type: "image/jpeg" }),
    );
    form.set("dishId", pasta);
    return (await expect("assets", 201, { body: form, ...freeOpts })).json.id;
  };
  const imageFrom = (sourceId) =>
    expect("jobs", 202, {
      body: {
        dishId: pasta,
        sourceId,
        requestKey: crypto.randomUUID(),
        candidateCount: 1,
      },
      ...freeOpts,
    });
  const remove = (assetId, status) =>
    expect(`assets/${assetId}`, status, { method: "DELETE", ...freeOpts });
  const queuedFor = await newSource();
  const queuedImage = await imageFrom(queuedFor);
  assert.equal(
    (await remove(queuedFor, 409)).json.error,
    "A queued image uses this photo. Cancel it in Photo Studio, or wait until it’s finished, then remove the photo.",
  );
  await expect(`jobs/${queuedImage.json.id}/cancel`, 200, {
    body: {},
    ...freeOpts,
  });
  await remove(queuedFor, 200);
  const original = await newSource();
  const originalAsset = await settled((await imageFrom(original)).json.id);
  await expect(`photo-corrections/${originalAsset}`, 200, {
    body: { reason: "ingredients", detail: "Wrong garnish" },
    ...freeOpts,
  });
  const correcting = await expect(
    `photo-corrections/${originalAsset}/create`,
    200,
    { body: {}, ...freeOpts },
  );
  assert.equal(
    (await remove(original, 409)).json.error,
    "An image being made uses this photo. You can remove the photo once it’s finished.",
  );
  // Removed anyway, say by a request already under way, the correction
  // fails and waits for the team instead of giving an image back.
  const left = await remaining();
  await run("UPDATE assets SET deleted_at=? WHERE id=?", Date.now(), original);
  await settled(correcting.json.jobId, "failed");
  assert.equal(
    (await expect(`photo-corrections/${originalAsset}`, 200, freeOpts)).json
      .status,
    "review",
  );
  assert.equal(await remaining(), left);
  const declined = await reportedPhoto();
  imagesFail = "moderation_blocked";
  await settled(declined.correction, "failed");
  imagesFail = false;
  assert.equal(
    (await expect(`photo-corrections/${declined.asset}`, 200, freeOpts)).json
      .status,
    "review",
  );
  const crowded = await reportedPhoto();
  process.env.WORKSPACE_STORAGE_MB = "1";
  await settled(crowded.correction, "failed");
  delete process.env.WORKSPACE_STORAGE_MB;
  assert.equal(
    (await expect(`photo-corrections/${crowded.asset}`, 200, freeOpts)).json
      .status,
    "review",
  );
  assert.equal(await remaining(), left - 2, "only the two originals");
  checks += 4;

  // 7. Malformed IDs are a 400, not a 500 that trips the error-burst alert.
  for (const [path, body] of [
    ["captions", { dishId: { a: 1 }, body: "Hello" }],
    ["captions/generate", { dishId: ["x"] }],
    ["captions/generate", { dishId: pasta, promotionId: 5 }],
    ["batches/retry", {}],
    ["batches/retry", { id: "not-an-id" }],
  ])
    await expect(path, 400, { body, ...freeOpts });
  await expect("batches/retry", 404, {
    body: { id: crypto.randomUUID() },
    ...freeOpts,
  });
  await expect("assets", 400, freeOpts);
  await expect("assets/not-an-id", 400, freeOpts);
  await expect(`assets/${crypto.randomUUID()}`, 404, freeOpts);
  await expect("captions", 200, {
    body: { dishId: pasta, body: "Our tomato pasta." },
    ...freeOpts,
  });

  // 8. A saved look naming a photo style that was since removed still opens
  // the workspace: unknown values fall back to defaults, valid ones stay.
  await run(
    "UPDATE restaurants SET style=? WHERE id=?",
    JSON.stringify({
      primary: "#123456",
      photoPreset: "retired-style-id",
      referenceIds: ["not-an-id"],
      photoDefaults: { surface: "Marble", lighting: "Soft daylight" },
    }),
    freeRid,
  );
  let look = (await expect("state", 200, freeOpts)).json.restaurant.style;
  assert.equal(look.primary, "#123456");
  assert.equal(look.photoPreset, "");
  assert.deepEqual(look.referenceIds, []);
  assert.equal(look.photoDefaults.surface, "As shown");
  assert.equal(look.photoDefaults.lighting, "Soft daylight");
  await run("UPDATE restaurants SET style='not json' WHERE id=?", freeRid);
  look = (await expect("state", 200, freeOpts)).json.restaurant.style;
  assert.equal(look.photoPreset, "");
  await run("UPDATE restaurants SET style='{}' WHERE id=?", freeRid);

  // Historical staff links remain part of account-deletion cleanup.
  await run(
    "INSERT INTO staff_links (hash,restaurant_id,expires_at,created_at) VALUES (?,?,?,?)",
    digest("retired-staff-link-fixture"),
    freeRid,
    Date.now() + 86400000,
    Date.now(),
  );

  // Owner uploads retain their hourly allowance.
  const photoForm = (dishId) => {
    const form = new FormData();
    form.set("file", new File([photo], "pasta.jpg", { type: "image/jpeg" }));
    form.set(
      "normalized",
      new File([photo], "dish.jpg", { type: "image/jpeg" }),
    );
    form.set("dishId", dishId);
    return form;
  };
  await run(
    "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,100,?) ON CONFLICT(key) DO UPDATE SET count=100,expires_at=excluded.expires_at",
    digest("uploads:" + freeRid),
    Date.now() + 3600000,
  );
  await expect("assets", 429, { body: photoForm(pasta), ...freeOpts });
  await run(
    "DELETE FROM rate_limits WHERE key=?",
    digest("uploads:" + freeRid),
  );

  // 15. WebP originals are accepted with their dimensions checked; AVIF is
  // refused plainly instead of being stored as HEIC.
  const webp = (chunk, width, height) => {
    const bytes = Buffer.alloc(40);
    bytes.write("RIFF", 0, "latin1");
    bytes.writeUInt32LE(32, 4);
    bytes.write("WEBP", 8, "latin1");
    bytes.write(chunk, 12, "latin1");
    bytes.writeUInt32LE(20, 16);
    if (chunk === "VP8 ") {
      bytes.set([0x9d, 0x01, 0x2a], 23);
      bytes.writeUInt16LE(width, 26);
      bytes.writeUInt16LE(height, 28);
    } else if (chunk === "VP8L") {
      bytes[20] = 0x2f;
      bytes.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
    } else {
      bytes.writeUIntLE(width - 1, 24, 3);
      bytes.writeUIntLE(height - 1, 27, 3);
    }
    return bytes;
  };
  for (const chunk of ["VP8 ", "VP8L", "VP8X"])
    validateImageDimensions(webp(chunk, 1200, 800), "image/webp");
  assert.throws(
    () => validateImageDimensions(webp("VP8X", 20000, 20000), "image/webp"),
    (error) => error.status === 413,
  );
  assert.throws(
    () => validateImageDimensions(webp("VP8 ", 0, 0), "image/webp"),
    (error) => error.status === 400,
  );
  checks++;
  const originalForm = (bytes, name, fields = {}) => {
    const form = new FormData();
    form.set("file", new File([bytes], name));
    form.set(
      "normalized",
      new File([photo], "dish.jpg", { type: "image/jpeg" }),
    );
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return form;
  };
  const webpUpload = await expect("assets", 201, {
    body: originalForm(webp("VP8X", 1200, 800), "dish.webp", {
      dishId: pasta,
    }),
    ...freeOpts,
  });
  const listed = (await expect("state", 200, freeOpts)).json.assets.find(
    (a) => a.id === webpUpload.json.id,
  );
  assert.equal(listed.mime, "image/webp");
  let file = await expect(
    `assets/${webpUpload.json.id}?original&download`,
    200,
    freeOpts,
  );
  assert.equal(file.res.headers.get("content-type"), "image/webp");
  assert.match(file.res.headers.get("content-disposition"), /\.webp"$/);
  file = await expect(`assets/${webpUpload.json.id}?download`, 200, freeOpts);
  assert.equal(file.res.headers.get("content-type"), "image/jpeg");
  assert.match(file.res.headers.get("content-disposition"), /\.jpg"$/);
  const isoFile = (brands) =>
    Buffer.concat([
      Buffer.from([0, 0, 0, 8 + brands.length]),
      Buffer.from("ftyp" + brands, "latin1"),
      Buffer.alloc(32),
    ]);
  const avif = await expect("assets", 400, {
    body: originalForm(isoFile("avif\0\0\0\0mif1miafMA1B"), "dish.avif", {
      dishId: pasta,
    }),
    ...freeOpts,
  });
  assert.equal(
    avif.json.error,
    "AVIF photos aren’t supported yet. Export a JPEG or PNG.",
  );
  const heic = await expect("assets", 201, {
    body: originalForm(isoFile("heic\0\0\0\0mif1heic"), "dish.heic", {
      dishId: pasta,
    }),
    ...freeOpts,
  });
  assert.equal(
    (await expect("state", 200, freeOpts)).json.assets.find(
      (a) => a.id === heic.json.id,
    ).mime,
    "image/heic",
  );

  // 16. A transparent PNG logo stays a PNG: in the workspace (and Post
  // Maker), and on the guest menu, even when a menu published a JPEG copy
  // of it.
  const logoPng = readFileSync("public/apple-touch-icon.png");
  const logo = (
    await expect("assets", 201, {
      body: originalForm(logoPng, "logo.png", { kind: "logo" }),
      ...freeOpts,
    })
  ).json.id;
  const bytesOf = async (result) => Buffer.from(await result.res.arrayBuffer());
  let logoFile = await expect(`assets/${logo}`, 200, freeOpts);
  assert.equal(logoFile.res.headers.get("content-type"), "image/png");
  assert((await bytesOf(logoFile)).equals(logoPng));
  const freeMenu = (
    await expect("menus", 200, {
      body: {
        id: crypto.randomUUID(),
        draft: newMenuDocument({
          sections: [
            {
              id: "mains",
              name: "Mains",
              items: [
                newMenuEntry({ dishId: pasta, name: "Pasta", price: 1200 }),
              ],
            },
          ],
        }),
      },
      ...freeOpts,
    })
  ).json;
  await expect(`menus/${freeMenu.id}/publish`, 200, {
    body: { revision: freeMenu.revision },
    ...freeOpts,
  });
  const slug = (await expect("state", 200, freeOpts)).json.restaurant.slug;
  assert(
    await bucket().head(`public/${freeRid}/${logo}`),
    "publishing copies the logo for guests",
  );
  await bucket().put(`public/${freeRid}/${logo}`, photo, {
    httpMetadata: { contentType: "image/jpeg" },
  });
  logoFile = await expect(`public/${slug}/assets/${logo}`, 200, {
    ip: "192.0.2.62",
  });
  assert.equal(logoFile.res.headers.get("content-type"), "image/png");
  assert((await bytesOf(logoFile)).equals(logoPng));
  // 17. Guests' browsers keep published images for a week, then revalidate;
  // private workspace images are never cached.
  assert.equal(
    logoFile.res.headers.get("cache-control"),
    "public, max-age=604800, stale-while-revalidate=2592000",
  );
  assert.equal(
    (await expect(`assets/${logo}`, 200, freeOpts)).res.headers.get(
      "cache-control",
    ),
    "private, no-store",
  );
  // A JPEG logo is still served from its working copy.
  const jpegLogo = (
    await expect("assets", 201, {
      body: originalForm(photo, "logo.jpg", { kind: "logo" }),
      ...freeOpts,
    })
  ).json.id;
  logoFile = await expect(`assets/${jpegLogo}`, 200, freeOpts);
  assert.equal(logoFile.res.headers.get("content-type"), "image/jpeg");

  // 13. An administrator can take a restaurant's public pages offline (the
  // guest menu, its images, visits and specials) and nothing can be
  // republished until they restore them.
  const guest = { ip: "192.0.2.63" };
  await expect(`public/${slug}`, 200, guest);
  await expect("admin/takedown", 403, {
    body: { id: freeRid, offline: true },
    ...freeOpts,
  });
  await expect("admin/takedown", 200, {
    body: { id: freeRid, offline: true },
    cookie: adminCookie,
  });
  await expect(`public/${slug}`, 404, guest);
  await expect(`public/${slug}/assets/${logo}`, 404, guest);
  await expect(`public/${slug}/events`, 404, {
    body: { kind: "menu_visit", session: crypto.randomUUID() },
    ...guest,
  });
  assert.deepEqual(await resolveMenuAddress(slug), {
    restaurant: null,
    redirectTo: null,
  });
  const blocked = await expect(`menus/${freeMenu.id}/publish`, 403, {
    body: { revision: freeMenu.revision },
    ...freeOpts,
  });
  assert.match(blocked.json.error, /taken your public menu pages offline/);
  for (const path of ["menus", "promotions"])
    await expect(`${path}/${crypto.randomUUID()}/publish`, 403, {
      body: {},
      ...freeOpts,
    });
  const adminRow = (
    await expect("admin", 200, { cookie: adminCookie })
  ).json.restaurants.find((row) => row.id === freeRid);
  assert.equal(adminRow.public_suspended, 1);
  assert.equal(adminRow.slug, slug);
  assert.equal(
    (await expect("state", 200, freeOpts)).json.restaurant.public_suspended,
    1,
  );
  await expect("admin/takedown", 200, {
    body: { id: freeRid, offline: false },
    cookie: adminCookie,
  });
  await expect(`public/${slug}`, 200, guest);
  await expect(`menus/${freeMenu.id}/publish`, 200, {
    body: { revision: freeMenu.revision },
    ...freeOpts,
  });
  await expect("admin/takedown", 404, {
    body: { id: crypto.randomUUID(), offline: true },
    cookie: adminCookie,
  });

  // 5. Menu addresses: only an address that was live (or the signup
  // address, unique to the restaurant) keeps a redirect, a restaurant keeps
  // at most five, and an administrator can release one.
  const squatter = await signup(
    "squat@example.test",
    "Squat Kitchen",
    "192.0.2.70",
  );
  const squat = { cookie: squatter.cookie, ip: "192.0.2.70" };
  const { id: squatRid, slug: squatStart } = (await expect("state", 200, squat))
    .json.restaurant;
  for (const address of [
    "starbucks",
    "joes-pizza",
    "the-corner-cafe",
    "taqueria-el-sol",
  ])
    await expect("restaurant/address", 200, { body: { address }, ...squat });
  const kept = async (rid) =>
    (
      await all(
        "SELECT slug FROM slug_redirects WHERE restaurant_id=? ORDER BY slug",
        rid,
      )
    ).map((row) => row.slug);
  assert.deepEqual(await kept(squatRid), [squatStart], "others are freed");
  const joe = await signup("joe@example.test", "Joe's Pizza", "192.0.2.71");
  const joeOpts = { cookie: joe.cookie, ip: "192.0.2.71" };
  const check = async (address) =>
    (await expect(`restaurant/address?check=${address}`, 200, joeOpts)).json
      .available;
  assert.equal(await check("joes-pizza"), true);
  await expect("restaurant/address", 200, {
    body: { address: "joes-pizza" },
    ...joeOpts,
  });
  // An earlier address kept before this change by a restaurant that never
  // went live holds nothing either.
  await run(
    "INSERT INTO slug_redirects (slug,restaurant_id,created_at) VALUES ('old-squat',?,?)",
    squatRid,
    Date.now(),
  );
  assert.equal(await check("old-squat"), true);
  // A current address stays taken until an administrator releases it.
  assert.equal(await check("taqueria-el-sol"), false);
  const moved = await expect("admin/release-address", 200, {
    body: { address: "taqueria-el-sol" },
    cookie: adminCookie,
  });
  assert.equal(moved.json.moved, squatStart);
  assert.deepEqual(await kept(squatRid), ["old-squat"]);
  assert.equal(await check("taqueria-el-sol"), true);
  await expect("admin/release-address", 404, {
    body: { address: "nobody-uses-this" },
    cookie: adminCookie,
  });
  await expect("admin/release-address", 403, {
    body: { address: "joes-pizza" },
    ...joeOpts,
  });
  // A live menu keeps up to five earlier addresses working.
  const joeRid = (await expect("state", 200, joeOpts)).json.restaurant.id;
  const [joeStart] = await kept(joeRid);
  // Possessive names drop the apostrophe: "Joe's Pizza" → joes-pizza.
  assert.match(joeStart, /^joes-pizza-[0-9a-f]{8}$/);
  const joeDish = (
    await expect("dishes", 200, {
      body: { name: "Margherita", description: "Tomato and basil" },
      ...joeOpts,
    })
  ).json.id;
  const joeMenu = (
    await expect("menus", 200, {
      body: {
        id: crypto.randomUUID(),
        draft: newMenuDocument({
          sections: [
            {
              id: "pizza",
              name: "Pizza",
              items: [
                newMenuEntry({
                  dishId: joeDish,
                  name: "Margherita",
                  price: 1100,
                }),
              ],
            },
          ],
        }),
      },
      ...joeOpts,
    })
  ).json;
  await expect(`menus/${joeMenu.id}/publish`, 200, {
    body: { revision: joeMenu.revision },
    ...joeOpts,
  });
  for (let n = 1; n <= 4; n++)
    await expect("restaurant/address", 200, {
      body: { address: `joes-pizza-${n}` },
      ...joeOpts,
    });
  assert.deepEqual(
    await kept(joeRid),
    [
      joeStart,
      "joes-pizza",
      "joes-pizza-1",
      "joes-pizza-2",
      "joes-pizza-3",
    ].sort(),
  );
  assert.equal(
    (await expect("public/joes-pizza-2", 200, guest)).json.menu.restaurant.name,
    "Joe's Pizza",
  );
  const full = await expect("restaurant/address", 409, {
    body: { address: "joes-pizza-5" },
    ...joeOpts,
  });
  assert.match(full.json.error, /already keeps 5 earlier addresses/);
  // Moving back to one of its own earlier addresses is always possible.
  await expect("restaurant/address", 200, {
    body: { address: "joes-pizza-2" },
    ...joeOpts,
  });
  await expect("admin/release-address", 200, {
    body: { address: "joes-pizza-1" },
    cookie: adminCookie,
  });
  await expect("public/joes-pizza-1", 404, guest);
  await expect("restaurant/address", 200, {
    body: { address: "joes-pizza-6" },
    ...joeOpts,
  });
  assert.equal((await kept(joeRid)).length, 5);
  // Once the menu is offline, an address chosen then is not kept unless a
  // menu goes live while it is current.
  await expect("admin/release-address", 200, {
    body: { address: "joes-pizza-3" },
    cookie: adminCookie,
  });
  await expect(`menus/${joeMenu.id}/unpublish`, 200, {
    body: { revision: joeMenu.revision, confirmed: true },
    ...joeOpts,
  });
  offset += 3600000; // past the hourly limit on address changes
  await expect("restaurant/address", 200, {
    body: { address: "joes-pizza-7" },
    ...joeOpts,
  });
  assert((await kept(joeRid)).includes("joes-pizza-6"), "it was live");
  await expect("restaurant/address", 200, {
    body: { address: "joes-pizza-8" },
    ...joeOpts,
  });
  assert(!(await kept(joeRid)).includes("joes-pizza-7"), "never live");
  checks++;

  // 14. A new restaurant takes the time zone the owner's browser sent;
  // anything that isn't a valid IANA zone keeps the default.
  const zoneOf = async (email, restaurant, ip, timezone) =>
    (
      await expect("state", 200, {
        cookie: (await signup(email, restaurant, ip, { timezone })).cookie,
        ip,
      })
    ).json.restaurant.timezone;
  assert.equal(
    await zoneOf(
      "tokyo@example.test",
      "Sakura Ramen",
      "192.0.2.80",
      "Asia/Tokyo",
    ),
    "Asia/Tokyo",
  );
  assert.equal(
    await zoneOf("utc@example.test", "Zero Diner", "192.0.2.81", "utc"),
    "UTC",
  );
  assert.equal(
    await zoneOf(
      "mars@example.test",
      "Olympus Diner",
      "192.0.2.82",
      "Mars/Olympus_Mons",
    ),
    "America/New_York",
  );
  assert.equal(
    await zoneOf("none@example.test", "Plain Diner", "192.0.2.83", undefined),
    "America/New_York",
  );

  // 12. Deleting an account needs the password and a typed confirmation. It
  // removes every row and stored file of the restaurant, signs it out and
  // leaves other restaurants alone; the only administrator can't delete.
  const filesUnder = (prefix) => {
    const dir = join(root, "objects", prefix);
    return existsSync(dir)
      ? readdirSync(dir, { recursive: true }).filter((name) =>
          statSync(join(dir, name)).isFile(),
        )
      : [];
  };
  const joePhoto = (
    await expect("assets", 201, { body: photoForm(joeDish), ...joeOpts })
  ).json.id;
  const freeUser = (
    await one("SELECT id FROM users WHERE email='free@example.test'")
  ).id;
  const t0 = Date.now(),
    documentId = crypto.randomUUID(),
    importId = crypto.randomUUID();
  await run(
    "INSERT INTO creation_drafts (id,restaurant_id,kind,draft,updated_at) VALUES (?,?,'menu','{}',?)",
    crypto.randomUUID(),
    freeRid,
    t0,
  );
  await run(
    "INSERT INTO studio_libraries (restaurant_id,updated_at) VALUES (?,?)",
    freeRid,
    t0,
  );
  await run(
    "INSERT INTO menu_documents (id,restaurant_id,draft,published,created_at,updated_at) VALUES (?,?,'{}','{}',?,?)",
    documentId,
    freeRid,
    t0,
    t0,
  );
  await run(
    "INSERT INTO menu_publication_history (id,menu_id,restaurant_id,snapshot,revision,created_at) VALUES (?,?,?,'{}',1,?)",
    crypto.randomUUID(),
    documentId,
    freeRid,
    t0,
  );
  await run(
    "INSERT INTO promotions (id,restaurant_id,draft,created_at,updated_at) VALUES (?,?,'{}',?,?)",
    crypto.randomUUID(),
    freeRid,
    t0,
    t0,
  );
  await run(
    "INSERT INTO batch_items (id,restaurant_id,batch_id,dish_id,created_at) VALUES (?,?,?,?,?)",
    crypto.randomUUID(),
    freeRid,
    crypto.randomUUID(),
    pasta,
    t0,
  );
  await run(
    "INSERT INTO asset_edits (asset_id,parent_id,source_id,edits) VALUES (?,?,?,'{}')",
    webpUpload.json.id,
    source,
    source,
  );
  await run(
    "INSERT INTO menu_imports (id,restaurant_id,name,key,mime,created_at) VALUES (?,?,'menu.jpg',?,'image/jpeg',?)",
    importId,
    freeRid,
    `private/${freeRid}/imports/${importId}`,
    t0,
  );
  await bucket().put(`private/${freeRid}/imports/${importId}`, photo, {
    httpMetadata: { contentType: "image/jpeg" },
  });
  await expect("restaurant/address", 200, {
    body: { address: "free-kitchen-moved" },
    ...freeOpts,
  });
  await expect("plan-waitlist", 200, { body: {}, ...freeOpts });
  await expect("admin/invite", 200, {
    body: { email: "free@example.test", reset: true },
    cookie: adminCookie,
  });
  const scoped = (
    await all(
      "SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%restaurant_id%'",
    )
  ).map((row) => row.name);
  const leftovers = async () => {
    const found = {};
    for (const table of [...scoped, "restaurants"]) {
      const { n } = await one(
        `SELECT count(*) AS n FROM ${table} WHERE ${table === "restaurants" ? "id" : "restaurant_id"}=?`,
        freeRid,
      );
      if (n) found[table] = n;
    }
    return found;
  };
  const before = await leftovers();
  for (const table of [
    "restaurants",
    "dishes",
    "assets",
    "jobs",
    "outputs",
    "photo_corrections",
    "captions",
    "staff_links",
    "slug_redirects",
    "storage_reservations",
    "events",
    "studio_look_uses",
    "billing_accounts",
    "billing_periods",
    "ai_spend",
  ])
    assert(before[table], `fixture has ${table} rows`);
  assert(
    await one("SELECT 1 FROM trusted_devices WHERE user_id=?", freeUser),
    "fixture has a trusted device",
  );
  assert(filesUnder(`private/${freeRid}`).length > 5);
  assert(filesUnder(`public/${freeRid}`).length > 0);
  const joeFiles = filesUnder(`private/${joeRid}`).length;
  assert(joeFiles >= 2);
  const joeRows = await one(
    "SELECT (SELECT count(*) FROM dishes WHERE restaurant_id=?) AS dishes,(SELECT count(*) FROM assets WHERE restaurant_id=?) AS assets",
    joeRid,
    joeRid,
  );
  const deletion = (body, cookie = free.cookie) => ({
    body,
    cookie,
    ip: "192.0.2.60",
  });
  await expect(
    "account/delete",
    401,
    deletion({ password, confirm: "DELETE" }, ""),
  );
  await expect(
    "account/delete",
    400,
    deletion({ password, confirm: "delete it" }),
  );
  await expect("account/delete", 400, deletion({ password }));
  const wrong = await expect(
    "account/delete",
    403,
    deletion({ password: "not the password", confirm: "DELETE" }),
  );
  assert.equal(wrong.json.error, "That password is incorrect.");
  // A live subscription is cancelled first. Billing isn't configured here,
  // so the last known state decides and Stripe isn't contacted (nor is
  // Manage billing offered, since it's off too).
  const billed = await expect(
    "account/delete",
    409,
    deletion({ password, confirm: "DELETE" }),
  );
  assert.equal(
    billed.json.error,
    "Your Pro subscription is still active, so your account can’t be deleted yet.",
  );
  // Once it has ended, its billing records go with the account.
  await run(
    "UPDATE billing_accounts SET status='canceled' WHERE restaurant_id=?",
    freeRid,
  );
  const lastAdmin = await expect(
    "account/delete",
    409,
    deletion({ password, confirm: "DELETE" }, adminCookie),
  );
  assert.match(lastAdmin.json.error, /only administrator/);
  const deleted = await expect(
    "account/delete",
    200,
    deletion({ password, confirm: " delete " }),
  );
  assert.equal(
    deleted.setCookie,
    "menu_material_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  );
  assert.deepEqual(await leftovers(), { ai_spend: before.ai_spend });
  assert.deepEqual(filesUnder(`private/${freeRid}`), []);
  assert.deepEqual(filesUnder(`public/${freeRid}`), []);
  assert.equal(await one("SELECT id FROM users WHERE id=?", freeUser), null);
  for (const [table, column, value] of [
    ["sessions", "user_id", freeUser],
    ["trusted_devices", "user_id", freeUser],
    ["invites", "email", "free@example.test"],
    ["launch_requests", "email", "free@example.test"],
  ])
    assert.equal(
      (await one(`SELECT count(*) AS n FROM ${table} WHERE ${column}=?`, value))
        .n,
      0,
      table,
    );
  // Only a one-way hash of the email stays, so its free images aren't
  // granted again (tests/plans.mjs).
  const freeGrantKept = (email) =>
    one(
      "SELECT 1 AS kept FROM free_grant_emails WHERE hash=?",
      digest(`free-grant:${email}`),
    );
  assert(await freeGrantKept("free@example.test"));
  await expect("dishes", 401, {
    body: { name: "Soup", description: "Tomato soup" },
    ...freeOpts,
  });
  await expect("auth/login", 401, {
    body: { email: "free@example.test", password },
    ip: "192.0.2.64",
  });
  await expect(`public/${slug}`, 404, guest);
  await expect("public/free-kitchen-moved", 404, guest);
  // Other restaurants keep everything.
  assert.equal(filesUnder(`private/${joeRid}`).length, joeFiles);
  assert.deepEqual(
    await one(
      "SELECT (SELECT count(*) FROM dishes WHERE restaurant_id=?) AS dishes,(SELECT count(*) FROM assets WHERE restaurant_id=?) AS assets",
      joeRid,
      joeRid,
    ),
    joeRows,
  );
  await expect(`assets/${joePhoto}`, 200, joeOpts);
  await expect("state", 200, { cookie: adminCookie });
  checks++;

  // 13. An administrator can delete an owner's account, for an owner who
  // asks and can't sign in, by typing the owner's email. The owner's own
  // rules apply, and the administrator can't delete their own this way.
  const joeUser = (
    await one("SELECT id FROM users WHERE email='joe@example.test'")
  ).id;
  const byAdmin = (id, confirm, cookie = adminCookie) => ({
    body: { id, confirm },
    cookie,
    ip: "192.0.2.62",
  });
  await expect(
    "admin/delete-account",
    403,
    byAdmin(joeRid, "joe@example.test", joeOpts.cookie),
  );
  await expect(
    "admin/delete-account",
    400,
    byAdmin(joeRid, "someone@example.test"),
  );
  await expect("admin/delete-account", 400, byAdmin("not-an-id", "x"));
  await expect(
    "admin/delete-account",
    404,
    byAdmin(crypto.randomUUID(), "joe@example.test"),
  );
  const adminRid = (await expect("state", 200, { cookie: adminCookie })).json
    .restaurant.id;
  assert.match(
    (
      await expect(
        "admin/delete-account",
        400,
        byAdmin(adminRid, "ops1@example.test"),
      )
    ).json.error,
    /in Settings/,
  );
  await run(
    "INSERT INTO billing_accounts (restaurant_id,customer_id,subscription_id,status) VALUES (?,'cus_joe','sub_joe','past_due')",
    joeRid,
  );
  assert.match(
    (
      await expect(
        "admin/delete-account",
        409,
        byAdmin(joeRid, "joe@example.test"),
      )
    ).json.error,
    /Pro subscription is still active/,
  );
  assert(await one("SELECT id FROM restaurants WHERE id=?", joeRid));
  await run(
    "UPDATE billing_accounts SET status='canceled' WHERE restaurant_id=?",
    joeRid,
  );
  await expect(
    "admin/delete-account",
    200,
    byAdmin(joeRid, " JOE@example.test "),
  );
  assert.equal(
    await one("SELECT id FROM restaurants WHERE id=?", joeRid),
    null,
  );
  assert.equal(await one("SELECT id FROM users WHERE id=?", joeUser), null);
  assert.equal(
    await one("SELECT 1 FROM trusted_devices WHERE user_id=?", joeUser),
    null,
  );
  assert(await freeGrantKept("joe@example.test"));
  assert.equal(
    await one("SELECT * FROM billing_accounts WHERE restaurant_id=?", joeRid),
    null,
  );
  assert.deepEqual(filesUnder(`private/${joeRid}`), []);
  await expect(`assets/${joePhoto}`, 401, joeOpts);
  assert.equal(
    (await expect("admin", 200, { cookie: adminCookie })).json.restaurants.some(
      (r) => r.id === joeRid,
    ),
    false,
  );
  checks++;

  // 22. An administrator changing an account's images decides them: free
  // images it was waiting for (lib/server/free-grants.ts) aren't added later,
  // and the note about them goes. Saving other controls keeps the wait.
  process.env.FREE_SIGNUP_GRANTS_PER_DAY = "0";
  const waiter = await signup(
    "waiter@example.test",
    "Wait Kitchen",
    "192.0.2.150",
  );
  const waiterOpts = { cookie: waiter.cookie, ip: "192.0.2.150" };
  const waiterState = (await expect("state", 200, waiterOpts)).json;
  assert.deepEqual(waiterState.freeImages, {
    status: "held",
    images: 5,
    days: null,
  });
  const controls = (allowance) => ({
    body: { id: waiterState.restaurant.id, allowance, paused: false },
    cookie: adminCookie,
  });
  await expect("admin/restaurant", 200, controls(0));
  assert.equal(
    (await expect("state", 200, waiterOpts)).json.freeImages.status,
    "held",
  );
  await expect("admin/restaurant", 200, controls(3));
  delete process.env.FREE_SIGNUP_GRANTS_PER_DAY;
  offset += 2 * 60000;
  await grantHeldImages();
  const decided = (await expect("state", 200, waiterOpts)).json;
  assert.equal(decided.remaining, 3);
  assert.equal(decided.freeImages, null);
  checks += 2;

  console.log(
    `PASS: ${checks} account security checks: per-network limits on the IPv6 /64 (and /48 for signups) with no site-wide lockout, a per-account sign-in slowdown that states no wait and that browsers which signed in before skip, versioned password hashes, sliding sessions, revocable reset and setup links, the Pro waitlist, once-only free images (and photos kept while an image uses them), ID validation, lenient saved looks, staff link scope and limits, WebP and AVIF uploads, transparent logos, cacheable public images, admin takedown, menu-address squatting, signup time zones, account deletion (keeping only a hash of the email, against a second free grant), administrator account deletion and administrators deciding held free images.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
