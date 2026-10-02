// The iPhone app's server side: native sessions, the version gate, Sign in
// with Apple, Google from the app, App Store subscriptions, push
// notifications and the runner's APNs client. Apple, Google and APNs are
// local fixtures; nothing here reaches a real service.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http2";
import { createHash } from "node:crypto";
import {
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
  SignJWT,
} from "jose";

const root = mkdtempSync(join(tmpdir(), "menu-material-native-"));
const origin = "https://menumaterial.example.test";
const bundleId = "com.menumaterial.app";
const productId = "com.menumaterial.app.pro.monthly";
const signInKey = await generateKeyPair("ES256", { extractable: true });
const storeKey = await generateKeyPair("ES256", { extractable: true });
const apnsKey = await generateKeyPair("ES256", { extractable: true });
Object.assign(process.env, {
  MENU_MATERIAL_DATA_DIR: root,
  APP_ORIGIN: origin,
  SIGNUPS_PER_NETWORK_PER_DAY: "50",
  JOB_RUNNER_SECRET: "fixture-runner-secret",
  APPLE_BUNDLE_ID: bundleId,
  APPLE_TEAM_ID: "TEAM123456",
  APPLE_SIGN_IN_KEY_ID: "SIWAKEY001",
  // Written on one line, as hosting settings often store it.
  APPLE_SIGN_IN_PRIVATE_KEY: (await exportPKCS8(signInKey.privateKey))
    .trim()
    .replace(/\n/g, "\\n"),
  APP_STORE_ISSUER_ID: "fixture-issuer",
  APP_STORE_KEY_ID: "STOREKEY01",
  APP_STORE_PRIVATE_KEY: await exportPKCS8(storeKey.privateKey),
  GOOGLE_CLIENT_ID: "fixture-web.apps.googleusercontent.com",
  GOOGLE_IOS_CLIENT_ID: "fixture-ios.apps.googleusercontent.com",
});
const { handle } = await import("../lib/server/api.ts");
const { env } = await import("../lib/local-runtime.ts");
const { one, all, run, id } = await import("../lib/server/core.ts");
const { updateJob } = await import("../lib/server/generation.ts");
const { reconcileDueAppStoreSubscriptions } =
  await import("../lib/server/app-store.ts");
const { compareVersions } = await import("../lib/server/native.ts");
const { flushMonitoring } = await import("../lib/server/monitoring.ts");
const { apnsSettings, createApnsClient, providerToken } =
  await import("../scripts/apns.mjs");

// Apple's and Google's identity token keys.
const appleIdKeys = await generateKeyPair("RS256");
const googleKeys = await generateKeyPair("RS256");
const jwk = async (key, kid) => ({
  ...(await exportJWK(key)),
  kid,
  alg: "RS256",
  use: "sig",
});
const appleJwk = await jwk(appleIdKeys.publicKey, "apple-fixture");
const googleJwk = await jwk(googleKeys.publicKey, "google-fixture");

// The App Store's view of each subscription, by any of its transaction IDs.
const store = new Map();
const storeCalls = [];
const appleCalls = [];
const jws = (payload) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256", x5c: ["fixture"] })
    .sign(storeKey.privateKey);
