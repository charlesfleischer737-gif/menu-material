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
import { FREE_SIGNUP_IMAGES } from "@/lib/plans";
import Brand from "./brand";

export default function EmailVerification({
  open,
  setOpen,
  email,
  onDone,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  email: string;
  onDone: () => Promise<void>;
}) {
  const [address, setAddress] = useState(email);
  const [code, setCode] = useState("");
  const [emailDraft, setEmailDraft] = useState(email);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const locked = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    setAddress(email);
  }, [email]);
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(
      () => setRemaining((n) => Math.max(0, n - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [open]);

  async function send() {
    if (locked.current) return;
    locked.current = true;
    setBusy("send");
    setError("");
    try {
      const result = await api("auth/email-verification/send", {});
      if (result.required === false) {
        await done.current();
        return;
      }
      setAddress(result.email);
      setSent(true);
      setCode("");
      setRemaining(result.resendAfter || 60);
      codeInput.current?.focus();
    } catch (e) {
      setError((e as Error).message);
      setRemaining(60);
    } finally {
      locked.current = false;
      setBusy("");
    }
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError("");
    setBusy("load");
    void api("auth/email-verification")
      .then(async (status) => {
        if (!active) return;
        setBusy("");
        if (!status.required) {
          await done.current();
          return;
        }
        setAddress(status.email);
        setSent(status.sent);
        setRemaining(status.resendAfter);
        if (!status.sent && !status.resendAfter) await send();
      })
      .catch((e) => {
        if (active) {
          setBusy("");
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked.current || busy) return;
    locked.current = true;
    setBusy(editing ? "change" : "confirm");
    setError("");
    try {
      if (editing) {
        const result = await api("auth/email-verification/change-email", {
          email: emailDraft,
        });
        if (result.required === false) {
          await done.current();
          return;
        }
        setAddress(result.email);
        setEditing(false);
        setSent(false);
        setCode("");
        locked.current = false;
        await send();
      } else {
        await api("auth/email-verification/confirm", { code });
        await done.current();
        setOpen(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy("");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value);
      }}
    >
      <DialogContent className="auth-dialog" closeDisabled={!!busy}>
        <Brand />
        <DialogHeader>
          <DialogTitle>
            {editing ? "Change your email" : "Verify your email"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Use an inbox you can open now."
              : `Unlock your ${FREE_SIGNUP_IMAGES} free images. Your photo and selected look stay ready.`}
          </DialogDescription>
        </DialogHeader>
        {!editing && (
          <p className="verification-address" role="status">
            {busy === "send"
              ? "Sending your code to "
              : sent
                ? "We sent a six-digit code to "
                : "Get a verification code at "}
            <strong>{address}</strong>.
          </p>
        )}
        <form onSubmit={submit}>
          {editing ? (
            <label className="field">
              Email address
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                disabled={!!busy}
                autoFocus
              />
            </label>
          ) : (
            <label className="field">
              Verification code
              <input
                ref={codeInput}
                className="verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                disabled={!!busy}
                aria-describedby="verification-help"
                autoFocus
              />
              <small id="verification-help">
                Expires in 15 minutes. Check your spam folder if it hasn’t
                arrived.
              </small>
            </label>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button
            className="wide auth-submit"
            disabled={!!busy || (!editing && code.length !== 6)}
          >
            {busy === "confirm"
              ? "Verifying…"
              : busy === "change"
                ? "Updating email…"
                : editing
                  ? "Save email and send code"
                  : "Verify and continue"}
          </Button>
        </form>
        {!editing && (
          <div className="verification-actions">
            <Button
              variant="outline"
              disabled={!!busy || remaining > 0}
              onClick={() => void send()}
            >
              {remaining > 0
                ? `Resend in ${remaining}s`
                : sent
                  ? "Resend code"
                  : "Send code"}
            </Button>
            <Button
              variant="link"
              disabled={!!busy}
              onClick={() => {
                setEmailDraft(address);
                setEditing(true);
                setError("");
              }}
            >
              Change email
            </Button>
          </div>
        )}
        {editing && (
          <Button
            variant="link"
            disabled={!!busy}
            onClick={() => {
              setEditing(false);
              setError("");
            }}
          >
            Back to verification
          </Button>
        )}
        <p className="fine">
          You only need to do this once. Your free images unlock after
          verification, subject to availability.
        </p>
      </DialogContent>
    </Dialog>
  );
}
