import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import {
  AppError,
  assert,
  body,
  checkPassword,
  config,
  createSession,
  db,
  digest,
  event,
  id,
  nativeClient,
  now,
  one,
  response,
  run,
  token,
  type Row,
} from "./core";
import {
  loginLimit,
  loginSucceeded,
  newAccountLimit,
  publicLimit,
} from "./safeguards";
import { signupFreeImages } from "./free-grants";
import { finishEmailVerification } from "./email-verification";
import { recordSignupSource } from "./funnel";
import { reportError } from "./monitoring";
import { isPlaceholderRestaurantName, slugify } from "../restaurant-identity";

// Sign in with Apple, from the iPhone app. It follows Continue with Google
// (google-auth.ts): a short-lived flow carries a nonce, Apple's signed
// identity token proves the person, a matching email that already has an
// account needs its password to link, and a new account is made with the
// restaurant's name. App Review requires it next to Google sign-in.
const flowLifetime = 10 * 60 * 1000;
const apple = "https://appleid.apple.com";
const keys = createRemoteJWKSet(new URL(apple + "/auth/keys"), {
  timeoutDuration: 5000,
});
export const APPLE_ONLY_PASSWORD = "!apple-only";

/** The app's bundle ID, which Apple names in its tokens and transactions. */
export function appleBundleId() {
  const value = config("APPLE_BUNDLE_ID").trim();
  return /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(value) ? value : "";
}
export function appleSignInEnabled() {
  return !!appleBundleId();
}
/** With a Sign in with Apple key, deleting an account revokes its access. */
function appleKeyReady() {
  return !!(
    appleBundleId() &&
    config("APPLE_TEAM_ID").trim() &&
    config("APPLE_SIGN_IN_KEY_ID").trim() &&
    config("APPLE_SIGN_IN_PRIVATE_KEY").trim()
  );
}
/** A .p8 key, whether its line breaks were kept or written as "\n". */
export function pemKey(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}
async function clientSecret() {
  const key = await importPKCS8(
    pemKey(config("APPLE_SIGN_IN_PRIVATE_KEY")),
    "ES256",
  );
  return new SignJWT({})
    .setProtectedHeader({
      alg: "ES256",
      kid: config("APPLE_SIGN_IN_KEY_ID").trim(),
    })
    .setIssuer(config("APPLE_TEAM_ID").trim())
    .setSubject(appleBundleId())
    .setAudience(apple)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}
async function appleForm(path: string, fields: Record<string, string>) {
  return fetch(apple + path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appleBundleId(),
      client_secret: await clientSecret(),
      ...fields,
    }),
    signal: AbortSignal.timeout(10000),
  });
}
// The authorization code is good for five minutes and once. Its refresh
// token is kept only so account deletion can revoke it. Sign-in never
// depends on this exchange.
async function refreshTokenFor(code: string | undefined) {
  if (!code || !appleKeyReady()) return null;
  try {
    const res = await appleForm("/auth/token", {
      code,
      grant_type: "authorization_code",
    });
    if (!res.ok)
      throw new Error(`Apple's token exchange answered ${res.status}.`);
    const data = (await res.json()) as Row;
    return typeof data.refresh_token === "string" ? data.refresh_token : null;
  } catch (e) {
    await reportError(e, { route: "/api/auth/apple/credential" });
    return null;
  }
}
/**
 * Before an account is deleted: tell Apple to end the app's access. A
 * failure is reported, never a reason to keep someone's data.
 */
