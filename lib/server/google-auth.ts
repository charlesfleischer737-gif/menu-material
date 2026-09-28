import { createRemoteJWKSet, jwtVerify } from "jose";
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
import { recordSignupSource } from "./funnel";
import { isPlaceholderRestaurantName, slugify } from "../restaurant-identity";

const flowLifetime = 10 * 60 * 1000;
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  {
    timeoutDuration: 5000,
  },
);
export const GOOGLE_ONLY_PASSWORD = "!google-only";
function clientId() {
  const value = config("GOOGLE_CLIENT_ID").trim();
  return /^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value)
    ? value
    : "";
}
function cookieName(req: Request) {
  return new URL(req.url).protocol === "https:"
    ? "__Host-menu_material_google"
    : "menu_material_google";
}
function cookie(req: Request, value: string, maxAge = flowLifetime / 1000) {
  return `${cookieName(req)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
async function flow(req: Request) {
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName(req) + "="))
    ?.split("=")[1];
  assert(
    raw && /^[\w-]{43}$/.test(raw),
    401,
    "Please try Continue with Google again.",
  );
  const found = await one(
    "SELECT * FROM google_auth_flows WHERE hash=? AND expires_at>?",
    digest(raw),
    now(),
  );
  assert(found, 401, "Your Google sign-in expired. Please try again.");
  return found;
}
// Exactly one request can redeem a proof, including requests racing each other.
async function consume(f: Row) {
  const claimed = await one(
    "DELETE FROM google_auth_flows WHERE hash=? AND subject=? AND expires_at>? RETURNING hash",
    f.hash,
    f.subject,
    now(),
  );
  assert(
    claimed,
    401,
    "Your Google sign-in expired or was already used. Please try again.",
  );
}
async function signedIn(req: Request, userId: string) {
  const res = await createSession(req, userId);
  res.headers.append("Set-Cookie", cookie(req, "", 0));
  return res;
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
      "This account was already created or linked. Please try Continue with Google again, or sign in with your password.",
    );
  throw error;
}

export async function googleAuthRoute(
  req: Request,
  action: string | undefined,
) {
  if (action === "config" && req.method === "GET")
    return response({ enabled: !!clientId() });
  assert(req.method === "POST", 405, "Method not allowed.");
  // The JS popup callback posts JSON from our page, never a cross-site form.
  assert(
    req.headers.get("origin") === new URL(req.url).origin &&
      req.headers.get("sec-fetch-site") !== "cross-site" &&
      req.headers.get("content-type")?.split(";")[0].trim() ===
        "application/json",
    403,
    "Please submit from this site.",
  );
  const audience = clientId();
  assert(
    audience,
    503,
    "Google sign-in is not available yet. Please use email and password.",
  );
  assert(
    ["start", "credential", "complete"].includes(action || ""),
    404,
    "Not found.",
  );
  await publicLimit(req, "google-signin", 40, 900);
  if (action === "start") {
    const raw = token(),
      nonce = token();
    await run("DELETE FROM google_auth_flows WHERE expires_at<=?", now());
    await run(
      "INSERT INTO google_auth_flows (hash,nonce_hash,expires_at) VALUES (?,?,?)",
      digest(raw),
      digest(nonce),
      now() + flowLifetime,
    );
    return response({ clientId: audience, nonce }, 200, {
      "Set-Cookie": cookie(req, raw),
    });
  }
  const f = await flow(req);
  if (action === "credential") {
    assert(
      !f.subject,
      401,
      "This Google sign-in was already checked. Please continue below or start again.",
    );
    const input = z
      .object({ credential: z.string().min(1).max(16000) })
      .parse(await body(req));
    let identity;
    try {
      const { payload } = await jwtVerify(input.credential, keys, {
        algorithms: ["RS256"],
        audience,
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        requiredClaims: [
          "sub",
          "email",
          "email_verified",
          "nonce",
          "iat",
          "exp",
        ],
        maxTokenAge: "10m",
        clockTolerance: 5,
      });
      const subject = z.string().min(1).max(255).parse(payload.sub);
      const email = z
        .string()
        .trim()
        .email()
        .max(254)
        .parse(payload.email)
        .toLowerCase();
      assert(
        payload.email_verified === true &&
          typeof payload.nonce === "string" &&
          digest(payload.nonce) === f.nonce_hash,
        401,
        "Invalid Google sign-in.",
      );
      identity = {
        subject,
        email,
        authoritative:
          email.endsWith("@gmail.com") ||
          (typeof payload.hd === "string" && !!payload.hd),
      };
    } catch {
      // Never include a credential or Google's response in logs or errors.
      throw new AppError(
        401,
        "We couldn't verify your Google sign-in. Please try again.",
      );
    }
    const checked = await one(
      "UPDATE google_auth_flows SET subject=?,email=?,authoritative=? WHERE hash=? AND subject IS NULL AND expires_at>? RETURNING hash",
      identity.subject,
      identity.email,
      identity.authoritative ? 1 : 0,
      f.hash,
      now(),
    );
    assert(checked, 401, "Please try Continue with Google again.");
    Object.assign(f, identity);
    const linked = await one(
      "SELECT user_id FROM google_identities WHERE subject=?",
      identity.subject,
    );
    if (linked) {
      await consume(f);
      return signedIn(req, linked.user_id);
    }
    const existing = await one(
      "SELECT id FROM users WHERE email=?",
      identity.email,
    );
    return response({
      step: existing ? "link" : "signup",
      email: identity.email,
    });
  }

  assert(f.subject && f.email, 401, "Please complete Google sign-in first.");
  const input = z
    .object({
      password: z.string().max(128).optional(),
      restaurant: z.string().trim().max(100).optional(),
      timezone: z.string().max(80).optional(),
      attribution: z.unknown().optional(),
      website: z.string().max(500).optional(),
    })
    .parse(await body(req));
  assert(!input.website, 400, "Please check the form and try again.");
  const linked = await one(
    "SELECT user_id FROM google_identities WHERE subject=?",
    f.subject,
  );
  if (linked) {
    await consume(f);
    return signedIn(req, linked.user_id);
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
        "SELECT subject FROM google_identities WHERE user_id=?",
        existing.id,
      )),
      409,
      "This workspace is already linked to another Google account. Sign in with that Google account or your password.",
    );
    await consume(f);
    try {
      // A concurrent password reset invalidates the password proof.
      const created = await one(
        "INSERT INTO google_identities (subject,user_id,created_at) SELECT ?,id,? FROM users WHERE id=? AND password=? RETURNING user_id",
        f.subject,
        now(),
        existing.id,
        existing.password,
      );
      assert(created, 409, "Your password changed. Please sign in again.");
    } catch (e) {
      conflict(e);
    }
    await loginSucceeded(f.email);
    return signedIn(req, existing.id);
  }
  assert(
    f.authoritative,
    403,
    "Google cannot confirm ownership of this email. Create an account using email and password, then connect Google by confirming that password.",
  );
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
          "INSERT INTO users (id,email,password,role,created_at) VALUES (?,?,?,'owner',?)",
        )
        .bind(userId, f.email, GOOGLE_ONLY_PASSWORD, t),
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
          "INSERT INTO google_identities (subject,user_id,created_at) VALUES (?,?,?)",
        )
        .bind(f.subject, userId, t),
    ]);
  } catch (e) {
    conflict(e);
  }
  await recordSignupSource(restaurantId, input.attribution);
  await event(restaurantId, "onboarded", null, { method: "google" });
  return signedIn(req, userId);
}
