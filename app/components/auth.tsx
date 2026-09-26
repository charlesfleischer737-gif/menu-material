"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api } from "@/lib/client";
import { isPlaceholderRestaurantName } from "@/lib/restaurant-identity";
import Brand from "./brand";
import GoogleSignIn from "./google-sign-in";
import { FREE_SIGNUP_IMAGES, PRO_PRICE_LABEL } from "@/lib/plans";
export default function Auth({
  open,
  setOpen,
  local,
  ownerSetup,
  onDone,
  initialMode = "login",
  billingEnabled = false,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  local: boolean;
  ownerSetup: boolean;
  onDone: () => Promise<void>;
  initialMode?: "login" | "signup";
  billingEnabled?: boolean;
}) {
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [invite, setInvite] = useState(""),
    [restaurant, setRestaurant] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [website, setWebsite] = useState(""),
    [resetting, setResetting] = useState(false),
    [recovery, setRecovery] = useState<
      "loading" | "ready" | "unavailable" | "failed"
    >("loading"),
    [resetSent, setResetSent] = useState(false),
    [signInInstead, setSignInInstead] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const linkLoaded = useRef(false);
  const [googleStep, setGoogleStep] = useState<"link" | "signup" | null>(null);
  useEffect(() => {
    if (!open) {
      setGoogleStep(null);
      setBusy(false);
    }
  }, [open]);
  useEffect(() => {
    if (
      open &&
      !linkLoaded.current &&
      !new URLSearchParams(location.search).get("invite")
    ) {
      setMode(initialMode);
      setError("");
      setResetSent(false);
    }
  }, [open, initialMode]);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("invite")) {
      linkLoaded.current = true;
      setMode("signup");
      setResetting(q.get("reset") === "1");
      setInvite(q.get("invite")!);
      setEmail(q.get("email") || "");
      setOpen(true);
      // Keep credentials out of later same-origin referrers and browser history.
      q.delete("invite");
      q.delete("email");
      q.delete("reset");
      history.replaceState(
        history.state,
        "",
        location.pathname + (q.size ? "?" + q : "") + location.hash,
      );
    }
  }, [setOpen]);
  async function forgotPassword() {
    setGoogleStep(null);
    setMode("forgot");
    setResetting(false);
    setInvite("");
    linkLoaded.current = false;
    setPassword("");
    setResetSent(false);
    setError("");
    setSignInInstead(false);
    setRecovery("loading");
    try {
      const result = await api("auth/recovery");
      setRecovery(result.enabled ? "ready" : "unavailable");
    } catch {
      setRecovery("failed");
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (
      mode === "signup" &&
      !resetting &&
      isPlaceholderRestaurantName(restaurant)
    ) {
      setError("Enter your restaurant’s real name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "forgot") {
        await api("auth/forgot-password", { email, website });
        setResetSent(true);
        return;
      }
      await api("auth/" + mode, {
        email,
        password,
        invite,
        restaurant,
        website,
        // A new restaurant's hours ("open now") use the owner's time zone.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await onDone();
      setOpen(false);
      history.replaceState({}, "", location.pathname + location.hash);
      setPassword("");
      setInvite("");
      setResetting(false);
      linkLoaded.current = false;
    } catch (e) {
      setError((e as Error).message);
      // The email already has an account: offer to sign in with it.
      setSignInInstead(
        mode === "signup" &&
          !resetting &&
          (e as { status?: number }).status === 409,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) setOpen(v);
      }}
    >
      <DialogContent
        className="auth-dialog"
        closeDisabled={busy}
        fallbackFocus={() =>
          // A menu item can disappear, or its phone trigger can be hidden
          // after resizing. Return to the available sign-in navigation.
          [
            ...document.querySelectorAll<HTMLElement>(
              ".pw-homepage .pw-login, .pw-homepage .pw-mobile-menu-trigger",
            ),
          ].find((element) => element.getClientRects().length) || null
        }
      >
        <Brand />
        <DialogHeader>
          <DialogTitle>
            {googleStep
              ? googleStep === "link"
                ? "Connect your Google account"
                : "Finish creating your account"
              : mode === "forgot"
                ? resetSent
                  ? "Check your email"
                  : "Reset your password"
                : mode === "login"
                  ? "Sign in"
                  : resetting
                    ? "Choose a new password"
                    : "Create your free account"}
          </DialogTitle>
          <DialogDescription>
            {googleStep
              ? googleStep === "link"
                ? "Keep your restaurant, photos, and credits together."
                : `Start with ${FREE_SIGNUP_IMAGES} free images. No credit card needed.`
              : mode === "forgot"
                ? resetSent
                  ? "If an account matches that email, you'll receive a reset link shortly. Check your spam folder too."
                  : "Enter your account email to request a secure reset link."
                : mode === "login"
                  ? "Sign in to your restaurant workspace."
                  : resetting
                    ? "Restore access with your secure reset link. Your previous sign-ins will be closed."
                    : `Start with ${FREE_SIGNUP_IMAGES} free images. Your photo and selected look stay ready. No credit card needed.`}
          </DialogDescription>
        </DialogHeader>
        {!googleStep && !resetting && mode !== "forgot" && (
          <div
            className="workspace-segments auth-mode-choice"
            role="group"
            aria-label="Account access"
          >
            {[
              { value: "signup", label: "Create account" },
              { value: "login", label: "Sign in" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={busy}
                aria-pressed={mode === option.value}
                onClick={() => {
                  setMode(option.value);
                  setError("");
                  setSignInInstead(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {!googleStep && ownerSetup && !invite && mode !== "forgot" && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const d = await api("auth/owner-invite", {});
                setInvite(d.invite);
                setEmail(d.email);
                setMode("signup");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Set up your administrator account
          </Button>
        )}
        {mode === "forgot" && recovery !== "ready" && (
          <p role={recovery === "loading" ? "status" : "alert"}>
            {recovery === "loading"
              ? "Checking password recovery…"
              : recovery === "unavailable"
                ? "Email reset is temporarily unavailable. Contact your administrator for a secure reset link."
                : "We couldn't check password recovery. Please try again."}
          </p>
        )}
        {mode === "forgot" && recovery === "failed" && (
          <Button variant="outline" onClick={forgotPassword}>
            Try again
          </Button>
        )}
        {mode === "forgot" && resetSent && (
          <p role="status">
            Reset links expire in 30 minutes. Your password stays the same until
            you choose a new one.
          </p>
        )}
        {open && !invite && !resetting && mode !== "forgot" && (
          <GoogleSignIn
            key={mode}
            busy={busy}
            restaurant={restaurant}
            onBusy={setBusy}
            onStep={setGoogleStep}
            onDone={async () => {
              await onDone();
              setOpen(false);
              setPassword("");
              setGoogleStep(null);
            }}
            onForgot={(address) => {
              setEmail(address);
              void forgotPassword();
            }}
          />
        )}
        {!googleStep &&
          (mode !== "forgot" || (recovery === "ready" && !resetSent)) && (
            <form onSubmit={submit}>
              <label className="field">
                Email address
                <input
                  required
                  type="email"
                  disabled={busy}
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              {mode !== "forgot" && (
                <label className="field">
                  {resetting ? "New password" : "Password"}
                  {mode === "signup" && <small>At least 12 characters.</small>}
                  <input
                    ref={passwordInput}
                    required
                    minLength={mode === "signup" ? 12 : 1}
                    disabled={busy}
                    maxLength={128}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                  />
                </label>
              )}
              {mode === "signup" && !resetting && (
                <label className="field">
                  Restaurant name
                  <small>Shown on your menus and posts.</small>
                  <input
                    required
                    disabled={busy}
                    minLength={2}
                    maxLength={100}
                    value={restaurant}
                    onChange={(e) => setRestaurant(e.target.value)}
                    autoComplete="organization"
                    placeholder="Corner House Kitchen"
                  />
                </label>
              )}
              <label className="pw-honeypot" aria-hidden="true">
                Website
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {error && signInInstead && mode === "signup" && !resetting && (
                <Button
                  type="button"
                  variant="outline"
                  className="wide"
                  disabled={busy}
                  onClick={() => {
                    // The typed email stays; only the mode changes.
                    setMode("login");
                    setError("");
                    passwordInput.current?.focus();
                  }}
                >
                  Sign in instead
                </Button>
              )}
              <Button className="wide auth-submit" disabled={busy}>
                {busy
                  ? mode === "forgot"
                    ? "Requesting reset link…"
                    : resetting
                      ? "Saving new password…"
                      : "Opening your workspace…"
                  : mode === "forgot"
                    ? "Send reset link"
                    : mode === "login"
                      ? "Sign in"
                      : resetting
                        ? "Save new password"
                        : "Create free account"}
              </Button>
            </form>
          )}
        {mode === "forgot" && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setMode("login");
              setError("");
              setResetSent(false);
            }}
          >
            Back to sign in
          </Button>
        )}
        {resetting && error && (
          <Button variant="outline" disabled={busy} onClick={forgotPassword}>
            Request a new reset link
          </Button>
        )}
        {mode === "signup" && !resetting && (
          <p className="fine">
            {FREE_SIGNUP_IMAGES} free images, once per account.{" "}
            {billingEnabled
              ? `Pro: ${PRO_PRICE_LABEL}/month.`
              : "Pro is coming soon."}{" "}
            <a href="/pricing" target="_blank" rel="noreferrer">
              See plans
            </a>
            .
          </p>
        )}
        <p className="fine">
          <a href="/privacy" target="_blank" rel="noreferrer">
            Photo & account privacy
          </a>{" "}
          ·{" "}
          <a href="/guidelines" target="_blank" rel="noreferrer">
            Usage guidelines
          </a>
        </p>
        {!googleStep && mode === "login" && (
          <Button variant="link" disabled={busy} onClick={forgotPassword}>
            Forgot password?
          </Button>
        )}
        {local && mode !== "forgot" && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("auth/dev", {});
                await onDone();
                setOpen(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Open local workspace
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