function subscribe({
  original,
  transaction = original,
  token,
  purchase = Date.now() - 60000,
  expires = Date.now() + 30 * 86400000,
  status = 1,
  autoRenew = 1,
  price = 9000,
  environment = "Production",
  revocationDate,
  offerDiscountType,
  product = productId,
}) {
  const entry = {
    environment,
    status,
    tx: {
      transactionId: transaction,
      originalTransactionId: original,
      bundleId,
      productId: product,
      purchaseDate: purchase,
      expiresDate: expires,
      type: "Auto-Renewable Subscription",
      inAppOwnershipType: "PURCHASED",
      price,
      currency: "USD",
      environment,
      ...(token ? { appAccountToken: token } : {}),
      ...(revocationDate ? { revocationDate } : {}),
      ...(offerDiscountType ? { offerDiscountType } : {}),
    },
    renewal: { autoRenewStatus: autoRenew, originalTransactionId: original },
  };
  store.set(original, entry);
  store.set(transaction, entry);
  return entry;
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const href = String(url);
  if (href === "https://appleid.apple.com/auth/keys")
    return Response.json({ keys: [appleJwk] });
  if (href === "https://www.googleapis.com/oauth2/v3/certs")
    return Response.json({ keys: [googleJwk] });
  if (
    href === "https://appleid.apple.com/auth/token" ||
    href === "https://appleid.apple.com/auth/revoke"
  ) {
    const form = new URLSearchParams(String(options.body));
    // The client secret is signed with the Sign in with Apple key.
    const { payload, protectedHeader } = await jwtVerify(
      form.get("client_secret"),
      signInKey.publicKey,
      { issuer: "TEAM123456", audience: "https://appleid.apple.com" },
    );
    assert.equal(payload.sub, bundleId);
    assert.equal(protectedHeader.kid, "SIWAKEY001");
    assert.equal(form.get("client_id"), bundleId);
    appleCalls.push({ path: new URL(href).pathname, form });
    if (href.endsWith("/token")) {
      if (form.get("code") === "bad-code")
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      return Response.json({ refresh_token: "refresh-" + form.get("code") });
    }
    return new Response(null, { status: 200 });
  }
  const storeMatch = href.match(
    /^https:\/\/api\.storekit(-sandbox)?\.itunes\.apple\.com\/inApps\/v1\/subscriptions\/(\d+)$/,
  );
  if (storeMatch) {
    const environment = storeMatch[1] ? "Sandbox" : "Production";
    const { payload } = await jwtVerify(
      options.headers.Authorization.replace("Bearer ", ""),
      storeKey.publicKey,
      { issuer: "fixture-issuer", audience: "appstoreconnect-v1" },
    );
    assert.equal(payload.bid, bundleId);
    storeCalls.push({ environment, transactionId: storeMatch[2] });
    const entry = store.get(storeMatch[2]);
    if (!entry || entry.environment !== environment)
      return Response.json({ errorCode: 4040010 }, { status: 404 });
    return Response.json({
      environment,
      bundleId,
      data: [
        {
          subscriptionGroupIdentifier: "pro",
          lastTransactions: [
            {
              originalTransactionId: entry.tx.originalTransactionId,
              status: entry.status,
              signedTransactionInfo: await jws(entry.tx),
              signedRenewalInfo: await jws(entry.renewal),
            },
          ],
        },
      ],
    });
  }
  throw Error("Unexpected external request: " + href);
};

let checks = 0,
  request = 0;
async function call(
  path,
  payload,
  { token, headers = {}, method, native = true, version = "1.0.0", ip } = {},
) {
  const res = await handle(
    new Request(origin + "/api/" + path, {
      method: method || (payload === undefined ? "GET" : "POST"),
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip":
          ip || `203.0.${Math.floor(++request / 250)}.${(request % 250) + 1}`,
        ...(native
          ? {
              "X-Menu-Material-Client": "ios",
              ...(version ? { "X-Menu-Material-Version": version } : {}),
            }
          : { Origin: origin }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    }),
  );
  return {
    res,
    status: res.status,
    json: res.status === 204 ? null : await res.json(),
    cookies: res.headers.getSetCookie(),
  };
}
async function expect(path, payload, status = 200, options) {
  const result = await call(path, payload, options);
  assert.equal(
    result.status,
    status,
    `${path}: ${JSON.stringify(result.json)}`,
  );
  checks++;
  return result;
}
const runner = (path, payload) =>
  expect(`internal/push/${path}`, payload ?? {}, 200, {
    native: false,
    headers: { Authorization: "Bearer fixture-runner-secret", Origin: "" },
  });

async function appleToken(nonce, claims = {}, key = appleIdKeys.privateKey) {
  const seconds = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: "https://appleid.apple.com",
    aud: bundleId,
    sub: "apple-person",
    email: "owner@privaterelay.appleid.com",
    email_verified: "true",
    is_private_email: "true",
    nonce: createHashHex(nonce),
    nonce_supported: true,
    iat: seconds,
    exp: seconds + 600,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "apple-fixture" })
    .sign(key);
}
const createHashHex = (value) =>
  createHash("sha256").update(value).digest("hex");
async function appleStart() {
  const started = await expect("auth/apple/start", {});
  return {
    nonce: started.json.nonce,
    headers: { "X-Menu-Material-Auth-Flow": started.json.flow },
  };
}

