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

export default function GoogleSignIn(props: {
  open: boolean;
  busy: boolean;
  restaurant: string;
  onBusy: (busy: boolean) => void;
  onStep: (step: "link" | "signup" | null) => void;
  onDone: () => Promise<void>;
  onForgot: (email: string) => void;
}) {
  const [enabled, setEnabled] = useState(enabledValue);
  const [ready, setReady] = useState(false);
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
  const expiresAt = useRef(0);
  const used = useRef(false);
  useEffect(() => {
    let active = true;
    void googleEnabled()
      .then((enabled) => {
        if (active) setEnabled(enabled);
      })
      .catch(() => {
        if (active)
          setError("Google sign-in couldn't load. Try again or use email.");
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!enabled) return;
    alive.current = true;
    let active = true;
    const abort = new AbortController();
    let resize: ResizeObserver | undefined;
    setReady(false);
    // The server proof lasts ten minutes. Keep a safety margin and never
    // reuse a consumed proof when reopening this persistent dialog.
    const startedAt = Date.now();
    async function start() {
      try {
        const [google, session] = await Promise.all([
          googleLibrary(),
          api("auth/google/start", {}, undefined, abort.signal),
        ]);
        if (!active || !target.current) return;
        expiresAt.current = startedAt + 9 * 60 * 1000;
        used.current = false;
        google.initialize({
          client_id: session.clientId,
          nonce: session.nonce,
          auto_select: false,
          ux_mode: "popup",
          callback: async ({ credential }) => {
            if (
              !active ||
              !latest.current.open ||
              running.current ||
              latest.current.busy
            )
              return;
            used.current = true;
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
        const element = target.current;
        let renderedWidth = 0;
        function render() {
          if (!element.clientWidth) return;
          const width = Math.min(400, Math.max(200, element.clientWidth));
          if (width === renderedWidth) return;
          renderedWidth = width;
          setReady(false);
          element.replaceChildren();
          // Keep Google's functional inline fallback when its personalized
          // iframe is blocked. Both occupy the same fixed-height slot.
          google.renderButton(element, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "pill",
            width,
          });
          setReady(true);
        }
        render();
        resize = new ResizeObserver(render);
        resize.observe(element);
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    }
    void start();
    return () => {
      active = false;
      alive.current = false;
      abort.abort();
      resize?.disconnect();
    };
  }, [enabled, attempt]);
  useEffect(() => {
    if (
      (!props.open && used.current) ||
      (props.open && expiresAt.current > 0 && Date.now() >= expiresAt.current)
    ) {
      restart();
    }
  }, [props.open]);
  function restart() {
    setStep(null);
    setPassword("");
    setError("");
    setReady(false);
    expiresAt.current = 0;
    used.current = false;
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
  if (enabled === false) return null;
  return (
    <div className="google-sign-in">
      <div hidden={!!step || !!error} inert={props.busy || !!step || !!error}>
        <div className="google-sign-in-slot" aria-busy={!ready}>
          {!ready && (
            <button
              type="button"
              disabled
              className="google-sign-in-placeholder"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 48 48"
                width="20"
                height="20"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59a14.41 14.41 0 0 1 0-9.18l-7.98-6.19a23.87 23.87 0 0 0 0 21.56l7.98-6.19Z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          )}
          <div
            ref={target}
            className="google-sign-in-button"
            data-ready={ready}
            aria-hidden={!ready}
            inert={!ready}
          />
        </div>
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
