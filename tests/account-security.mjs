import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
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
const { caller } = await import("../lib/server/safeguards.ts");
const { digest, one, run } = await import("../lib/server/core.ts");

const webhooks = [];
globalThis.fetch = async (url, init = {}) => {
  if (String(url).startsWith("https://hooks.example.test/")) {
    webhooks.push(JSON.parse(init.body));
    return new Response("ok");
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
  const setCookie = res.headers.get("set-cookie") || "";
  return {
    status: res.status,
    json,
    res,
    setCookie,
    cookie: setCookie.split(";")[0],
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
  assert.match(slowed.json.error, /Try again in 1 second\./);
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
  assert.match(longer.json.error, /Try again in 2 seconds\./);
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

  console.log(
    `PASS: ${checks} account security checks: per-network limits on the IPv6 /64 with no site-wide lockout, a per-account sign-in slowdown, versioned password hashes, sliding sessions, revocable reset and setup links, the Pro waitlist;`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
