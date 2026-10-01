import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "menu-material-verification-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
process.env.APP_ORIGIN = "https://menu.example.test";
process.env.RESEND_API_KEY = "fixture-key";
process.env.PASSWORD_RESET_FROM = "Menu Material <noreply@example.test>";
const { handle } = await import("../lib/server/api.ts");
const { env } = await import("../lib/local-runtime.ts");
const { one, run, digest, deleteAccount } =
  await import("../lib/server/core.ts");
const { enqueue } = await import("../lib/server/generation.ts");
const { grantHeldImages } = await import("../lib/server/free-grants.ts");
const { flushMonitoring } = await import("../lib/server/monitoring.ts");
env.LOCAL_DEVELOPMENT = "false";
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
let clock = originalNow(),
  request = 0,
  fail = false;
const deliveries = [];
Date.now = () => clock;
globalThis.fetch = async (url, init) => {
  assert.equal(String(url), "https://api.resend.com/emails");
  assert.equal(init.headers.Authorization, "Bearer fixture-key");
  deliveries.push(JSON.parse(init.body));
  return fail
    ? Response.json({ error: "fixture" }, { status: 500 })
    : Response.json({ id: "fixture" });
};
const origin = "https://menu.example.test";
const password = "a strong fixture password";
let checks = 0;
async function call(path, payload, cookie = "", status = 200, headers = {}) {
  const res = await handle(
    new Request(origin + "/api/" + path, {
      method: payload === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        origin,
        cookie,
        "cf-connecting-ip": `198.51.${Math.floor(++request / 250)}.${(request % 250) + 1}`,
        ...headers,
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    }),
  );
  const json = await res.json();
  assert.equal(res.status, status, JSON.stringify(json));
  checks++;
  return {
    json,
    cookie: res.headers
      .getSetCookie()
      .find((c) => c.startsWith("menu_material_session="))
      ?.split(";")[0],
  };
}
const signup = async (email) =>
  (
    await call("auth/signup", {
      email,
      password,
      restaurant: "Fixture Kitchen",
      emailVerified: true,
    })
  ).cookie;
const state = async (cookie) => (await call("state", undefined, cookie)).json;
const send = async (cookie) => {
  await call("auth/email-verification/send", {}, cookie);
  return deliveries.at(-1).text.match(/code is (\d{6})/)[1];
};
const confirm = (cookie, code, status = 200) =>
  call("auth/email-verification/confirm", { code }, cookie, status);
const advance = (ms = 3600001) => (clock += ms);

