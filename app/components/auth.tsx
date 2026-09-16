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
    [requested, setRequested] = useState(false),
    [website, setWebsite] = useState(""),
    [resetting, setResetting] = useState(false);
  useEffect(() => {
    if (open && !new URLSearchParams(location.search).get("invite")) {
      setMode(initialMode === "signup" ? "request" : "login");
      setRequested(false);
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
    setBusy(true);
    setError("");
    try {
      if (mode === "request") {
        await api("access-requests", { email, restaurant, website });
        setRequested(true);
        return;
      }
      await api("auth/" + mode, { email, password, invite, restaurant });
      await onDone();
      setOpen(false);
      history.replaceState({}, "", location.pathname);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="auth-dialog">
        <Brand />
        <DialogHeader>
          <DialogTitle>
            {mode === "login"
              ? "Welcome back."
              : mode === "request"
                ? "Request early access."
                : resetting
                  ? "Choose a new password."
                  : "Let’s make your food stand out."}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Sign in to your restaurant workspace."
              : mode === "request"
                ? "Join the free restaurant pilot. Places are limited; requesting access does not create an account or guarantee a place."
                : resetting
                  ? "Use your secure reset invitation to restore access. Your previous sign-ins will be closed."
                  : "Use your invitation to join the free pilot. Your included image allowance is shown in your workspace. No credit card needed."}
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value);
            setError("");
            setRequested(false);
          }}
        >
          <TabsList className="mode-tabs">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="request">Request access</TabsTrigger>
            <TabsTrigger value="signup">Use invitation</TabsTrigger>
          </TabsList>
        </Tabs>
        {ownerSetup && !invite && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
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
            Set up your pilot administrator account
          </Button>
        )}
        {requested ? (
          <div className="pw-access-success" role="status">
            <h2>Your request is saved.</h2>
            <p>
              You’re on our early-access list. Invitations are reviewed manually
              as places become available. No confirmation email has been sent.
            </p>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {(mode === "request" || (mode === "signup" && !resetting)) && (
              <>
                <label className="field">
                  Restaurant name
                  <input
                    required
                    value={restaurant}
                    onChange={(e) => setRestaurant(e.target.value)}
                    autoComplete="organization"
                  />
                </label>
                {mode === "signup" && (
                  <label className="field">
                    Invitation code
                    <input
                      required
                      value={invite}
                      onChange={(e) => setInvite(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                )}
              </>
            )}
            <label className="field">
              Email address
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            {mode !== "request" && (
              <label className="field">
                Password
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
            )}
            {mode === "request" && (
              <label className="pw-honeypot" aria-hidden="true">
                Website
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button className="wide mt-5" disabled={busy}>
              {busy
                ? mode === "request"
                  ? "Saving your request…"
                  : "Opening your workspace…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "request"
                    ? "Request free pilot access"
                    : resetting
                      ? "Save new password"
                      : "Create my free account"}
            </Button>
          </form>
        )}
        <p className="fine">
          <a href="/pilot">What’s included</a> ·{" "}
          <a href="/privacy">Photo & account privacy</a>
        </p>
        {mode === "login" && (
          <p className="fine">
            Forgot your password? Your pilot coordinator can give you a secure
            reset invitation.
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
            Open local pilot workspace
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
