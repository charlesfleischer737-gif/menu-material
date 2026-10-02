import { randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  AppError,
  assert,
  body,
  db,
  digest,
  event,
  limit,
  now,
  one,
  owner,
  response,
  run,
  sessionToken,
} from "./core";
import { accountEmailSettings } from "./password-reset";
import { grantHeldImages } from "./free-grants";
import { publicLimit } from "./safeguards";
import { reportError } from "./monitoring";

export const VERIFICATION_EXPIRY_MS = 15 * 60 * 1000;
const cooldown = 60 * 1000;
const maxAttempts = 5;

export async function emailVerificationStatus(userId: string) {
  const u = await one(
    "SELECT email,email_verification_required,email_verified_at FROM users WHERE id=?",
    userId,
  );
  return {
    required: !!u?.email_verification_required,
    email: u?.email || "",
    verifiedAt: u?.email_verified_at || null,
  };
}

export async function requireVerifiedEmail(restaurantId: string) {
  const u = await one(
    "SELECT u.email_verification_required FROM users u JOIN restaurants r ON r.user_id=u.id WHERE r.id=?",
    restaurantId,
  );
  if (u?.email_verification_required)
    throw new AppError(
      403,
      "Verify your email to unlock your free images. Your photo and selected look are saved.",
      "email_verification_required",
    );
}

// Called only after a trusted Google ownership proof or an email code. This
// transition never resets an existing balance and can safely be retried.
export async function finishEmailVerification(userId: string) {
  const u = await one(
    "SELECT email FROM users WHERE id=? AND email_verification_required=0 AND email_verified_at IS NOT NULL",
    userId,
  );
  if (!u) return;
  const transitioned = await run(
    "UPDATE restaurants SET free_grant=CASE WHEN EXISTS(SELECT 1 FROM free_grant_emails WHERE hash=?) THEN 'used' ELSE 'held' END WHERE user_id=? AND free_grant='verification' AND EXISTS(SELECT 1 FROM users WHERE id=? AND email_verification_required=0 AND email_verified_at IS NOT NULL)",
    digest(`free-grant:${u.email}`),
    userId,
    userId,
  );
  await grantHeldImages(!!transitioned.meta.changes);
}

function sessionProof(req: Request) {
  const raw = sessionToken(req)?.raw;
  assert(raw, 401, "Sign in again to verify your email.");
  return { raw, hash: digest(raw) };
}

