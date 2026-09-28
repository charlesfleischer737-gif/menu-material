import { z } from "zod";
import {
  AppError,
  assert,
  body,
  config,
  digest,
  limit,
  now,
  one,
  response,
  run,
  token,
} from "./core";
import { background, reportError } from "./monitoring";
import { publicLimit } from "./safeguards";

// Only server configuration may choose the link's origin. Request headers and
// user-supplied return URLs must never decide where a reset token is sent.
function settings() {
  const key = config("RESEND_API_KEY").trim();
  const from = config("PASSWORD_RESET_FROM").trim();
  try {
    const origin = new URL(config("APP_ORIGIN"));
    if (origin.protocol !== "https:" || origin.username || origin.password)
      return null;
    if (!key || !from || /[\r\n]/.test(from)) return null;
    const address = from.match(/<([^<>]+)>$/)?.[1] || from;
    if (!z.string().email().safeParse(address).success) return null;
    return { key, from, origin: origin.origin };
  } catch {
    return null;
  }
}

export const passwordResetEnabled = () => !!settings();
export const RESET_EXPIRY_MS = 30 * 60 * 1000;
const accepted = {
  ok: true,
  message:
    "If an account matches that email, you'll receive a reset link shortly. Check your spam folder too.",
};

export async function requestPasswordReset(req: Request) {
  await publicLimit(req, "password-reset", 10, 900);
  const input = z
    .object({
      email: z
        .string()
        .trim()
        .email()
        .max(254)
        .transform((s) => s.toLowerCase()),
      website: z.string().max(500).optional(),
    })
    .parse(await body(req));
  const sender = settings();
  assert(
    sender,
    503,
    "Email reset is temporarily unavailable. Contact your administrator for a secure reset link.",
  );
  // Apply the same limit and response to existing and unknown addresses.
  await limit("password-reset:email:" + input.email, 3, 3600);
  if (input.website) return response(accepted);

  // Lookup and email delivery both happen after acknowledging the request, so
  // account existence and provider latency do not change the public response.
  // background() registers waitUntil on Workers and is flushable in local tests.
  background(async () => {
    let hash = "";
    try {
      if (!(await one("SELECT id FROM users WHERE email=?", input.email)))
        return;
      const raw = token();
      hash = digest(raw);
      const created = now();
      await run(
        "INSERT INTO invites (hash,email,role,allowance,expires_at,created_at) VALUES (?,?,'reset',0,?,?)",
        hash,
        input.email,
        created + RESET_EXPIRY_MS,
        created,
      );
      // Keep earlier links usable until one is redeemed: anonymous requests
      // must not cancel a reset already in the owner's inbox.
      const url = new URL("/", sender.origin);
      url.search = new URLSearchParams({
        invite: raw,
        email: input.email,
        reset: "1",
      }).toString();
      const link = url.href;
      const htmlLink = link.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sender.key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "password-reset-" + hash,
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          from: sender.from,
          to: [input.email],
          subject: "Reset your Menu Material password",
          text: `Reset your Menu Material password\n\nOpen this link to choose a new password:\n${link}\n\nThis link expires in 30 minutes and works once. Your previous sign-ins will close after you reset your password.\n\nIf you didn't request this, you can ignore this email. Your password hasn't changed.`,
          html: `<h1>Reset your Menu Material password</h1><p>Choose a new password for your restaurant workspace.</p><p><a href="${htmlLink}">Reset password</a></p><p>This link expires in 30 minutes and works once. Your previous sign-ins will close after you reset your password.</p><p>If you didn't request this, you can ignore this email. Your password hasn't changed.</p>`,
        }),
      });
      const result = (await res.json().catch(() => null)) as {
        id?: string;
      } | null;
      if (!res.ok || !result?.id) throw new Error("Reset email not accepted");
    } catch {
      // Never log provider bodies, recipients, reset URLs, tokens or API keys.
      if (hash)
        await run("DELETE FROM invites WHERE hash=? AND used_by IS NULL", hash);
      await reportError(
        new AppError(503, "Password-reset email delivery failed."),
        {
          route: "/api/auth/forgot-password",
          status: 503,
        },
      );
    }
  });
  return response(accepted);
}