export async function revokeAppleAccess(userId: string) {
  const identity = await one(
    "SELECT refresh_token FROM apple_identities WHERE user_id=?",
    userId,
  );
  if (!identity?.refresh_token || !appleKeyReady()) return;
  try {
    const res = await appleForm("/auth/revoke", {
      token: identity.refresh_token,
      token_type_hint: "refresh_token",
    });
    if (!res.ok)
      throw new Error(`Apple's token revocation answered ${res.status}.`);
  } catch (e) {
    await reportError(e, { route: "/api/account/delete" });
  }
}
async function flow(req: Request) {
  const raw = req.headers.get("x-menu-material-auth-flow");
  assert(
    raw && /^[\w-]{43}$/.test(raw),
    401,
    "Please try Sign in with Apple again.",
  );
  const found = await one(
    "SELECT * FROM apple_auth_flows WHERE hash=? AND expires_at>?",
    digest(raw),
    now(),
  );
  assert(found, 401, "Your Apple sign-in expired. Please try again.");
  return found;
}
// Exactly one request can redeem a proof, including requests racing each other.
async function consume(f: Row) {
  const claimed = await one(
    "DELETE FROM apple_auth_flows WHERE hash=? AND subject=? AND expires_at>? RETURNING hash",
    f.hash,
    f.subject,
    now(),
  );
  assert(
    claimed,
    401,
    "Your Apple sign-in expired or was already used. Please try again.",
  );
}
function timezone(value: string | undefined) {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions()
      .timeZone;
  } catch {
    return "America/New_York";
  }
}
function conflict(error: unknown): never {
  if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message))
    throw new AppError(
      409,
      "This account was already created or linked. Please try Sign in with Apple again, or sign in with your password.",
    );
  throw error;
}
// Apple has confirmed the address, so the account's email is verified too.
async function verifiedByApple(userId: string, email: string | null) {
  if (!email) return;
  await run(
    "UPDATE users SET email_verification_required=0,email_verified_at=COALESCE(email_verified_at,?) WHERE id=? AND email=?",
    now(),
    userId,
    email,
  );
  await finishEmailVerification(userId);
}

