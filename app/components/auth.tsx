"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/client";
import Brand from "./brand";
// An invitation link opens sign-up with its details filled in.
function readInvitation() {
  if (typeof location === "undefined") return null;
  const query = new URLSearchParams(location.search);
  const invite = query.get("invite");
  return invite
    ? {
        invite,
        email: query.get("email") || "",
        reset: query.get("reset") === "1",
      }
    : null;
}
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
  const [invitation] = useState(readInvitation);
  const [mode, setMode] = useState(invitation ? "signup" : "login"),
    [email, setEmail] = useState(invitation?.email || ""),
    [password, setPassword] = useState(""),
    [invite, setInvite] = useState(invitation?.invite || ""),
    [restaurant, setRestaurant] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [website, setWebsite] = useState(""),
    [resetting, setResetting] = useState(!!invitation?.reset),
    [openedAs, setOpenedAs] = useState<string | null>(null);
  // Each opening starts in the requested mode, unless the page still carries
  // an invitation link. Opening only happens in the browser.
  const opening = open ? initialMode : null;
  if (opening !== openedAs) {
    setOpenedAs(opening);
    if (open && !readInvitation()) {
      setMode(initialMode);
      setError("");
    }
  }
  useEffect(() => {
    if (invitation) setOpen(true);
  }, [invitation, setOpen]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("auth/" + mode, {
        email,
        password,
        invite,
        restaurant,
        website,
      });
      await onDone();
      setOpen(false);
      history.replaceState({}, "", location.pathname + location.hash);
      setPassword("");
      setInvite("");
      setResetting(false);
    } catch (e) {
      setError((e as Error).message);
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
            {mode === "login"
              ? "Welcome back."
              : resetting
                ? "Choose a new password."
                : "Start with 5 free images."}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Sign in to your restaurant workspace."
              : resetting
                ? "Restore access with your secure reset link. Your previous sign-ins will be closed."
                : "Your photo and selected look stay ready. No credit card needed."}
          </DialogDescription>
        </DialogHeader>
        {!resetting && (
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
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {ownerSetup && !invite && (
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
          <label className="field">
            {resetting ? "New password" : "Password"}
            {mode === "signup" && <small>At least 12 characters.</small>}
            <input
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
          {mode === "signup" && !resetting && (
            <Collapsible className="auth-optional">
              <CollapsibleTrigger asChild>
                <button type="button" disabled={busy}>
                  Restaurant name <span>(optional)</span>
                  <span aria-hidden="true">+</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <label className="field">
                  Restaurant name
                  <input
                    disabled={busy}
                    maxLength={100}
                    value={restaurant}
                    onChange={(e) => setRestaurant(e.target.value)}
                    autoComplete="organization"
                  />
                </label>
              </CollapsibleContent>
            </Collapsible>
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
          <Button className="wide auth-submit" disabled={busy}>
            {busy
              ? "Opening your workspace…"
              : mode === "login"
                ? "Sign in"
                : resetting
                  ? "Save new password"
                  : "Create free account"}
          </Button>
        </form>
        {mode === "signup" && !resetting && (
          <p className="fine">
            5 free images, once per account.{" "}
            {billingEnabled ? "Pro: $9.99/month." : "Pro is coming soon."}{" "}
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
        {mode === "login" && (
          <p className="fine">
            Automated password-reset emails are not available yet. If you have
            an administrator contact, request a secure reset link.
          </p>
        )}
        {local && (
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
