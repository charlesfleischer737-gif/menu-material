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
export default function Auth({
  open,
  setOpen,
  local,
  ownerSetup,
  onDone,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  local: boolean;
  ownerSetup: boolean;
  onDone: () => Promise<void>;
}) {
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [invite, setInvite] = useState(""),
    [restaurant, setRestaurant] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("invite")) {
      setMode("signup");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "login"
              ? "Welcome back."
              : "Your next great dish starts here."}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Sign in to your restaurant workspace."
              : "The pilot is free and invitation-only. Use the invitation your coordinator shared."}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="mode-tabs">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Accept an invitation</TabsTrigger>
          </TabsList>
        </Tabs>
        {ownerSetup && mode === "login" && (
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
        <form onSubmit={submit}>
          {mode === "signup" && (
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
              <label className="field">
                Invitation code
                <input
                  required
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  autoComplete="off"
                />
              </label>
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
                : "Create my free workspace"}
          </Button>
        </form>
        <p className="fine">
          Forgot your password? Your pilot coordinator can give you a secure
          reset invitation.
        </p>
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