export async function appleAuthRoute(req: Request, action: string | undefined) {
  if (action === "config" && req.method === "GET")
    return response({ enabled: appleSignInEnabled() });
  assert(req.method === "POST", 405, "Method not allowed.");
  // Only the app signs in with Apple; it never sends an Origin.
  assert(
    nativeClient(req) &&
      !req.headers.get("origin") &&
      req.headers.get("sec-fetch-site") !== "cross-site" &&
      req.headers.get("content-type")?.split(";")[0].trim() ===
        "application/json",
    403,
    "Please sign in from the Menu Material app.",
  );
  assert(
    appleSignInEnabled(),
    503,
    "Sign in with Apple is not available yet. Please use email and password.",
  );
  assert(
    ["start", "credential", "complete"].includes(action || ""),
    404,
    "Not found.",
  );
  await publicLimit(req, "apple-signin", 40, 900);
  if (action === "start") {
    const raw = token(),
      nonce = token();
    await run("DELETE FROM apple_auth_flows WHERE expires_at<=?", now());
    await run(
      "INSERT INTO apple_auth_flows (hash,nonce_hash,expires_at) VALUES (?,?,?)",
      digest(raw),
      digest(nonce),
      now() + flowLifetime,
    );
    // The app asks Apple to sign SHA-256(nonce), which is what is kept here.
    return response({ nonce, flow: raw });
  }
  const f = await flow(req);
  if (action === "credential") {
    assert(
      !f.subject,
      401,
      "This Apple sign-in was already checked. Please continue below or start again.",
    );
    const input = z
      .object({
        identityToken: z.string().min(1).max(16000),
        authorizationCode: z.string().min(1).max(2000).optional(),
      })
      .parse(await body(req));
    let identity: { subject: string; email: string | null };
    try {
      const { payload } = await jwtVerify(input.identityToken, keys, {
        algorithms: ["RS256"],
        audience: appleBundleId(),
        issuer: apple,
        requiredClaims: ["sub", "nonce", "iat", "exp"],
        maxTokenAge: "10m",
        clockTolerance: 5,
      });
      assert(
        typeof payload.nonce === "string" && payload.nonce === f.nonce_hash,
        401,
        "Invalid Apple sign-in.",
      );
      const subject = z.string().min(1).max(255).parse(payload.sub);
      // Apple writes these flags as booleans or as "true".
      const verified =
        payload.email_verified === true || payload.email_verified === "true";
      const email =
        verified && typeof payload.email === "string"
          ? z
              .string()
              .trim()
              .email()
              .max(254)
              .parse(payload.email)
              .toLowerCase()
          : null;
      identity = { subject, email };
    } catch {
      // Never include a token or Apple's response in logs or errors.
      throw new AppError(
        401,
        "We couldn't verify your Apple sign-in. Please try again.",
      );
    }
    const refreshToken = await refreshTokenFor(input.authorizationCode);
    const checked = await one(
      "UPDATE apple_auth_flows SET subject=?,email=?,refresh_token=? WHERE hash=? AND subject IS NULL AND expires_at>? RETURNING hash",
      identity.subject,
      identity.email,
      refreshToken,
      f.hash,
      now(),
    );
    assert(checked, 401, "Please try Sign in with Apple again.");
    Object.assign(f, identity);
    const linked = await one(
      "SELECT user_id FROM apple_identities WHERE subject=?",
      identity.subject,
    );
    if (linked) {
      await consume(f);
      if (refreshToken)
        await run(
          "UPDATE apple_identities SET refresh_token=? WHERE subject=?",
          refreshToken,
          identity.subject,
        );
      await verifiedByApple(linked.user_id, identity.email);
      return createSession(req, linked.user_id);
    }
    assert(
      identity.email,
      403,
      "Apple didn't share an email address. In Settings, under your name, open Sign in with Apple, stop using it with Menu Material, then try again and share an email.",
    );
    const existing = await one(
      "SELECT id FROM users WHERE email=?",
      identity.email,
    );
    return response({
      step: existing ? "link" : "signup",
      email: identity.email,
    });
  }

  assert(
    f.subject && f.email,
    401,
    "Please complete Sign in with Apple first.",
  );
  const input = z
    .object({
      password: z.string().max(128).optional(),
      restaurant: z.string().trim().max(100).optional(),
      timezone: z.string().max(80).optional(),
      attribution: z.unknown().optional(),
    })
    .parse(await body(req));
  const linked = await one(
    "SELECT user_id FROM apple_identities WHERE subject=?",
    f.subject,
  );
  if (linked) {
    await consume(f);
    return createSession(req, linked.user_id);
  }
  const existing = await one("SELECT * FROM users WHERE email=?", f.email);
  if (existing) {
    // Matching emails are not proof of ownership of an existing workspace.
    await loginLimit(req, f.email);
    assert(
      checkPassword(input.password || "", existing.password),
      403,
      "Enter your current Menu Material password to connect this account. Use Forgot password if you need a reset.",
    );
    assert(
      !(await one(
        "SELECT subject FROM apple_identities WHERE user_id=?",
        existing.id,
      )),
      409,
      "This workspace is already linked to another Apple Account. Sign in with that Apple Account or your password.",
    );
    await consume(f);
    try {
      // A concurrent password reset invalidates the password proof.
      const created = await one(
        "INSERT INTO apple_identities (subject,user_id,refresh_token,created_at) SELECT ?,id,?,? FROM users WHERE id=? AND password=? RETURNING user_id",
        f.subject,
        f.refresh_token,
        now(),
        existing.id,
        existing.password,
      );
      assert(created, 409, "Your password changed. Please sign in again.");
    } catch (e) {
      conflict(e);
    }
    await verifiedByApple(existing.id, f.email);
    await loginSucceeded(f.email);
    return createSession(req, existing.id);
  }
  assert(
    input.restaurant &&
      input.restaurant.length >= 2 &&
      !isPlaceholderRestaurantName(input.restaurant),
    400,
    "Enter your restaurant’s real name.",
  );
  await newAccountLimit(req);
  await consume(f);
  const free = await signupFreeImages(f.email);
  const userId = id(),
    restaurantId = id(),
    t = now();
  try {
    await db().batch([
      db()
        .prepare(
          "INSERT INTO users (id,email,password,role,created_at,email_verified_at) VALUES (?,?,?,'owner',?,?)",
        )
        .bind(userId, f.email, APPLE_ONLY_PASSWORD, t, t),
      db()
        .prepare(
          "INSERT INTO restaurants (id,user_id,name,slug,allowance,free_grant,timezone,created_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          restaurantId,
          userId,
          input.restaurant,
          slugify(input.restaurant) + "-" + restaurantId.slice(0, 8),
          free.allowance,
          free.freeGrant,
          timezone(input.timezone),
          t,
        ),
      db()
        .prepare(
          "INSERT INTO apple_identities (subject,user_id,refresh_token,created_at) VALUES (?,?,?,?)",
        )
        .bind(f.subject, userId, f.refresh_token, t),
    ]);
  } catch (e) {
    conflict(e);
  }
  await recordSignupSource(restaurantId, input.attribution);
  await event(restaurantId, "onboarded", null, { method: "apple" });
  return createSession(req, userId);
}