export async function emailVerificationRoute(req: Request, action?: string) {
  const { u, r } = await owner(req);
  const proof = sessionProof(req);
  const status = await emailVerificationStatus(u.id);
  if (!action && req.method === "GET") {
    const current = await one(
      "SELECT created_at,expires_at,delivered FROM email_verifications WHERE session_hash=? AND email=?",
      proof.hash,
      status.email,
    );
    return response({
      ...status,
      sent: !!current?.delivered && current.expires_at > now(),
      resendAfter: current
        ? Math.max(0, Math.ceil((current.created_at + cooldown - now()) / 1000))
        : 0,
    });
  }
  assert(req.method === "POST", 405, "Method not allowed.");
  assert(
    ["send", "confirm", "change-email"].includes(action || ""),
    404,
    "Not found.",
  );
  if (!status.required) {
    await finishEmailVerification(u.id);
    return response({ ok: true, required: false });
  }

  if (action === "change-email") {
    await publicLimit(req, "verification-change-email", 10, 3600);
    await limit(`verification-change:${u.id}`, 3, 3600);
    const input = z
      .object({
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
      })
      .parse(await body(req));
    assert(
      !(await one(
        "SELECT 1 FROM users WHERE email=? AND id!=?",
        input.email,
        u.id,
      )),
      409,
      "That email cannot be used here. Try another address or sign in to its account.",
    );
    assert(
      !(await one("SELECT 1 FROM google_identities WHERE user_id=?", u.id)),
      409,
      "Your email is connected to Google. Sign in with Google to continue.",
    );
    try {
      const results = await db().batch([
        db()
          .prepare(
            "UPDATE users SET email=? WHERE id=? AND email=? AND email_verification_required=1 RETURNING id",
          )
          .bind(input.email, u.id, status.email),
        db()
          .prepare(
            "DELETE FROM email_verifications WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND email=? AND email_verification_required=1)",
          )
          .bind(u.id, u.id, input.email),
      ]);
      assert(
        results[0].results.length,
        409,
        "Your account changed. Refresh and try again.",
      );
    } catch (e) {
      if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message))
        throw new AppError(
          409,
          "That email cannot be used here. Try another address or sign in to its account.",
        );
      throw e;
    }
    return response({ ok: true, required: true, email: input.email });
  }

  if (action === "send") {
    const sender = accountEmailSettings();
    assert(
      sender,
      503,
      "Verification emails are temporarily unavailable. Your work is saved; please try again shortly.",
    );
    await publicLimit(req, "verification-send", 10, 900);
    await limit(`verification-send-user:${u.id}`, 3, 3600);
    await limit(`verification-send-email:${status.email}`, 3, 3600);
    await limit(`verification-resend:${u.id}`, 1, 60);
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    // The raw session is a secret unavailable in the database. It prevents
    // offline enumeration of the small code space, and binds proof to this browser.
    const codeHash = digest(`${proof.raw}:${u.id}:${status.email}:${code}`);
    const created = now();
    await run(
      "INSERT INTO email_verifications (session_hash,user_id,email,code_hash,attempts,delivered,created_at,expires_at) VALUES (?,?,?,?,0,0,?,?) ON CONFLICT(session_hash) DO UPDATE SET email=excluded.email,code_hash=excluded.code_hash,attempts=0,delivered=0,created_at=excluded.created_at,expires_at=excluded.expires_at",
      proof.hash,
      u.id,
      status.email,
      codeHash,
      created,
      created + VERIFICATION_EXPIRY_MS,
    );
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sender.key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `email-verification-${codeHash}`,
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          from: sender.from,
          to: [status.email],
          subject: "Verify your Menu Material email",
          text: `Your Menu Material verification code is ${code}.\n\nEnter it in the browser where you requested it. It expires in 15 minutes and works once. Never share this code.\n\nIf you didn't request this, ignore this email.`,
          html: `<h1>Verify your email</h1><p>Enter this code in the browser where you requested it:</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold">${code}</p><p>It expires in 15 minutes and works once. Never share this code.</p><p>If you didn't request this, ignore this email.</p>`,
        }),
      });
      const result = (await res.json().catch(() => null)) as {
        id?: string;
      } | null;
      if (!res.ok || !result?.id) throw Error("Email not accepted");
      await run(
        "UPDATE email_verifications SET delivered=1 WHERE session_hash=? AND code_hash=?",
        proof.hash,
        codeHash,
      );
      await event(r.id, "email_verification_sent").catch(() => {});
      return response({
        ok: true,
        required: true,
        email: status.email,
        resendAfter: 60,
      });
    } catch {
      await run(
        "DELETE FROM email_verifications WHERE session_hash=? AND code_hash=?",
        proof.hash,
        codeHash,
      );
      await reportError(
        new AppError(503, "Verification email delivery failed."),
        { route: "/api/auth/email-verification/send", status: 503 },
      );
      throw new AppError(
        503,
        "We couldn't send your code. Wait a minute, check your email address, and try again. Your work is saved.",
      );
    }
  }

  await publicLimit(req, "verification-confirm", 30, 900);
  await limit(`verification-attempts:${u.id}`, 15, 3600);
  const input = z
    .object({
      code: z
        .string()
        .trim()
        .regex(/^\d{6}$/),
    })
    .parse(await body(req));
  // Increment before checking, atomically, so parallel guesses share the limit.
  const challenge = await one(
    "UPDATE email_verifications SET attempts=attempts+1 WHERE session_hash=? AND user_id=? AND email=? AND delivered=1 AND expires_at>? AND attempts<? RETURNING code_hash",
    proof.hash,
    u.id,
    status.email,
    now(),
    maxAttempts,
  );
  assert(
    challenge,
    400,
    "Your code expired or has too many attempts. Request a new code.",
  );
  const candidate = digest(
    `${proof.raw}:${u.id}:${status.email}:${input.code}`,
  );
  assert(
    timingSafeEqual(Buffer.from(candidate), Buffer.from(challenge.code_hash)),
    400,
    "That code doesn't match. Check the email and try again.",
  );
  await db().batch([
    db()
      .prepare(
        "UPDATE users SET email_verification_required=0,email_verified_at=? WHERE id=? AND email=? AND email_verification_required=1 AND EXISTS(SELECT 1 FROM email_verifications WHERE session_hash=? AND code_hash=? AND delivered=1 AND expires_at>? AND attempts<=?)",
      )
      .bind(
        now(),
        u.id,
        status.email,
        proof.hash,
        candidate,
        now(),
        maxAttempts,
      ),
    db()
      .prepare(
        "DELETE FROM email_verifications WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND email_verification_required=0 AND email_verified_at IS NOT NULL)",
      )
      .bind(u.id, u.id),
  ]);
  assert(
    !(await emailVerificationStatus(u.id)).required,
    409,
    "Your code changed. Request a new code and try again.",
  );
  await finishEmailVerification(u.id);
  await event(r.id, "email_verified").catch(() => {});
  return response({ ok: true, required: false });
}
