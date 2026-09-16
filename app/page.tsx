"use client";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Auth from "./components/auth";
import Landing from "./components/plateworthy-landing";
import { api, type Row } from "@/lib/client";
const CoreWorkspace = lazy(() => import("./components/core-workspace"));
const SettingsPanel = lazy(() =>
  import("./components/account-panels").then((m) => ({
    default: m.SettingsPanel,
  })),
);
const Admin = lazy(() =>
  import("./components/account-panels").then((m) => ({ default: m.Admin })),
);
export default function Home() {
  const [state, setState] = useState<Row>({
    user: null,
    dishes: [],
    assets: [],
    jobs: [],
    outputs: [],
    captions: [],
  });
  const [loaded, setLoaded] = useState(false),
    [auth, setAuth] = useState(false),
    [authMode, setAuthMode] = useState<"login" | "signup">("login"),
    [settings, setSettings] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const actionBusy = useRef(false),
    tickBusy = useRef(false);
  const refresh = useCallback(async () => {
    const data = await api("state");
    setState(data);
    setLoaded(true);
  }, []);
  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      setLoaded(true);
    });
  }, [refresh]);
  useEffect(() => {
    if (state.user?.id) void api("events", { kind: "visit" }).catch(() => {});
  }, [state.user?.id]);
  useEffect(() => {
    if (!state.user) return;
    const timer = setInterval(async () => {
      if (tickBusy.current || document.hidden) return;
      tickBusy.current = true;
      try {
        if (
          state.batchItems?.some((b: Row) => b.status === "queued") ||
          state.jobs.some((j: Row) =>
            ["queued", "processing"].includes(j.status),
          )
        ) {
          await api("jobs/tick", {});
          await refresh();
        }
      } catch {
      } finally {
        tickBusy.current = false;
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [state.user, state.jobs, state.batchItems, refresh]);
  async function act(label: string, fn: () => Promise<void>) {
    if (actionBusy.current) return;
    actionBusy.current = true;
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      actionBusy.current = false;
    }
  }
  return (
    <>
      {!state.user ? (
        <Landing
          signedIn={!!state.user}
          onStart={() => {
            setAuthMode("signup");
            setAuth(true);
          }}
          onSignIn={() => {
            setAuthMode("login");
            setAuth(true);
          }}
        />
      ) : (
        <Suspense
          fallback={
            <p className="cx-feedback" role="status">
              Opening your workspace…
            </p>
          }
        >
          <CoreWorkspace
            state={state}
            refresh={refresh}
            key={`${state.user.id}:${state.restaurant.id}`}
            onSettings={() => setSettings(true)}
            onLogout={() =>
              act("Signing out", async () => {
                await api("auth/logout", {});
                const { clearExportImages } =
                  await import("@/lib/offer-export");
                clearExportImages();
                history.replaceState(
                  null,
                  "",
                  location.pathname + location.search,
                );
                await refresh();
              })
            }
            adminContent={
              state.user.role === "admin" ? (
                <Suspense
                  fallback={<p role="status">Opening administration…</p>}
                >
                  <Admin act={act} refresh={refresh} busy={busy} />
                </Suspense>
              ) : null
            }
          />
        </Suspense>
      )}
      {error && (
        <div className="landing-error error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      <Auth
        open={auth}
        setOpen={setAuth}
        local={!!state.local}
        ownerSetup={!!state.ownerSetup}
        initialMode={authMode}
        onDone={async () => {
          await refresh();
        }}
      />
      {settings && (
        <Suspense fallback={<p role="status">Opening settings…</p>}>
          <SettingsPanel
            open={settings}
            close={() => setSettings(false)}
            state={state}
            act={act}
            refresh={refresh}
            busy={busy}
          />
        </Suspense>
      )}
      {!loaded && (
        <div className="loading-strip" role="status">
          Opening your workspace…
        </div>
      )}
    </>
  );
}
