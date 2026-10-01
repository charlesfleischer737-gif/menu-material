"use client";
import { forgetAttribution, savedAttribution } from "@/lib/attribution";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { isPlaceholderRestaurantName } from "@/lib/restaurant-identity";

type GoogleId = {
  initialize: (options: {
    client_id: string;
    nonce: string;
    callback: (result: { credential: string }) => void;
    auto_select: boolean;
    ux_mode: "popup";
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      type: "standard";
      theme: "outline";
      size: "large";
      text: "continue_with";
      shape: "pill";
      width: number;
    },
  ) => void;
};
type GoogleWindow = Window & { google?: { accounts: { id: GoogleId } } };
let enabledValue: boolean | undefined;
let enabledPromise: Promise<boolean> | undefined;
function googleEnabled() {
  return (enabledPromise ??= api("auth/google/config")
    .then((config) => (enabledValue = config.enabled === true))
    .catch((error) => {
      enabledPromise = undefined;
      throw error;
    }));
}
let scriptPromise: Promise<GoogleId> | undefined;
function googleLibrary() {
  const ready = (window as GoogleWindow).google?.accounts.id;
  if (ready) return Promise.resolve(ready);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    const timer = setTimeout(() => fail(), 15000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      scriptPromise = undefined;
      reject(
        Error(
          "Google sign-in couldn't load. Try again or use email and password.",
        ),
      );
    }
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      const id = (window as GoogleWindow).google?.accounts.id;
      if (id) resolve(id);
      else fail();
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Warm only public configuration and Google's library. Each opened dialog
// still creates its own fresh, browser-bound sign-in proof.
export function preloadGoogleSignIn() {
  void googleEnabled()
    .then((enabled) => (enabled ? googleLibrary() : undefined))
    .catch(() => {}); // Opening the dialog retries a failed preload.
}

export default function GoogleSignIn(props: {
  busy: boolean;
  restaurant: string;
  onBusy: (busy: boolean) => void;
  onStep: (step: "link" | "signup" | null) => void;
  onDone: () => Promise<void>;
  onForgot: (email: string) => void;
}) {
  const [enabled, setEnabled] = useState(enabledValue);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"link" | "signup" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurant, setRestaurant] = useState(props.restaurant);
  const [website, setWebsite] = useState("");
  const target = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    let active = true;
    void googleEnabled()
      .then((enabled) => {
        if (active) setEnabled(enabled);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!enabled) return;
    alive.current = true;
    let active = true;
    const abort = new AbortController();
    async function start() {
      try {
        const [google, session] = await Promise.all([
          googleLibrary(),
          api("auth/google/start", {}, undefined, abort.signal),
        ]);
        if (!active || !target.current) return;
        google.initialize({
          client_id: session.clientId,
          nonce: session.nonce,
          auto_select: false,
          ux_mode: "popup",
          callback: async ({ credential }) => {
            if (!active || running.current || latest.current.busy) return;
            running.current = true;
            latest.current.onBusy(true);
            setError("");
            try {
              const result = await api("auth/google/credential", {
                credential,
              });
              if (!active) return;
              if (result.ok) await latest.current.onDone();
              else {
                setStep(result.step);
                setEmail(result.email);
                setRestaurant(latest.current.restaurant);
                latest.current.onStep(result.step);
              }
            } catch (e) {
              if (active) setError((e as Error).message);
            } finally {
              running.current = false;
              if (active) latest.current.onBusy(false);
            }
          },
        });
        google.renderButton(target.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: Math.min(400, Math.max(200, target.current.clientWidth)),
        });
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    }
    void start();
    return () => {
      active = false;
      alive.current = false;
      abort.abort();
    };
  }, [enabled, attempt]);
  function restart() {
    setStep(null);
    setPassword("");
    setError("");
    latest.current.onStep(null);
    setAttempt((n) => n + 1);
  }
  async function complete(e: React.FormEvent) {
    e.preventDefault();
    if (running.current || props.busy) return;
    if (step === "signup" && isPlaceholderRestaurantName(restaurant)) {
      setError("Enter your restaurant’s real name.");
      return;
    }
    running.current = true;
    props.onBusy(true);
    setError("");
    try {
      await api("auth/google/complete", {
        password: step === "link" ? password : undefined,
        restaurant: step === "signup" ? restaurant : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        attribution: savedAttribution(),
        website,
      });
      forgetAttribution();
      await latest.current.onDone();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      running.current = false;
      if (alive.current) latest.current.onBusy(false);
    }
  }
  // Missing configuration never leaves a dead Google button on the live site.
  if (!enabled) return null;
  return (
    <div className="google-sign-in">
      <div hidden={!!step || !!error} inert={props.busy || !!step || !!error}>
        <div
          ref={target}
          className="google-sign-in-button"
          aria-label="Continue with Google"
        />
      </div>
      {step && (
        <form onSubmit={complete}>
          <p className="fine">
            {step === "link"
              ? `Confirm your Menu Material password for ${email} to connect Google to your existing workspace.`
              : `Continue as ${email}. Add your restaurant name to finish creating your free account.`}
          </p>
          {step === "link" ? (
            <label className="field">
              Current Menu Material password
              <input
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                maxLength={128}
                disabled={props.busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          ) : (
            <label className="field">
              Restaurant name
              <input
                required
                autoFocus
                autoComplete="organization"
                minLength={2}
                maxLength={100}
                disabled={props.busy}
                placeholder="Corner House Kitchen"
                value={restaurant}
                onChange={(e) => setRestaurant(e.target.value)}
              />
            </label>
          )}
          <label className="pw-honeypot" aria-hidden="true">
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button className="wide" disabled={props.busy}>
            {props.busy
              ? "Opening your workspace…"
              : step === "link"
                ? "Connect Google and sign in"
                : "Create free account"}
          </Button>
          {step === "link" && (
            <Button
              type="button"
              variant="link"
              disabled={props.busy}
              onClick={() => props.onForgot(email)}
            >
              Forgot password?
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={props.busy}
            onClick={restart}
          >
            Use a different account
          </Button>
        </form>
      )}
      {!step && error && (
        <>
          <p className="error" role="alert">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            className="wide"
            disabled={props.busy}
            onClick={restart}
          >
            Try Google again
          </Button>
        </>
      )}
      {!step && <p className="auth-divider">or use email</p>}
    </div>
  );
}
