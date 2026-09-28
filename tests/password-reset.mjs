import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "menu-material-reset-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.APP_ORIGIN = "https://menumaterial.example.test";
process.env.RESEND_API_KEY = "fixture-not-a-real-key";
process.env.PASSWORD_RESET_FROM = "Menu Material <accounts@example.test>";
const { handle } = await import("../lib/server/api.ts");
const { env } = await import("../lib/local-runtime.ts");
const { one, run, digest, checkPassword } =
  await import("../lib/server/core.ts");
const { flushMonitoring } = await import("../lib/server/monitoring.ts");
const { RESET_EXPIRY_MS } = await import("../lib/server/password-reset.ts");
const originalNow = Date.now;
const originalFetch = globalThis.fetch;
const originalError = console.error;
let clock = originalNow(),
  deliveries = [],
  deliveryFailure = false,
  release;
const logs = [];
Date.now = () => clock;
console.error = (entry) => logs.push(entry);
globalThis.fetch = async (url, init) => {
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(init.headers.Authorization, "Bearer fixture-not-a-real-key");
  assert(init.signal);
  const message = JSON.parse(init.body);
  deliveries.push(message);
  if (release === "hold")
    await new Promise((done) => {
      release = done;
    });
  if (deliveryFailure === "throw") throw Error("provider body with secrets");
  return deliveryFailure
    ? Response.json({ error: "fixture" }, { status: 500 })
    : Response.json({ id: crypto.randomUUID() });
};
let checks = 0;
async function call(
  path,
  body,
  { method, ip = "192.0.2.5", headers = {}, cookie = "" } = {},
) {
  const res = await handle(
    new Request("https://app.example.test/api/" + path, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": ip,
        cookie,
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  return {
    res,
    status: res.status,
    json: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
async function expect(path, body, status = 200, options) {
  const result = await call(path, body, options);
  assert.equal(result.status, status, JSON.stringify(result.json));
  checks++;
  return result;
}
const email = "owner@example.test",
  password = "original secure password",
  changed = "replacement secure password";
const ask = (address = email, options) =>
  expect("auth/forgot-password", { email: address }, 200, options);
const link = (message = deliveries.at(-1)) =>
  new URL(message.text.match(/https:\/\/\S+/)[0]);
const redeem = (url, status = 200, override = {}) =>
  expect(
    "auth/signup",
    {
      email: url.searchParams.get("email"),
      invite: url.searchParams.get("invite"),
      password: changed,
      ...override,
    },
    status,
    { ip: "192.0.2.8" },
  );
const advance = () => {
  clock += 3600001;
};

try {
  const original = await expect("auth/signup", {
    email,
    password,
    restaurant: "Corner Kitchen",
  });
  const otherSession = await expect("auth/login", { email, password });
  assert.deepEqual((await expect("auth/recovery")).json, { enabled: true });

  // Missing config is explicit and identical for known/unknown accounts.
  const key = env.RESEND_API_KEY;
  env.RESEND_API_KEY = "";
  assert.deepEqual((await expect("auth/recovery")).json, { enabled: false });
  const unavailable = await expect("auth/forgot-password", { email }, 503);
  const unknownUnavailable = await expect(
    "auth/forgot-password",
    { email: "unknown@example.test" },
    503,
  );
  assert.deepEqual(unavailable.json, unknownUnavailable.json);
  env.RESEND_API_KEY = key;
  assert.equal(deliveries.length, 0);

  // Neither host poisoning nor insecure configuration can leak tokens.
  env.APP_ORIGIN = "http://example.test";
  await expect("auth/forgot-password", { email }, 503);
  env.APP_ORIGIN = "https://menumaterial.example.test";
  await expect("auth/forgot-password", { email }, 403, {
    headers: { origin: "https://attacker.example" },
  });
  await expect("auth/forgot-password", { email: "invalid" }, 400);
  await expect("auth/forgot-password", undefined, 405);
  await expect("auth/forgot-password", { email, website: "spam" });
  await flushMonitoring();
  assert.equal(deliveries.length, 0);

  advance();
  // A held email send cannot delay the acknowledgment or expose existence.
  release = "hold";
  const accepted = await ask(" OWNER@EXAMPLE.TEST ", {
    headers: {
      host: "attacker.example",
      "x-forwarded-host": "attacker.example",
    },
  });
  for (let i = 0; i < 50 && typeof release !== "function"; i++)
    await new Promise(setImmediate);
  assert.equal(typeof release, "function");
  const unknown = await ask("missing@example.test");
  assert.deepEqual(accepted.json, unknown.json);
  assert.equal(accepted.cookie, undefined);
  assert.equal(accepted.res.headers.get("cache-control"), "private, no-store");
  release();
  release = undefined;
  await flushMonitoring();
  assert.equal(deliveries.length, 1);
  assert.deepEqual(deliveries[0].to, [email]);
  const first = link();
  assert.equal(first.origin, "https://menumaterial.example.test");
  assert.equal(first.searchParams.get("reset"), "1");
  assert.equal(first.searchParams.get("email"), email);
  assert.match(deliveries[0].html, /&amp;/);
  const raw = first.searchParams.get("invite");
  const stored = await one("SELECT * FROM invites WHERE hash=?", digest(raw));
  assert.equal(stored.expires_at - stored.created_at, RESET_EXPIRY_MS);
  assert(!JSON.stringify(stored).includes(raw));
  assert.equal(stored.used_by, null);
  assert(!JSON.stringify(accepted.json).includes(raw));
  assert(
    checkPassword(
      password,
      (await one("SELECT password FROM users WHERE email=?", email)).password,
    ),
  );

  // A fresh request leaves an already-delivered link usable, without revoking sessions.
  await ask();
  await flushMonitoring();
  const second = link();
  assert.equal(
    (await one("SELECT used_by FROM invites WHERE hash=?", digest(raw)))
      .used_by,
    null,
  );
  assert(
    (await expect("state", undefined, 200, { cookie: original.cookie })).json
      .user,
  );
  await redeem(first, 403, { email: "someone@example.test" });
  await redeem(first, 400, { password: "short" });
  const reset = await redeem(first);
  assert(reset.cookie);
  assert.equal(
    (await expect("state", undefined, 200, { cookie: original.cookie })).json
      .user,
    null,
  );
  assert.equal(
    (await expect("state", undefined, 200, { cookie: otherSession.cookie }))
      .json.user,
    null,
  );
  await expect("auth/login", { email, password }, 401);
  await expect("auth/login", { email, password: changed });
  await redeem(first, 403);
  await redeem(second, 403);

  // The link is bound to expiry and can only be redeemed once concurrently.
  advance();
  await ask();
  await flushMonitoring();
  const expired = link();
  clock += RESET_EXPIRY_MS + 1;
  await redeem(expired, 403);
  advance();
  await ask();
  await flushMonitoring();
  const race = link();
  const raceResults = await Promise.all(
    [0, 1].map(() =>
      call(
        "auth/signup",
        {
          email,
          password: changed,
          invite: race.searchParams.get("invite"),
        },
        { ip: "192.0.2.9" },
      ),
    ),
  );
  assert.equal(raceResults.filter((r) => r.status === 200).length, 1);
  assert(raceResults.some((r) => [403, 409].includes(r.status)));
  checks++;

  // Failed and thrown provider calls never expose secrets and revoke only their link.
  for (const failure of [true, "throw"]) {
    advance();
    deliveryFailure = failure;
    const result = await ask();
    await flushMonitoring();
    assert.deepEqual(result.json, accepted.json);
    assert.equal(
      await one(
        "SELECT hash FROM invites WHERE hash=?",
        digest(link().searchParams.get("invite")),
      ),
      null,
    );
  }
  assert(!logs.join(" ").includes(email));
  assert(!logs.join(" ").includes("fixture-not-a-real-key"));
  assert(!logs.join(" ").includes("provider body with secrets"));
  assert(!logs.join(" ").includes(raw));
  deliveryFailure = false;

  // Address limits work across networks, also for unknown accounts.
  advance();
  for (const address of [email, "never@example.test"]) {
    for (let i = 0; i < 3; i++)
      await ask(address, { ip: `198.51.100.${i + 1}` });
    await expect("auth/forgot-password", { email: address }, 429, {
      ip: "198.51.100.80",
    });
  }
  await flushMonitoring();
  advance();
  for (let i = 0; i < 10; i++)
    await ask(`n${i}@example.test`, { ip: "203.0.113.90" });
  await expect("auth/forgot-password", { email: "extra@example.test" }, 429, {
    ip: "203.0.113.90",
  });
  await ask("extra@example.test", { ip: "203.0.113.91" });
  await flushMonitoring();
  console.log(
    `PASS: ${checks} password recovery checks, including delivery gating, generic acknowledgments, trusted origin, expiry, session revocation, one-use links, concurrency, provider failures and network/address limits.`,
  );
} finally {
  await flushMonitoring();
  Date.now = originalNow;
  globalThis.fetch = originalFetch;
  console.error = originalError;
  rmSync(root, { recursive: true, force: true });
}