try {
  const cookie = await signup("owner@example.test");
  let s = await state(cookie);
  assert.equal(s.emailVerification.required, true);
  assert.equal(s.remaining, 0);
  assert.equal(s.freeImages.status, "verification");
  const r = await one("SELECT * FROM restaurants WHERE id=?", s.restaurant.id);
  await assert.rejects(
    enqueue(r, {}),
    (e) => e.status === 403 && e.code === "email_verification_required",
  );
  // Even an administrator-added balance cannot bypass ownership verification.
  await run("UPDATE restaurants SET allowance=10 WHERE id=?", r.id);
  await assert.rejects(
    enqueue(r, {}),
    (e) => e.code === "email_verification_required",
  );
  await run("UPDATE restaurants SET allowance=0 WHERE id=?", r.id);
  await grantHeldImages(true);
  assert.equal((await state(cookie)).remaining, 0);
  await call("auth/email-verification/send", {}, "", 401);
  await call("auth/email-verification/send", {}, cookie, 403, {
    origin: "https://attacker.test",
  });
  const code = await send(cookie);
  assert.deepEqual(deliveries.at(-1).to, ["owner@example.test"]);
  assert.equal(deliveries.at(-1).subject, "Verify your Menu Material email");
  const row = await one(
    "SELECT * FROM email_verifications WHERE user_id=?",
    s.user.id,
  );
  assert.equal(row.expires_at - row.created_at, 900000);
  assert(!JSON.stringify(row).includes(code));
  assert.equal(
    (await call("auth/email-verification", undefined, cookie)).json.sent,
    true,
  );
  await call("auth/email-verification/send", {}, cookie, 429);
  const another = (
    await call("auth/login", { email: "owner@example.test", password })
  ).cookie;
  await confirm(another, code, 400);
  await confirm(cookie, code === "000000" ? "111111" : "000000", 400);
  await Promise.all([confirm(cookie, code), confirm(cookie, code)]);
  s = await state(cookie);
  assert.equal(s.emailVerification.required, false);
  assert(s.emailVerification.verifiedAt);
  assert.equal(s.remaining, 5);
  await confirm(cookie, code);
  assert.equal((await state(cookie)).remaining, 5);
  assert.equal(
    await one("SELECT * FROM email_verifications WHERE user_id=?", s.user.id),
    null,
  );

  // A used trial survives deletion; an unverified address does not consume one.
  await deleteAccount(
    await one("SELECT * FROM users WHERE id=?", s.user.id),
    await one("SELECT * FROM restaurants WHERE id=?", r.id),
  );
  advance();
  const again = await signup("owner@example.test");
  await confirm(again, await send(again));
  assert.equal((await state(again)).remaining, 0);
  assert.equal((await state(again)).freeImages.status, "used");
  const abandoned = await signup("abandoned@example.test");
  const abandonedState = await state(abandoned);
  await send(abandoned);
  await deleteAccount(
    await one("SELECT * FROM users WHERE id=?", abandonedState.user.id),
    await one(
      "SELECT * FROM restaurants WHERE id=?",
      abandonedState.restaurant.id,
    ),
  );
  assert.equal(
    await one(
      "SELECT 1 FROM free_grant_emails WHERE hash=?",
      digest("free-grant:abandoned@example.test"),
    ),
    null,
  );
  assert.equal(
    await one(
      "SELECT 1 FROM email_verifications WHERE user_id=?",
      abandonedState.user.id,
    ),
    null,
  );

  // An unverified signup cannot use delayed grants or consume the daily pool.
  advance();
  env.FREE_SIGNUP_GRANTS_PER_DAY = "0";
  const held = await signup("held@example.test");
  await confirm(held, await send(held));
  assert.equal((await state(held)).freeImages.status, "held");
  const pending = await signup("pending@example.test");
  env.FREE_SIGNUP_GRANTS_PER_DAY = "300";
  advance();
  await grantHeldImages();
  assert.equal((await state(held)).remaining, 5);
  assert.equal((await state(pending)).remaining, 0);

  const pendingState = await state(pending);
  await run(
    "UPDATE users SET email_verification_required=0,email_verified_at=? WHERE id=?",
    clock,
    pendingState.user.id,
  );
  assert.equal(
    (await state(pending)).remaining,
    5,
    "State recovers an interrupted post-verification grant",
  );

  const expired = await signup("expired@example.test");
  const expiredCode = await send(expired);
  advance(900001);
  await confirm(expired, expiredCode, 400);
  advance();
  const oldCode = await send(expired);
  advance(60001);
  const newCode = await send(expired);
  if (oldCode !== newCode) await confirm(expired, oldCode, 400);
  await confirm(expired, newCode);

  advance();
  const guesses = await signup("guesses@example.test");
  const correct = await send(guesses);
  const wrong = correct === "123456" ? "654321" : "123456";
  await Promise.all(
    Array.from({ length: 8 }, () => confirm(guesses, wrong, 400)),
  );
  await confirm(guesses, correct, 400);
  assert.equal((await state(guesses)).remaining, 0);

  advance();
  const changed = await signup("typo@example.test");
  const stale = await send(changed);
  await call(
    "auth/email-verification/change-email",
    { email: "owner@example.test" },
    changed,
    409,
  );
  await call(
    "auth/email-verification/change-email",
    { email: " corrected@example.test " },
    changed,
  );
  await confirm(changed, stale, 400);
  advance(60001);
  const corrected = await send(changed);
  assert.deepEqual(deliveries.at(-1).to, ["corrected@example.test"]);
  await confirm(changed, corrected);
  assert.equal((await state(changed)).user.email, "corrected@example.test");
  await call(
    "auth/email-verification/change-email",
    { email: "another@example.test" },
    changed,
  );
  assert.equal((await state(changed)).user.email, "corrected@example.test");

  advance();
  const failure = await signup("failure@example.test");
  env.RESEND_API_KEY = "";
  await call("auth/email-verification/send", {}, failure, 503);
  env.RESEND_API_KEY = "fixture-key";
  fail = true;
  await call("auth/email-verification/send", {}, failure, 503);
  const failedState = await state(failure);
  assert.equal(
    await one(
      "SELECT 1 FROM email_verifications WHERE user_id=?",
      failedState.user.id,
    ),
    null,
  );
  assert.equal(failedState.remaining, 0);
  fail = false;
  advance();
  await confirm(failure, await send(failure));

  // Migration defaults preserve old accounts and do not falsely mark them verified.
  env.LOCAL_DEVELOPMENT = "true";
  const legacy = await signup("legacy@example.test");
  env.LOCAL_DEVELOPMENT = "false";
  const legacyState = await state(legacy);
  assert.equal(legacyState.emailVerification.required, false);
  assert.equal(legacyState.emailVerification.verifiedAt, null);
  assert.equal(legacyState.remaining, 5);

  // The guest photo handoff waits until verification; the draft remains mounted.
  const guestSource = readFileSync("app/components/guest-studio.tsx", "utf8");
  assert.match(
    guestSource,
    /!state.user \|\|\s+state.emailVerification\?\.required/,
  );
  const ui = readFileSync("app/components/email-verification.tsx", "utf8");
  assert.match(ui, /autoComplete="one-time-code"/);
  assert.match(ui, /Change email/);
  console.log(
    `PASS: ${checks} email verification API checks, with server generation enforcement, code expiry, session binding, concurrent attempts, exactly-once credits, delayed grants, deletion/recreation, email corrections, delivery failures, and existing-account preservation. Email delivery is mocked.`,
  );
} finally {
  await flushMonitoring();
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
  rmSync(root, { recursive: true, force: true });
}
