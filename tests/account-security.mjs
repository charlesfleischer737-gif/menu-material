import assert from "node:assert/strict";
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

  console.log(
    `PASS: ${checks} account security checks: per-network limits on the IPv6 /64 with no site-wide lockout, and a per-account sign-in slowdown.`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
