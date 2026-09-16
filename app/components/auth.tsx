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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/client";
import Brand from "./brand";
export default function Auth({
  open,
  setOpen,
  local,
  ownerSetup,
  onDone,
  initialMode = "login",
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  local: boolean;
  ownerSetup: boolean;
  onDone: () => Promise<void>;
  initialMode?: "login" | "signup";
}) {
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [invite, setInvite] = useState(""),
    [restaurant, setRestaurant] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [website, setWebsite] = useState(""),
    [resetting, setResetting] = useState(false);
  useEffect(() => {
    if (open && !new URLSearchParams(location.search).get("invite")) {
      setMode(initialMode);
      setError("");
    }
  }, [open, initialMode]);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("invite")) {
      setMode("signup");
      setResetting(q.get("reset") === "1");
      setInvite(q.get("invite")!);
      setEmail(q.get("email") || "");
      setOpen(true);
    }
  }, [setOpen]);
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
      <DialogContent className="auth-dialog">
        <Brand />
        <DialogHeader>
          <DialogTitle>
            {mode === "login"
              ? "Welcome back."
              : resetting
                ? "Choose a new password."
                : "Your first 5 images are on us."}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Sign in to your restaurant workspace."
              : resetting
                ? "Restore access with your secure reset link. Your previous sign-ins will be closed."
                : "Create your free account to generate your image. Your photo and selected look stay ready. No credit card needed."}
          </DialogDescription>
        </DialogHeader>
        {!resetting && (
          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value);
              setError("");
            }}
          >
            <TabsList className="mode-tabs">
              <TabsTrigger value="signup">Create account</TabsTrigger>
              <TabsTrigger value="login">Sign in</TabsTrigger>
            </TabsList>
          </Tabs>
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
          {mode === "signup" && !resetting && (
            <label className="field">
              Restaurant name <small>Optional—you can add it later.</small>
              <input
                maxLength={100}
                value={restaurant}
                onChange={(e) => setRestaurant(e.target.value)}
                autoComplete="organization"
              />
            </label>
          )}
          <label className="field">
            Email address
            <input
              required
              type="email"
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
              maxLength={128}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </label>
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
          <Button className="wide mt-5" disabled={busy}>
            {busy
              ? "Opening your workspace…"
              : mode === "login"
                ? "Sign in"
                : resetting
                  ? "Save new password"
                  : "Create free account & continue"}
          </Button>
        </form>
        {mode === "signup" && !resetting && (
          <p className="fine">
            5 free image generations, once per account. Pro: $9.99/month for 100
            generations per month.{" "}
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
