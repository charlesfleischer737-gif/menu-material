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
import Landing from "./components/menu-material-landing";
import Brand from "./components/brand";
import WorkspacePlaceholder from "./components/workspace-placeholder";
import { api, type Row } from "@/lib/client";
const GuestStudio = lazy(() => import("./components/guest-studio"));
const PlanDialog = lazy(() => import("./components/plan-dialog"));
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
    [guest, setGuest] = useState(false),
    [plans, setPlans] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const actionBusy = useRef(false),
    tickBusy = useRef(false);
  const refresh = useCallback(
    () =>
      api("state").then((data) => {
        setState(data);
        setLoaded(true);
      }),
    [],
  );
  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      setLoaded(true);
    });
  }, [refresh]);
  useEffect(() => {
    if (state.user?.id) void api("events", { kind: "visit" }).catch(() => {});
  }, [state.user?.id]);
  // Links into the studio or plans apply once the account loads or changes.
  // The account only loads in the browser.
  const account = loaded ? `${state.user?.id}:${state.restaurant?.id}` : "";
  const [linkedAccount, setLinkedAccount] = useState("");
  if (account !== linkedAccount) {
    setLinkedAccount(account);
    if (loaded && !state.user && location.hash === "#studio") setGuest(true);
    if (loaded && new URLSearchParams(location.search).has("upgrade")) {
      if (state.user) setPlans(true);
      else {
        setAuthMode("signup");
        setAuth(true);
      }
    }
  }
  const [billingUser, setBillingUser] = useState(state.user?.id);
  if (state.user?.id !== billingUser) {
    setBillingUser(state.user?.id);
    if (state.user && new URLSearchParams(location.search).has("billing"))
      setPlans(true);
  }
  useEffect(() => {
    if (!loaded || !state.user || location.hash !== "#studio") return;
    let cancelled = false;
    void import("@/lib/guest-studio-storage")
      .then(({ loadGuestDrafts }) => loadGuestDrafts())
      .then((drafts) => {
        if (
          !cancelled &&
          drafts.some(
            (draft) =>
              draft.requested &&
              (!draft.transfer?.restaurantId ||
                draft.transfer.restaurantId === state.restaurant?.id),
          )
        )
          setGuest(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loaded, state.user?.id, state.restaurant?.id]);
  useEffect(() => {
    const open = () => setPlans(true);
    window.addEventListener("menu-material:plans", open);
    return () => window.removeEventListener("menu-material:plans", open);
  }, []);
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
  if (!loaded)
    return (
      <main className="initial-loading">
        <Brand />
        <WorkspacePlaceholder
          title="Menu Material"
          message="Getting things ready…"
        />
      </main>
    );
  return (
    <>
      {guest ? (
        <Suspense
          fallback={
            <main className="initial-loading">
              <Brand />
              <WorkspacePlaceholder
                title="Photo Studio"
                message="Opening Photo Studio…"
              />
            </main>
          }
        >
          <GuestStudio
            state={state}
            onBack={() => {
              setGuest(false);
              history.replaceState(null, "", "/");
            }}
            onSignIn={() => {
              setAuthMode("login");
              setAuth(true);
            }}
            onSignup={() => {
              setAuthMode("signup");
              setAuth(true);
            }}
            onFinish={async () => {
              await refresh();
              setGuest(false);
            }}
          />
        </Suspense>
      ) : !state.user ? (
        <Landing
          signedIn={!!state.user}
          onStart={() => {
            setGuest(true);
            history.pushState(null, "", "/#studio");
          }}
          onSignIn={() => {
            setAuthMode("login");
            setAuth(true);
          }}
        />
      ) : (
        <Suspense
          fallback={
            <main className="initial-loading">
              <Brand />
              <WorkspacePlaceholder
                title="Your workspace"
                message="Opening your workspace…"
              />
            </main>
          }
        >
          <CoreWorkspace
            foreground={!settings && !plans && !auth}
            state={state}
            refresh={refresh}
            key={`${state.user.id}:${state.restaurant.id}`}
            onSettings={() => setSettings(true)}
            onPlans={() => setPlans(true)}
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
                  fallback={
                    <WorkspacePlaceholder
                      title="Administration"
                      layout="operations"
                      message="Opening administration…"
                    />
                  }
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
        billingEnabled={!!state.billing?.enabled}
        onDone={async () => {
          if (new URLSearchParams(location.search).has("upgrade"))
            setPlans(true);
          await refresh();
        }}
      />
      {plans && state.user && (
        <Suspense fallback={<p role="status">Opening your plan…</p>}>
          <PlanDialog
            open={plans}
            close={() => setPlans(false)}
            state={state}
            refresh={refresh}
          />
        </Suspense>
      )}
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
    </>
  );
}