try {
  // ── Versions and the gate ─────────────────────────────────────────────
  assert.equal(compareVersions("1.10", "1.9"), 1);
  assert.equal(compareVersions("1.2", "1.2.0"), 0);
  assert.equal(compareVersions("1.1.9", "1.2"), -1);
  const config = await expect("native/config");
  assert.equal(config.json.signIn.apple, true);
  assert.equal(
    config.json.signIn.google,
    "fixture-ios.apps.googleusercontent.com",
  );
  assert.equal(config.json.billing.appStore, true);
  assert.equal(config.json.billing.productId, productId);
  assert.equal(config.json.billing.imagesPerPeriod, 50);
  assert.equal(config.json.links.privacy, origin + "/privacy");
  env.IOS_MIN_VERSION = "1.1";
  const old = await expect("state", undefined, 426);
  assert.equal(old.json.code, "update_required");
  await expect("state", undefined, 426, { version: "" });
  await expect("state", undefined, 200, { version: "1.1" });
  await expect("state", undefined, 200, { version: "2.0.3" });
  // The app can still learn what to ask for, and browsers never see it.
  assert.equal(
    (await expect("native/config", undefined, 200, { version: "1.0" })).json
      .minimumVersion,
    "1.1",
  );
  await expect("state", undefined, 200, { native: false });
  // The Studio's looks come from the web's own catalog.
  const styles = (
    await expect("native/styles", undefined, 200, { version: "1.0" })
  ).json;
  assert.equal(styles.polish.id, "keep");
  assert.equal(styles.polish.plate, "keep");
  assert.equal(styles.polish.photoPreset, "");
  assert.match(styles.polish.photoStyle, /^Retain the original setting/);
  assert.equal(styles.styles.length, 62);
  assert.equal(styles.categories.length, 9);
  const overhead = styles.styles.find((s) => s.id === "menu-overhead");
  assert.match(overhead.photoStyle, /Preserve the original angle in this/);
  assert.doesNotMatch(overhead.photoStyle, /Straight overhead/);
  assert.equal(overhead.photoPreset, "menu-overhead");
  assert.deepEqual(
    styles.styles
      .filter((s) => s.pro)
      .map((s) => s.id)
      .sort(),
    ["fantasy-burst", "fantasy-melt", "fantasy-swirl"],
  );
  for (const look of styles.styles) {
    assert.ok(look.photoStyle.length > 0 && look.photoStyle.length <= 300);
    assert.equal(
      look.thumbnail,
      look.image.replace("/studio/styles/", "/studio/styles/thumbs/"),
    );
    assert.ok(["keep", "style"].includes(look.plate));
  }
  env.IOS_MIN_VERSION = "";

  // ── Native sessions ────────────────────────────────────────────────────
  const password = "a long native password";
  const signup = await expect("auth/signup", {
    email: "native@example.test",
    password,
    restaurant: "Native Bistro",
  });
  // Tokens arrive in the body for the Keychain; no cookies.
  assert.match(signup.json.token, /^[\w-]{43}$/);
  assert.match(signup.json.deviceToken, /^[\w-]{43}$/);
  assert.deepEqual(signup.cookies, []);
  const nativeToken = signup.json.token;
  const state = await expect("state", undefined, 200, { token: nativeToken });
  assert.equal(state.json.user.email, "native@example.test");
  assert.deepEqual(state.json.signIn, {
    password: true,
    google: false,
    apple: false,
  });
  const nativeRestaurant = state.json.restaurant.id;
  // The app's token only works from the app, and a browser's cookie session
  // can't be presented as one.
  assert.equal(
    (
      await expect("state", undefined, 200, {
        token: nativeToken,
        native: false,
      })
    ).json.user,
    null,
  );
  const web = await expect(
    "auth/login",
    { email: "native@example.test", password },
    200,
    { native: false },
  );
  const webCookie = web.cookies.find((c) =>
    c.startsWith("menu_material_session="),
  );
  assert.ok(webCookie);
  const webToken = webCookie.split(";")[0].split("=")[1];
  assert.equal(
    (await expect("state", undefined, 200, { token: webToken })).json.user,
    null,
  );
  assert.equal(
    (
      await expect("state", undefined, 200, {
        native: false,
        headers: { cookie: `menu_material_session=${nativeToken}` },
      })
    ).json.user,
    null,
  );
  // App sessions last 90 days and renew themselves while used.
  const stored = await one(
    "SELECT expires_at,client FROM sessions WHERE client='ios' ORDER BY expires_at DESC LIMIT 1",
  );
  assert.equal(stored.client, "ios");
  assert.ok(stored.expires_at > Date.now() + 89 * 86400000);
  await run(
    "UPDATE sessions SET expires_at=? WHERE client='ios'",
    Date.now() + 3 * 86400000,
  );
  await expect("state", undefined, 200, { token: nativeToken });
  assert.ok(
    (await one("SELECT expires_at FROM sessions WHERE client='ios'"))
      .expires_at >
      Date.now() + 89 * 86400000,
  );
  // A later sign-in from the app presents its device token.
  const again = await expect(
    "auth/login",
    { email: "native@example.test", password },
    200,
    { headers: { "X-Menu-Material-Device": signup.json.deviceToken } },
  );
  assert.notEqual(again.json.deviceToken, signup.json.deviceToken);
  await expect("auth/logout", {}, 200, { token: again.json.token });
  assert.equal(
    (await expect("state", undefined, 200, { token: again.json.token })).json
      .user,
    null,
  );
  checks += 12;

  // ── Sign in with Apple ─────────────────────────────────────────────────
  await expect("auth/apple/start", {}, 403, { native: false });
  await expect("auth/apple/start", {}, 403, { headers: { Origin: origin } });
  await expect("auth/apple/start", {}, 403, {
    headers: { "Content-Type": "text/plain" },
  });
  await expect("auth/apple/credential", { identityToken: "x" }, 401);
  let flow = await appleStart();
  // Wrong nonce, wrong audience, wrong signer.
  await expect(
    "auth/apple/credential",
    { identityToken: await appleToken("another nonce") },
    401,
    { headers: flow.headers },
  );
  await expect(
    "auth/apple/credential",
    { identityToken: await appleToken(flow.nonce, { aud: "com.other.app" }) },
    401,
    { headers: flow.headers },
  );
  await expect(
    "auth/apple/credential",
    {
      identityToken: await appleToken(flow.nonce, {}, googleKeys.privateKey),
    },
    401,
    { headers: flow.headers },
  );
  // A new person: Apple's relay address, verified by Apple.
  const credential = await expect(
    "auth/apple/credential",
    {
      identityToken: await appleToken(flow.nonce),
      authorizationCode: "first-code",
    },
    200,
    { headers: flow.headers },
  );
  assert.deepEqual(credential.json, {
    step: "signup",
    email: "owner@privaterelay.appleid.com",
  });
  // The flow is checked once.
  await expect(
    "auth/apple/credential",
    { identityToken: await appleToken(flow.nonce) },
    401,
    { headers: flow.headers },
  );
  await expect("auth/apple/complete", { restaurant: "x" }, 400, {
    headers: flow.headers,
  });
  const created = await expect(
    "auth/apple/complete",
    { restaurant: "Harbor Kitchen", timezone: "Europe/Paris" },
    200,
    { headers: flow.headers },
  );
  assert.match(created.json.token, /^[\w-]{43}$/);
  await expect("auth/apple/complete", { restaurant: "Harbor Kitchen" }, 401, {
    headers: flow.headers,
  });
  const appleState = await expect("state", undefined, 200, {
    token: created.json.token,
  });
  assert.equal(appleState.json.restaurant.name, "Harbor Kitchen");
  assert.equal(appleState.json.restaurant.timezone, "Europe/Paris");
  assert.equal(appleState.json.remaining, 5);
  assert.equal(appleState.json.emailVerification.required, false);
  assert.deepEqual(appleState.json.signIn, {
    password: false,
    google: false,
    apple: true,
  });
  assert.equal(
    (await one("SELECT refresh_token FROM apple_identities")).refresh_token,
    "refresh-first-code",
  );
  // Signing in again goes straight in, even when the code exchange fails.
  flow = await appleStart();
  const back = await expect(
    "auth/apple/credential",
    {
      identityToken: await appleToken(flow.nonce),
      authorizationCode: "bad-code",
    },
    200,
    { headers: flow.headers },
  );
  assert.match(back.json.token, /^[\w-]{43}$/);
  assert.equal(
    (await one("SELECT refresh_token FROM apple_identities")).refresh_token,
    "refresh-first-code",
  );
  // A matching email with a password account needs that password to link.
  flow = await appleStart();
  const link = await expect(
    "auth/apple/credential",
    {
      identityToken: await appleToken(flow.nonce, {
        sub: "apple-native-owner",
        email: "native@example.test",
        is_private_email: "false",
      }),
    },
    200,
    { headers: flow.headers },
  );
  assert.equal(link.json.step, "link");
  await expect("auth/apple/complete", { password: "wrong password!" }, 403, {
    headers: flow.headers,
  });
  const linked = await expect("auth/apple/complete", { password }, 200, {
    headers: flow.headers,
  });
  assert.equal(
    (await expect("state", undefined, 200, { token: linked.json.token })).json
      .restaurant.id,
    nativeRestaurant,
  );
  // An unverified or missing email can't open a new account.
  flow = await appleStart();
  await expect(
    "auth/apple/credential",
    {
      identityToken: await appleToken(flow.nonce, {
        sub: "apple-no-email",
        email: undefined,
        email_verified: undefined,
      }),
    },
    403,
    { headers: flow.headers },
  );
  env.APPLE_BUNDLE_ID = "";
  await expect("auth/apple/start", {}, 503);
  assert.equal((await expect("native/config")).json.signIn.apple, false);
  env.APPLE_BUNDLE_ID = bundleId;
  checks += 8;

  // ── Google from the app ────────────────────────────────────────────────
  const googleStart = await expect("auth/google/start", {});
  assert.equal(
    googleStart.json.clientId,
    "fixture-ios.apps.googleusercontent.com",
  );
  assert.match(googleStart.json.flow, /^[\w-]{43}$/);
  const seconds = Math.floor(Date.now() / 1000);
  const googleCredential = await new SignJWT({
    iss: "https://accounts.google.com",
    aud: "fixture-ios.apps.googleusercontent.com",
    sub: "google-native",
    email: "cook@gmail.com",
    email_verified: true,
    nonce: googleStart.json.nonce,
    iat: seconds,
    exp: seconds + 600,
  })
    .setProtectedHeader({ alg: "RS256", kid: "google-fixture" })
    .sign(googleKeys.privateKey);
  const googleHeaders = { "X-Menu-Material-Auth-Flow": googleStart.json.flow };
  assert.equal(
    (
      await expect(
        "auth/google/credential",
        { credential: googleCredential },
        200,
        { headers: googleHeaders },
      )
    ).json.step,
    "signup",
  );
  const googleAccount = await expect(
    "auth/google/complete",
    { restaurant: "Cook’s Corner" },
    200,
    { headers: googleHeaders },
  );
  assert.match(googleAccount.json.token, /^[\w-]{43}$/);
  assert.deepEqual(googleAccount.cookies, []);
  // The web flow still needs its own page's Origin.
  await expect("auth/google/start", {}, 403, {
    native: false,
    headers: { Origin: "https://attacker.example" },
  });
  checks += 3;

  // ── App Store subscriptions ────────────────────────────────────────────
  const appleOwner = created.json.token;
  const harbor = appleState.json.restaurant.id;
  const plans = await expect("billing/app-store", undefined, 200, {
    token: appleOwner,
  });
  assert.equal(plans.json.appAccountToken, harbor);
  assert.equal(plans.json.canPurchase, true);
  assert.equal(plans.json.subscription, null);
  assert.equal(plans.json.billing.plan, "free");
  // A purchase made for another restaurant can't be claimed here.
  subscribe({ original: "1000", token: nativeRestaurant.toUpperCase() });
  await expect("billing/app-store/verify", { transactionId: "1000" }, 409, {
    token: appleOwner,
  });
  await expect(
    "billing/app-store/verify",
    { transactionId: "not-a-number" },
    400,
    {
      token: appleOwner,
    },
  );
  await expect("billing/app-store/verify", { transactionId: "424242" }, 404, {
    token: appleOwner,
  });
  // Bought in TestFlight's sandbox, with Swift's capital UUID.
  subscribe({
    original: "2000",
    token: harbor.toUpperCase(),
    environment: "Sandbox",
  });
  const bought = await expect(
    "billing/app-store/verify",
    { transactionId: "2000" },
    200,
    { token: appleOwner },
  );
  assert.equal(bought.json.billing.plan, "pro");
  assert.equal(bought.json.billing.remaining, 50);
  assert.equal(bought.json.billing.provider, "app_store");
  assert.equal(bought.json.billing.canManage, false);
  assert.equal(bought.json.billing.features.pro, true);
  assert.equal(bought.json.subscription.environment, "Sandbox");
  assert.equal(bought.json.canPurchase, false);
  assert.deepEqual(
    storeCalls.slice(-2).map((c) => c.environment),
    ["Production", "Sandbox"],
  );
  // Verifying again, or a notification, never refills the month.
  await expect("billing/app-store/verify", { transactionId: "2000" }, 200, {
    token: appleOwner,
  });
  const notify = async (transaction, bundle = bundleId) =>
    expect(
      "billing/app-store/notifications",
      {
        signedPayload: await jws({
          notificationType: "DID_RENEW",
          data: {
            bundleId: bundle,
            signedTransactionInfo: await jws({ transactionId: transaction }),
          },
        }),
      },
      200,
      { native: false, headers: { Origin: "" } },
    );
  await notify("2000");
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM billing_periods WHERE restaurant_id=?",
        harbor,
      )
    ).n,
    1,
  );
  // Another app's notification is ignored.
  const callsBefore = storeCalls.length;
  await notify("2000", "com.other.app");
  assert.equal(storeCalls.length, callsBefore);
  // A renewal arrives by notification: a new paid month, 50 new images.
  await run(
    "UPDATE billing_periods SET starts_at=?,ends_at=? WHERE restaurant_id=?",
    Date.now() - 31 * 86400000,
    Date.now() - 86400000,
    harbor,
  );
  subscribe({
    original: "2000",
    transaction: "2001",
    token: harbor,
    environment: "Sandbox",
  });
  await notify("2001");
  let summary = (
    await expect("billing/status", undefined, 200, { token: appleOwner })
  ).json;
  assert.equal(summary.plan, "pro");
  assert.equal(summary.remaining, 50);
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM billing_periods WHERE restaurant_id=?",
        harbor,
      )
    ).n,
    2,
  );
  // The web can't start a second, Stripe subscription.
  Object.assign(env, {
    STRIPE_BILLING_ENABLED: "true",
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    STRIPE_PRO_PRICE_ID: "price_fixture",
  });
  const checkout = await expect("billing/checkout", {}, 409, {
    token: appleOwner,
  });
  assert.match(checkout.json.error, /App Store/);
  env.STRIPE_BILLING_ENABLED = "false";
  // Deleting the account waits until it no longer renews.
  const blocked = await expect(
    "account/delete",
    { confirm: "DELETE", email: "owner@privaterelay.appleid.com" },
    409,
    { token: appleOwner },
  );
  assert.match(blocked.json.error, /Subscriptions/);
  // The reconciliation net: an ended month is checked with Apple.
  subscribe({
    original: "2000",
    transaction: "2001",
    token: harbor,
    environment: "Sandbox",
    status: 3,
    purchase: Date.now() - 31 * 86400000,
    expires: Date.now() - 60000,
  });
  await run(
    "UPDATE app_store_subscriptions SET synced_at=0,expires_at=? WHERE restaurant_id=?",
    Date.now() - 60000,
    harbor,
  );
  await run(
    "UPDATE billing_periods SET starts_at=?,ends_at=? WHERE invoice_id='apple:2001'",
    Date.now() - 31 * 86400000,
    Date.now() - 60000,
  );
  assert.equal((await reconcileDueAppStoreSubscriptions()).checked, 1);
  assert.equal((await reconcileDueAppStoreSubscriptions()).checked, 0);
  summary = (
    await expect("billing/status", undefined, 200, { token: appleOwner })
  ).json;
  assert.equal(summary.status, "past_due");
  // Billing retry keeps Pro features, but no new images.
  assert.equal(summary.features.source, "grace");
  assert.equal(summary.plan, "free");
  // A refund ends it.
  subscribe({
    original: "2000",
    transaction: "2001",
    token: harbor,
    environment: "Sandbox",
    status: 5,
    autoRenew: 0,
    revocationDate: Date.now() - 1000,
  });
  await notify("2001");
  summary = (
    await expect("billing/status", undefined, 200, { token: appleOwner })
  ).json;
  assert.equal(summary.features.pro, false);
  assert.equal(summary.provider, null);
  // A free trial grants no images.
  subscribe({
    original: "3000",
    token: nativeRestaurant,
    price: 0,
    offerDiscountType: "FREE_TRIAL",
  });
  const trial = await expect(
    "billing/app-store/verify",
    { transactionId: "3000" },
    200,
    {
      token: nativeToken,
    },
  );
  assert.equal(trial.json.billing.plan, "free");
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM billing_periods WHERE restaurant_id=?",
        nativeRestaurant,
      )
    ).n,
    0,
  );
  // A Stripe subscriber can't also buy in the app, and Plans says where
  // their Pro is billed.
  await run(
    "UPDATE app_store_subscriptions SET status='expired' WHERE restaurant_id=?",
    nativeRestaurant,
  );
  await run(
    "INSERT INTO billing_accounts (restaurant_id,customer_id,subscription_id,status) VALUES (?,?,?,?)",
    nativeRestaurant,
    "cus_fixture",
    "sub_fixture",
    "active",
  );
  const stripeOwner = await expect("billing/app-store", undefined, 200, {
    token: nativeToken,
  });
  assert.equal(stripeOwner.json.canPurchase, false);
  assert.match(stripeOwner.json.blockedReason, /menumaterial\.com/);
  assert.equal(stripeOwner.json.billing.provider, "stripe");
  await run(
    "DELETE FROM billing_accounts WHERE restaurant_id=?",
    nativeRestaurant,
  );
  await run(
    "UPDATE app_store_subscriptions SET status='active' WHERE restaurant_id=?",
    nativeRestaurant,
  );
  // Without the App Store settings, buying in the app is off.
  const issuer = env.APP_STORE_ISSUER_ID;
  env.APP_STORE_ISSUER_ID = "";
  await expect("billing/app-store/verify", { transactionId: "3000" }, 503, {
    token: nativeToken,
  });
  assert.equal(
    (await expect("billing/app-store", undefined, 200, { token: nativeToken }))
      .json.canPurchase,
    false,
  );
  env.APP_STORE_ISSUER_ID = issuer;
  checks += 14;

  // ── Push notifications ─────────────────────────────────────────────────
  const deviceToken = "ab".repeat(32);
  await expect("devices", { token: deviceToken }, 404, {
    native: false,
    headers: { cookie: webCookie.split(";")[0] },
  });
  await expect("devices", { token: "not hex" }, 400, { token: nativeToken });
  await expect("devices", { token: deviceToken.toUpperCase() }, 200, {
    token: nativeToken,
  });
  const dishId = id(),
    jobId = id();
  await run(
    "INSERT INTO dishes (id,restaurant_id,name,description,created_at) VALUES (?,?,?,?,?)",
    dishId,
    nativeRestaurant,
    "Fish tacos",
    "",
    Date.now(),
  );
  await run(
    "INSERT INTO jobs (id,restaurant_id,dish_id,request_key,fingerprint,prompt,details,input_method,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    jobId,
    nativeRestaurant,
    dishId,
    id(),
    id(),
    "",
    "{}",
    "photo",
    "processing",
    Date.now(),
  );
  await run(
    "INSERT INTO outputs (id,job_id,restaurant_id,slot,status,created_at) VALUES (?,?,?,?,?,?)",
    id(),
    jobId,
    nativeRestaurant,
    0,
    "processing",
    Date.now(),
  );
  const activityToken = "cd".repeat(40);
  await expect(
    "devices/live-activity",
    { jobId, token: activityToken, environment: "sandbox" },
    200,
    { token: nativeToken },
  );
  await expect(
    "devices/live-activity",
    { jobId: id(), token: activityToken },
    404,
    { token: nativeToken },
  );
  // Still rendering: nothing to say yet.
  await updateJob(jobId);
  assert.deepEqual((await runner("claim")).json.messages, []);
  await run("UPDATE outputs SET status='completed' WHERE job_id=?", jobId);
  await updateJob(jobId);
  await updateJob(jobId);
  const { messages } = (await runner("claim")).json;
  assert.equal(messages.length, 2);
  const alert = messages.find((m) => m.pushType === "alert");
  const activity = messages.find((m) => m.pushType === "liveactivity");
  assert.equal(alert.token, deviceToken);
  assert.equal(alert.topic, bundleId);
  assert.equal(alert.collapseId, jobId);
  assert.equal(alert.payload.aps.alert.title, "Your photo is ready");
  assert.equal(alert.payload.aps.alert.body, "Fish tacos is ready to review.");
  assert.equal(alert.payload.jobId, jobId);
  assert.equal(activity.topic, bundleId + ".push-type.liveactivity");
  assert.equal(activity.environment, "sandbox");
  assert.equal(activity.payload.aps.event, "end");
  assert.equal(activity.payload.aps["content-state"].phase, "ready");
  // Leased: a second claim doesn't hand them out again.
  assert.deepEqual((await runner("claim")).json.messages, []);
  await runner("ack", {
    results: [
      { id: alert.id, status: 200 },
      { id: activity.id, status: 410, reason: "Unregistered" },
    ],
  });
  assert.equal((await one("SELECT count(*) AS n FROM live_activities")).n, 0);
  assert.equal(
    (await one("SELECT count(*) AS n FROM push_outbox WHERE sent_at IS NULL"))
      .n,
    0,
  );
  // Settling again announces nothing new.
  await updateJob(jobId);
  await run("UPDATE push_outbox SET lease_until=0");
  assert.deepEqual((await runner("claim")).json.messages, []);
  // A failed retry is a new outcome; a refused token is forgotten, and a
  // network failure is tried again.
  await run("UPDATE outputs SET status='failed' WHERE job_id=?", jobId);
  await updateJob(jobId);
  const failed = (await runner("claim")).json.messages;
  assert.equal(failed.length, 1);
  assert.equal(
    failed[0].payload.aps.alert.title,
    "Your photo couldn’t be made",
  );
  await runner("ack", { results: [{ id: failed[0].id, status: 0 }] });
  await run("UPDATE push_outbox SET lease_until=0");
  const retried = (await runner("claim")).json.messages;
  assert.equal(retried.length, 1);
  await runner("ack", {
    results: [{ id: retried[0].id, status: 400, reason: "BadDeviceToken" }],
  });
  assert.equal((await one("SELECT count(*) AS n FROM push_devices")).n, 0);
  // Only the runner can claim.
  await expect("internal/push/claim", {}, 403, {
    native: false,
    headers: { Authorization: "Bearer wrong", Origin: "" },
  });
  await expect("devices", { token: deviceToken }, 200, { token: nativeToken });
  await expect(`devices/${deviceToken}`, undefined, 200, {
    token: nativeToken,
    method: "DELETE",
  });
  assert.equal((await one("SELECT count(*) AS n FROM push_devices")).n, 0);
  checks += 14;

  // ── The runner's APNs client ───────────────────────────────────────────
  assert.equal(apnsSettings({}), null);
  const settings = apnsSettings({
    APNS_KEY_ID: "APNSKEY001",
    APPLE_TEAM_ID: "TEAM123456",
    APNS_PRIVATE_KEY: (await exportPKCS8(apnsKey.privateKey)).replace(
      /\n/g,
      "\\n",
    ),
  });
  const provider = providerToken(settings);
  const verified = await jwtVerify(provider, apnsKey.publicKey);
  assert.equal(verified.payload.iss, "TEAM123456");
  assert.equal(verified.protectedHeader.kid, "APNSKEY001");
  const received = [];
  const server = createServer();
  server.on("stream", (stream, headers) => {
    let text = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => (text += chunk));
    stream.on("end", () => {
      received.push({ headers, body: JSON.parse(text) });
      const gone = headers[":path"].endsWith("/" + "ee".repeat(32));
      stream.respond({ ":status": gone ? 410 : 200 });
      stream.end(gone ? JSON.stringify({ reason: "Unregistered" }) : "");
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const local = `http://127.0.0.1:${server.address().port}`;
  const client = createApnsClient(settings, {
    origins: { production: local, sandbox: local },
  });
  const sent = await Promise.all([
    client.send({
      id: "one",
      token: "dd".repeat(32),
      environment: "production",
      pushType: "alert",
      topic: bundleId,
      collapseId: "job",
      payload: { aps: { alert: { title: "Ready" } } },
    }),
    client.send({
      id: "two",
      token: "ee".repeat(32),
      environment: "sandbox",
      pushType: "liveactivity",
      topic: bundleId + ".push-type.liveactivity",
      payload: { aps: { event: "end" } },
    }),
  ]);
  assert.deepEqual(sent, [
    { id: "one", status: 200 },
    { id: "two", status: 410, reason: "Unregistered" },
  ]);
  const first = received.find((r) => r.headers[":path"].includes("dd"));
  assert.equal(first.headers["apns-topic"], bundleId);
  assert.equal(first.headers["apns-push-type"], "alert");
  assert.equal(first.headers["apns-collapse-id"], "job");
  const presented = await jwtVerify(
    first.headers.authorization.replace(/^bearer /, ""),
    apnsKey.publicKey,
    { issuer: "TEAM123456" },
  );
  assert.equal(presented.protectedHeader.kid, "APNSKEY001");
  assert.deepEqual(first.body, { aps: { alert: { title: "Ready" } } });
  client.close();
  await new Promise((resolve) => server.close(resolve));
  // A refused connection reads as a network failure, to be retried.
  const offline = createApnsClient(settings, {
    origins: { production: "http://127.0.0.1:1" },
  });
  assert.equal(
    (
      await offline.send({
        id: "three",
        token: "ff".repeat(32),
        environment: "production",
        pushType: "alert",
        topic: bundleId,
        payload: {},
      })
    ).status,
    0,
  );
  offline.close();
  checks += 6;

  // ── Deleting accounts made in the app ──────────────────────────────────
  await expect(
    "account/delete",
    { confirm: "DELETE", email: "someone@else.test" },
    403,
    { token: appleOwner },
  );
  const revokesBefore = appleCalls.filter(
    (c) => c.path === "/auth/revoke",
  ).length;
  await expect(
    "account/delete",
    { confirm: "DELETE", email: "OWNER@privaterelay.appleid.com " },
    200,
    { token: appleOwner },
  );
  const revoke = appleCalls.filter((c) => c.path === "/auth/revoke");
  assert.equal(revoke.length, revokesBefore + 1);
  assert.equal(revoke.at(-1).form.get("token"), "refresh-first-code");
  assert.equal(revoke.at(-1).form.get("token_type_hint"), "refresh_token");
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM apple_identities WHERE subject='apple-person'",
      )
    ).n,
    0,
  );
  assert.equal(
    (
      await one(
        "SELECT count(*) AS n FROM app_store_subscriptions WHERE restaurant_id=?",
        harbor,
      )
    ).n,
    0,
  );
  assert.equal(
    (await expect("state", undefined, 200, { token: appleOwner })).json.user,
    null,
  );
  // A password account still needs its password; the email isn't enough.
  await expect(
    "account/delete",
    { confirm: "DELETE", email: "native@example.test" },
    403,
    { token: nativeToken },
  );
  // Its App Store trial still renews; once the owner turns that off in
  // Settings, Apple says so when asked and the account can go.
  await expect("account/delete", { confirm: "DELETE", password }, 409, {
    token: nativeToken,
  });
  subscribe({
    original: "3000",
    token: nativeRestaurant,
    price: 0,
    offerDiscountType: "FREE_TRIAL",
    autoRenew: 0,
  });
  await expect("account/delete", { confirm: "DELETE", password }, 200, {
    token: nativeToken,
  });
  assert.equal(
    (
      await all(
        "SELECT * FROM push_outbox WHERE restaurant_id=?",
        nativeRestaurant,
      )
    ).length,
    0,
  );
  checks += 6;

  await flushMonitoring();
  console.log(
    `PASS: ${checks} iPhone app checks: native sessions, the version gate, Sign in with Apple, Google from the app, App Store subscriptions, push notifications, the APNs client and account deletion. Apple, Google and APNs are local fixtures.`,
  );
} finally {
  globalThis.fetch = originalFetch;
  rmSync(root, { recursive: true, force: true });
}
