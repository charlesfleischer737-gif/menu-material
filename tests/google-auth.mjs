import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

const root = mkdtempSync(join(tmpdir(), "menu-material-google-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
const audience = "test-web-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_ID = audience;
process.env.APP_ORIGIN = "https://menumaterial.example.test";
process.env.RESEND_API_KEY = "fixture-only";
process.env.PASSWORD_RESET_FROM = "Menu Material <noreply@example.test>";
process.env.SIGNUPS_PER_NETWORK_PER_DAY = "50";
const { handle } = await import("../lib/server/api.ts");
const { env } = await import("../lib/local-runtime.ts");
const { one, run, checkPassword, deleteAccount } =
  await import("../lib/server/core.ts");
const { flushMonitoring } = await import("../lib/server/monitoring.ts");
const { publicKey, privateKey } = await generateKeyPair("RS256");
const otherKeys = await generateKeyPair("RS256");
const jwk = {
  ...(await exportJWK(publicKey)),
  kid: "fixture-key",
  alg: "RS256",
  use: "sig",
};
const originalFetch = globalThis.fetch;
const deliveries = [];
globalThis.fetch = async (url, options) => {
  if (String(url) === "https://www.googleapis.com/oauth2/v3/certs")
    return Response.json({ keys: [jwk] });
  if (String(url) === "https://api.resend.com/emails") {
    deliveries.push(JSON.parse(options.body));
    return Response.json({ id: "fixture-email" });
  }
  throw Error("Unexpected external request: " + url);
};
const origin = "https://menumaterial.example.test";
let checks = 0,
  request = 0;
async function call(
  path,
  payload,
  { cookie = "", headers = {}, method, ip } = {},
) {
  const res = await handle(
    new Request(origin + "/api/" + path, {
      method: method || (payload === undefined ? "GET" : "POST"),
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        cookie,
        "cf-connecting-ip":
          ip || `198.51.${Math.floor(++request / 250)}.${(request % 250) + 1}`,
        ...headers,
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    }),
  );
  const cookies = res.headers.getSetCookie();
  return {
    res,
    status: res.status,
    json: await res.json(),
    cookie:
      cookies
        .find((c) => c.startsWith("menu_material_session="))
        ?.split(";")[0] || cookies[0]?.split(";")[0],
  };
}
async function expect(path, payload, status = 200, options) {
  const result = await call(path, payload, options);
  assert.equal(result.status, status, JSON.stringify(result.json));
  checks++;
  return result;
}
const password = "a long local password";
async function start() {
  return expect("auth/google/start", {});
}
async function credential(session, claims = {}, signingKey = privateKey) {
  const seconds = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: "https://accounts.google.com",
    aud: audience,
    sub: "new-person",
    email: "new.person@gmail.com",
    email_verified: true,
    nonce: session.json.nonce,
    iat: seconds,
    exp: seconds + 3600,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
    .sign(signingKey);
}
async function verify(session, claims, status = 200, signingKey) {
  return expect(
    "auth/google/credential",
    { credential: await credential(session, claims, signingKey) },
    status,
    { cookie: session.cookie },
  );
}
const complete = (session, input, status = 200, options = {}) =>
  expect("auth/google/complete", input, status, {
    cookie: session.cookie,
    ...options,
  });
async function clearLimits() {
  await run("DELETE FROM rate_limits");
}
try {
  env.GOOGLE_CLIENT_ID = "";
  assert.deepEqual((await expect("auth/google/config")).json, {
    enabled: false,
  });
  await expect("auth/google/start", {}, 503);
  env.GOOGLE_CLIENT_ID = "invalid-client";
  assert.equal((await expect("auth/google/config")).json.enabled, false);
  env.GOOGLE_CLIENT_ID = audience;
  assert.equal((await expect("auth/google/config")).json.enabled, true);
  await expect("auth/google/start", {}, 403, {
    headers: { Origin: "https://attacker.example" },
  });
  await expect("auth/google/start", {}, 403, { headers: { Origin: "" } });
  await expect("auth/google/start", {}, 403, {
    headers: { "Content-Type": "text/plain" },
  });
  await expect("auth/google/start", {}, 403, {
    headers: { "sec-fetch-site": "cross-site" },
  });
  await expect("auth/google/start", undefined, 405);
  await expect("auth/google/complete", {}, 401);

  const first = await start();
  assert.equal(first.json.clientId, audience);
  assert.equal(first.res.headers.get("cache-control"), "private, no-store");
  assert.match(
    first.res.headers.get("set-cookie"),
    /__Host-menu_material_google=.*HttpOnly; SameSite=Lax; Max-Age=600; Secure/,
  );
  const record = await one("SELECT * FROM google_auth_flows");
  assert(!JSON.stringify(record).includes(first.json.nonce));
  assert(!JSON.stringify(record).includes(first.cookie.split("=")[1]));
  await complete(first, { restaurant: "Before proof" }, 401);
  const foreign = await start();
  await expect(
    "auth/google/credential",
    { credential: await credential(first) },
    401,
    { cookie: foreign.cookie },
  );
  for (const claims of [
    { aud: "other-client.apps.googleusercontent.com" },
    { iss: "https://attacker.example" },
    { exp: Math.floor(Date.now() / 1000) - 60 },
    { iat: Math.floor(Date.now() / 1000) - 900 },
    { iat: Math.floor(Date.now() / 1000) + 120 },
    { email_verified: false },
    { email_verified: "true" },
    { nonce: "wrong" },
    { sub: "" },
    { email: "not-an-email" },
    { exp: undefined },
    { nonce: undefined },
  ])
    await verify(first, claims, 401);
  await verify(first, {}, 401, otherKeys.privateKey);
  await expect("auth/google/credential", { credential: "not.a.jwt" }, 401, {
    cookie: first.cookie,
  });
  const checked = await verify(first);
  assert.deepEqual(checked.json, {
    step: "signup",
    email: "new.person@gmail.com",
  });
  assert.equal(checked.cookie, undefined);
  assert.equal(await one("SELECT id FROM users"), null);
  await verify(first, {}, 401);
  await complete(first, { restaurant: "Your restaurant" }, 400);
  const created = await complete(first, {
    restaurant: "Corner House Kitchen",
    timezone: "America/Chicago",
    role: "admin",
    email: "attacker@gmail.com",
  });
  const user = await one(
    "SELECT * FROM users WHERE email='new.person@gmail.com'",
  );
  assert.equal(user.role, "owner");
  assert.equal(checkPassword(password, user.password), false);
  const restaurant = await one(
    "SELECT * FROM restaurants WHERE user_id=?",
    user.id,
  );
  assert.equal(restaurant.name, "Corner House Kitchen");
  assert.equal(restaurant.allowance, 5);
  assert.equal(restaurant.timezone, "America/Chicago");
  assert.equal(
    (
      await one(
        "SELECT user_id FROM google_identities WHERE subject='new-person'",
      )
    ).user_id,
    user.id,
  );
  assert.equal(
    (await expect("state", undefined, 200, { cookie: created.cookie })).json
      .user.id,
    user.id,
  );
  assert(
    created.res.headers.getSetCookie().some((c) => c.includes("Max-Age=0")),
  );
  await complete(first, { restaurant: "Duplicate" }, 401);

  // A stable Google identity keeps its workspace across email changes.
  const returning = await start();
  const signedIn = await verify(returning, { email: "renamed@gmail.com" });
  assert.equal(signedIn.json.ok, true);
  assert.equal(
    (await expect("state", undefined, 200, { cookie: signedIn.cookie })).json
      .user.id,
    user.id,
  );
  assert.equal((await one("SELECT count(*) AS n FROM users")).n, 1);
  assert.equal(
    (await one("SELECT allowance FROM restaurants WHERE id=?", restaurant.id))
      .allowance,
    5,
  );

  const untrusted = await start();
  await verify(untrusted, {
    sub: "external-google",
    email: "thirdparty@example.test",
  });
  await complete(untrusted, { restaurant: "Third Party" }, 403);
  assert.equal(
    await one("SELECT id FROM users WHERE email='thirdparty@example.test'"),
    null,
  );

  // Existing accounts must prove their password; the Google claim alone is insufficient.
  await expect("auth/signup", {
    email: "existing@example.test",
    password,
    restaurant: "Existing Bistro",
  });
  const existing = await one(
    "SELECT * FROM users WHERE email='existing@example.test'",
  );
  await run("UPDATE users SET role='admin' WHERE id=?", existing.id);
  const originalRestaurant = await one(
    "SELECT * FROM restaurants WHERE user_id=?",
    existing.id,
  );
  await run(
    "UPDATE restaurants SET allowance=23 WHERE id=?",
    originalRestaurant.id,
  );
  const linking = await start();
  assert.equal(
    (await verify(linking, { sub: "existing-google", email: existing.email }))
      .json.step,
    "link",
  );
  await complete(linking, {}, 403);
  await complete(linking, { password: "wrong", userId: user.id }, 403);
  assert.equal(
    await one("SELECT * FROM google_identities WHERE user_id=?", existing.id),
    null,
  );
  const linked = await complete(linking, {
    password,
    restaurant: "Unwanted replacement",
    role: "owner",
  });
  assert.equal(
    (await expect("state", undefined, 200, { cookie: linked.cookie })).json.user
      .id,
    existing.id,
  );
  assert.equal(
    (await one("SELECT role FROM users WHERE id=?", existing.id)).role,
    "admin",
  );
  const kept = await one(
    "SELECT * FROM restaurants WHERE user_id=?",
    existing.id,
  );
  assert.equal(kept.id, originalRestaurant.id);
  assert.equal(kept.name, "Existing Bistro");
  assert.equal(kept.allowance, 23);
  await clearLimits();
  await expect("auth/login", { email: existing.email, password });
  const secondIdentity = await start();
  await verify(secondIdentity, {
    sub: "another-google",
    email: existing.email,
  });
  await complete(secondIdentity, { password }, 409);

  // Expiration after token verification and one-use redemption under concurrency.
  const expired = await start();
  await verify(expired, { sub: "expires", email: "expires@gmail.com" });
  await run(
    "UPDATE google_auth_flows SET expires_at=0 WHERE subject='expires'",
  );
  await complete(expired, { restaurant: "Expired Diner" }, 401);
  const race = await start();
  await verify(race, { sub: "race", email: "race@gmail.com" });
  const raced = await Promise.all([
    call(
      "auth/google/complete",
      { restaurant: "Race Bistro" },
      { cookie: race.cookie },
    ),
    call(
      "auth/google/complete",
      { restaurant: "Race Bistro" },
      { cookie: race.cookie },
    ),
  ]);
  assert.deepEqual(raced.map((r) => r.status).sort(), [200, 401]);
  checks++;
  assert.equal(
    (await one("SELECT count(*) AS n FROM users WHERE email='race@gmail.com'"))
      .n,
    1,
  );

  // New-account limits are shared with email registration, not a second allowance.
  env.SIGNUPS_PER_NETWORK_PER_DAY = "0";
  const limited = await start();
  await verify(limited, { sub: "limited", email: "limited@gmail.com" });
  await complete(limited, { restaurant: "Limited Diner" }, 429);
  env.SIGNUPS_PER_NETWORK_PER_DAY = "50";

  // Google-only accounts can add an email password via the existing recovery flow.
  await expect("auth/forgot-password", { email: user.email });
  await flushMonitoring();
  assert.equal(deliveries.length, 1);
  const reset = new URL(deliveries[0].text.match(/https:\/\/\S+/)[0]);
  await expect("auth/signup", {
    email: user.email,
    password,
    invite: reset.searchParams.get("invite"),
  });
  await expect("auth/login", { email: user.email, password });
  assert.equal(
    (
      await one(
        "SELECT user_id FROM google_identities WHERE subject='new-person'",
      )
    ).user_id,
    user.id,
  );
  const afterReset = await start();
  assert.equal((await verify(afterReset)).json.ok, true);

  // Account deletion removes the identity and any pending proof for that email.
  const pending = await start();
  await verify(pending, { sub: "pending-delete", email: user.email });
  await deleteAccount(user, restaurant);
  assert.equal(
    await one("SELECT * FROM google_identities WHERE user_id=?", user.id),
    null,
  );
  assert.equal(
    await one("SELECT * FROM google_auth_flows WHERE email=?", user.email),
    null,
  );
  // Google signup shares email signup's anti-abuse allowance and attribution.
  const repeated = await start();
  await verify(repeated, { sub: "new-person", email: user.email });
  await complete(repeated, {
    restaurant: "Returned Bistro",
    attribution: { utmSource: "launch-test" },
  });
  const repeatedRestaurant = await one(
    "SELECT r.* FROM restaurants r JOIN users u ON u.id=r.user_id WHERE u.email=?",
    user.email,
  );
  assert.equal(repeatedRestaurant.allowance, 0);
  assert.equal(repeatedRestaurant.free_grant, "used");
  assert.equal(JSON.parse((await one("SELECT details FROM events WHERE restaurant_id=? AND kind='signup_source'", repeatedRestaurant.id)).details).utmSource, "launch-test");
  env.FREE_SIGNUP_GRANTS_PER_DAY = "0";
  const held = await start();
  await verify(held, { sub: "held-person", email: "held.person@gmail.com" });
  await complete(held, { restaurant: "Held Bistro" });
  const heldRestaurant = await one(
    "SELECT r.* FROM restaurants r JOIN users u ON u.id=r.user_id WHERE u.email='held.person@gmail.com'",
  );
  assert.equal(heldRestaurant.allowance, 0);
  assert.equal(heldRestaurant.free_grant, "held");
  console.log(
    `Google sign-in: ${checks} route/security checks passed, plus identity, cookie, data preservation, recovery and deletion assertions.`,
  );
} finally {
  globalThis.fetch = originalFetch;
  rmSync(root, { recursive: true, force: true });
}
