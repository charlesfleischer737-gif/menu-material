"use client";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Auth from "./auth";
import Landing from "./menu-material-landing";
import Brand from "./brand";
import WorkspacePlaceholder from "./workspace-placeholder";
import { api, type Row } from "@/lib/client";
import { loadFresh, reloadOnPreloadError } from "@/lib/chunk-reload";
import { watchJobs } from "@/lib/job-progress";
import { rememberScroll } from "@/lib/scroll-memory";
// loadFresh reloads the page when a tab from before a deploy asks for a
// screen's file that the deploy removed.
const GuestStudio = lazy(() => loadFresh(() => import("./guest-studio")));
const PlanDialog = lazy(() => loadFresh(() => import("./plan-dialog")));
const loadCoreWorkspace = () => import("./core-workspace");
const CoreWorkspace = lazy(() => loadFresh(loadCoreWorkspace));
const SettingsPanel = lazy(() =>
  loadFresh(() => import("./account-panels")).then((m) => ({
    default: m.SettingsPanel,
  })),
);
const Admin = lazy(() =>
  loadFresh(() => import("./account-panels")).then((m) => ({
    default: m.Admin,
  })),
);
// Drops a one-time query parameter from the address once it has been handled.
function forgetParam(name: string) {
  const url = new URL(location.href);
  if (!url.searchParams.has(name)) return;
  url.searchParams.delete(name);
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
}
function Opening({ title, message }: { title: string; message: string }) {
  return (
    <main className="initial-loading">
      <Brand />
      <WorkspacePlaceholder title={title} message={message} />
    </main>
  );
}
// `hasSession` comes from the server: whether the request carried a session
// cookie. Without one the visitor is signed out, so the marketing page renders
// straight away (and on the server). With one, the workspace is the likely
// destination, so the loading state holds until /api/state answers.
export default function HomeClient({ hasSession }: { hasSession: boolean }) {
  const [state, setState] = useState<Row>({
    user: null,
    dishes: [],
    assets: [],
    jobs: [],
    outputs: [],
    captions: [],
  });
  const [loaded, setLoaded] = useState(false),
    // Only for visitors with a session cookie: "failed" when the first
    // /api/state request errors, so they get a retry rather than marketing.
    [sessionCheck, setSessionCheck] = useState<"pending" | "failed" | "done">(
      hasSession ? "pending" : "done",
    ),
    [sessionError, setSessionError] = useState(""),
    [auth, setAuth] = useState(false),
    [authMode, setAuthMode] = useState<"login" | "signup">("login"),
    [settings, setSettings] = useState(false),
    [guest, setGuest] = useState(false),
    [plans, setPlans] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const actionBusy = useRef(false);
  // For a lapsed session: whether someone was signed in, whether they are
  // signing out on purpose, and whether sign-in has been offered already.
  const signedInRef = useRef(false),
    signingOut = useRef(false),
    signInOffered = useRef(false);
  const refresh = useCallback(async () => {
    const data = await api("state");
    // A lapsed session reads as signed out. Keep the open workspace and any
    // unsaved work, and ask for sign-in instead.
    if (!data.user && signedInRef.current && !signingOut.current) {
      window.dispatchEvent(
        new CustomEvent("menu-material:signed-out", {
          detail: { path: "state" },
        }),
      );
      return;
    }
    signedInRef.current = !!data.user;
    if (data.user) signInOffered.current = false;
    setState(data);
    setLoaded(true);
    setSessionCheck("done");
  }, []);
  const load = useCallback(
    () =>
      refresh().catch((e) => {
        if (hasSession) {
          // Server errors carry a status and a readable message; a failed
          // fetch (offline, DNS) only has the browser's terse one.
          setSessionError(
            e.status ? e.message : "Check your connection and try again.",
          );
          setSessionCheck("failed");
        } else setError(e.message);
        setLoaded(true);
      }),
    [refresh, hasSession],
  );
  // With a session cookie the workspace is the likely destination: download
  // its code alongside /api/state rather than after it answers.
  useEffect(() => {
    if (hasSession) loadCoreWorkspace().catch(() => {});
  }, [hasSession]);
  useEffect(() => {
    void load();
  }, [load]);
  // Any other code-split file that fails to load after a deploy.
  useEffect(() => reloadOnPreloadError(), []);
  useEffect(() => {
    if (state.user?.id) void api("events", { kind: "visit" }).catch(() => {});
  }, [state.user?.id]);
  useEffect(() => {
    let cancelled = false;
    // Without a session cookie the visitor is signed out, so a #studio link
    // can open the guest studio before /api/state answers.
    if ((loaded || !hasSession) && !state.user && location.hash === "#studio")
      setGuest(true);
    if (loaded && state.user && location.hash === "#studio") {
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
    }
    if (loaded && new URLSearchParams(location.search).has("upgrade")) {
      if (state.user) {
        setPlans(true);
        // Handled; a reload shouldn't reopen Plans.
        forgetParam("upgrade");
      } else {
        setAuthMode("signup");
        setAuth(true);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [loaded, hasSession, state.user?.id, state.restaurant?.id]);
  // Back and Forward move between the home page and the guest studio.
  const signedIn = !!state.user;
  useEffect(() => {
    if ((!loaded && hasSession) || signedIn) return;
    const follow = () => setGuest(location.hash === "#studio");
    window.addEventListener("popstate", follow);
    return () => window.removeEventListener("popstate", follow);
  }, [loaded, hasSession, signedIn]);
  useEffect(() => {
    const open = () => setPlans(true);
    window.addEventListener("menu-material:plans", open);
    return () => window.removeEventListener("menu-material:plans", open);
  }, []);
  // lib/client.ts reports a 401: the session ended while the workspace was
  // open. Offer sign-in over the current screen, which stays as it is.
  useEffect(() => {
    const signedOut = (event: Event) => {
      if (!signedInRef.current) return;
      const path = (event as CustomEvent<{ path?: string }>).detail?.path;
      // Background checks (job progress, visit counts) offer it once; the
      // person's own actions offer it every time.
      if (
        signInOffered.current &&
        /^(jobs\/|events|creation-events)/.test(path || "")
      )
        return;
      signInOffered.current = true;
      setAuthMode("login");
      setAuth(true);
    };
    window.addEventListener("menu-material:signed-out", signedOut);
    return () =>
      window.removeEventListener("menu-material:signed-out", signedOut);
  }, []);
  useEffect(() => {
    if (state.user && new URLSearchParams(location.search).has("billing"))
      setPlans(true);
  }, [state.user?.id]);
  const working = !!(
    state.user &&
    (state.batchItems?.some((b: Row) => b.status === "queued") ||
      state.jobs?.some((j: Row) => ["queued", "processing"].includes(j.status)))
  );
  useEffect(() => {
    if (!working) return;
    return watchJobs({
      advance: () => api("jobs/tick", {}),
      status: () => api("jobs/status"),
      reload: refresh,
    });
  }, [working, refresh]);
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
  if (sessionCheck === "pending")
    return <Opening title="Menu Material" message="Getting things ready…" />;
  if (sessionCheck === "failed")
    return (
      <main className="initial-loading">
        <Brand />
        <WorkspacePlaceholder
          title="Menu Material"
          failed
          message="Your workspace couldn’t be opened."
          failureDetail={`${sessionError} Your saved work is kept.`}
          onRetry={() => {
            setSessionCheck("pending");
            void load();
          }}
        />
      </main>
    );
  return (
    <>
      {guest ? (
        <Suspense
          fallback={
            <Opening title="Photo Studio" message="Opening Photo Studio…" />
          }
        >
          {!loaded ? (
            // The guest studio needs /api/state (e.g. studio availability).
            <Opening title="Photo Studio" message="Opening Photo Studio…" />
          ) : (
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
          )}
        </Suspense>
      ) : !state.user ? (
        <Landing
          signedIn={!!state.user}
          onStart={() => {
            rememberScroll();
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
            <Opening title="Your workspace" message="Opening your workspace…" />
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
                signingOut.current = true;
                try {
                  await api("auth/logout", {});
                  const { clearExportImages } =
                    await import("@/lib/offer-export");
                  clearExportImages();
                  // Leave no workspace view or one-time query behind.
                  history.replaceState(null, "", location.pathname);
                  await refresh();
                } finally {
                  signingOut.current = false;
                }
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
        <div
          className="landing-error error"
          role="alert"
          // The banner can show over an open dialog; using it must not count
          // as a click outside that closes the dialog. React and the dialog
          // both listen on the document, and React's listener runs first.
          onPointerDown={(event) =>
            event.nativeEvent.stopImmediatePropagation()
          }
        >
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
        billingEnabled={!!(state.billing?.enabled ?? state.billingEnabled)}
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
