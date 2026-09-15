"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Sparkles,
  ArrowRight,
  ImagePlus,
  UtensilsCrossed,
  Images,
  BookOpen,
  Check,
  Plus,
  Settings,
  LogOut,
  Download,
  RefreshCw,
  Trash2,
  Copy,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pick, ConfirmDelete } from "./components/controls";
import MenuTools from "./components/menu-tools";
import { clearExportImages } from "@/lib/offer-export";
import PromotionWorkspace from "./components/promotion-workspace";
import RestaurantStyle from "./components/restaurant-style";
import Auth from "./components/auth";
import Landing from "./components/plateworthy-landing";
import Brand from "./components/brand";
import CoreWorkspace from "./components/core-workspace";
import MenuView from "./components/menu-view";
import {
  api,
  downloadBlob,
  exportImage,
  money,
  normalizePhoto,
  Row,
} from "@/lib/client";
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
    [overview, setOverview] = useState(false),
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
    }, 5000);
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
      {!state.user || overview ? (
        <Landing
          signedIn={!!state.user}
          onStart={() => {
            if (state.user) {
              setOverview(false);
              return;
            }
            setAuthMode("signup");
            setAuth(true);
          }}
          onSignIn={() => {
            if (state.user) {
              setOverview(false);
              return;
            }
            setAuthMode("login");
            setAuth(true);
          }}
        />
      ) : (
        <CoreWorkspace
          state={state}
          refresh={refresh}
          onOverview={() => setOverview(true)}
          onSettings={() => setSettings(true)}
          onLogout={() =>
            act("Signing out", async () => {
              await api("auth/logout", {});
              clearExportImages();
              await refresh();
            })
          }
          adminContent={<Admin act={act} refresh={refresh} busy={busy} />}
        />
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
          setOverview(false);
        }}
      />
      <SettingsPanel
        open={settings}
        close={() => setSettings(false)}
        state={state}
        act={act}
        refresh={refresh}
        busy={busy}
      />
      {!loaded && (
        <div className="loading-strip" role="status">
          Opening your workspace…
        </div>
      )}
    </>
  );
}
function SettingsPanel({ open, close, state, act, refresh, busy }: any) {
  const [profile, setProfile] = useState<Row>({
    name: "",
    cuisine: "",
    brand: "",
    currency: "USD",
  });
  useEffect(() => {
    if (state.restaurant)
      setProfile({
        name: state.restaurant.name,
        cuisine: state.restaurant.cuisine,
        brand: state.restaurant.brand,
        currency: state.restaurant.currency,
        style: state.restaurant.style,
        timezone: state.restaurant.timezone,
        orderingUrl: state.restaurant.ordering_url,
        hours: state.restaurant.hours,
      });
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="restaurant-dialog">
        <DialogHeader>
          <DialogTitle>Your restaurant</DialogTitle>
          <DialogDescription>
            A few details to keep your workspace and menu consistent.
          </DialogDescription>
        </DialogHeader>
        {["name", "cuisine", "brand"].map((k) => (
          <label className="field" key={k}>
            {k === "name"
              ? "Restaurant name"
              : k === "cuisine"
                ? "Cuisine"
                : "Brand preferences"}
            <input
              value={profile[k]}
              onChange={(e) => setProfile({ ...profile, [k]: e.target.value })}
            />
          </label>
        ))}
        <label className="field">
          Menu currency
          <Pick
            label="Currency"
            value={profile.currency}
            onChange={(v) => setProfile({ ...profile, currency: v })}
            options={["USD", "GBP", "EUR", "JPY", "CAD", "AUD"].map((v) => ({
              value: v,
              label: v,
            }))}
          />
        </label>
        <label className="field">
          Logo (optional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/heic,.heic"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                act("Saving logo", async () => {
                  const form = new FormData();
                  form.set("file", f);
                  form.set("normalized", await normalizePhoto(f), "logo.jpg");
                  form.set("kind", "logo");
                  await api("assets", form);
                  await refresh();
                });
            }}
          />
        </label>
        <RestaurantStyle
          {...{ profile, setProfile, state, act, refresh, busy }}
        />
        <Button
          disabled={!!busy}
          onClick={() =>
            act("Saving restaurant", async () => {
              await api("restaurant", profile);
              await refresh();
              close();
            })
          }
        >
          Save restaurant
        </Button>
        <p className="fine">
          Your published menu changes only when you republish.
        </p>
      </DialogContent>
    </Dialog>
  );
}
function Admin({ act, refresh, busy }: any) {
  const [data, setData] = useState<Row | null>(null),
    [email, setEmail] = useState(""),
    [allowance, setAllowance] = useState(20),
    [link, setLink] = useState(""),
    [reset, setReset] = useState(false);
  const load = useCallback(async () => setData(await api("admin")), []);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);
  return (
    <section className="admin-panel">
      <div className="section-toolbar">
        <h2>Pilot administration</h2>
        <Button variant="outline" onClick={() => act("Refreshing pilot", load)}>
          Refresh
        </Button>
      </div>
      <div className="admin-invite">
        <label className="field">
          Invite email
          <input
            value={email}
            type="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@restaurant.com"
          />
        </label>
        <label className="field">
          Free image allowance
          <input
            value={allowance}
            min={0}
            max={10000}
            type="number"
            onChange={(e) => setAllowance(Number(e.target.value))}
          />
        </label>
        <Button
          disabled={!!busy}
          onClick={() =>
            act("Creating invitation", async () => {
              const r = await api("admin/invite", { email, allowance, reset });
              setLink(location.origin + r.path);
              await load();
            })
          }
        >
          {reset ? "Create password reset" : "Create invitation"}
        </Button>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={reset}
          onChange={(e) => setReset(e.target.checked)}
        />
        Create a password reset for an existing account
      </label>
      {link && (
        <div className="invitation-result">
          <p>
            Share this invitation directly with the restaurant owner. It expires
            in 7 days.
          </p>
          <input aria-label="Invitation link" readOnly value={link} />
          <Button
            variant="outline"
            onClick={() =>
              act("Copying invite", async () =>
                navigator.clipboard.writeText(link),
              )
            }
          >
            <Copy />
            Copy invitation
          </Button>
        </div>
      )}
      <div className="admin-restaurants">
        {data?.restaurants.map((r: Row) => (
          <AdminRestaurant
            key={r.id}
            restaurant={r}
            act={act}
            refresh={async () => {
              await load();
              await refresh();
            }}
          />
        ))}
      </div>
      <p className="fine">
        Costs are estimates when a per-image estimate is configured. Provider
        usage records are retained for invoice reconciliation, including
        failures and retries.
      </p>
      {data && (
        <details className="admin-details">
          <summary>Recent quality and usage events</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e: Row) => (
                  <tr key={e.id}>
                    <td>{new Date(e.created_at).toLocaleString()}</td>
                    <td>{e.kind}</td>
                    <td>{e.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
function AdminRestaurant({ restaurant: r, act, refresh }: any) {
  const [allowance, setAllowance] = useState(r.allowance),
    [paused, setPaused] = useState(!!r.paused),
    [minutes, setMinutes] = useState(15);
  return (
    <div className="admin-restaurant">
      <div>
        <h3>{r.name}</h3>
        <p>{r.email}</p>
        <p>
          {r.completed} completed · {r.reserved} reserved · {r.failed} failed ·{" "}
          {r.approved} approved
        </p>
        <small>
          {r.approved > 0 && (
            <span>
              {Math.round((r.support_minutes || 0) / r.approved)} support min
              per approved image ·{" "}
            </span>
          )}
          {r.cost_estimate === null
            ? "Cost estimate not configured"
            : `Estimated provider cost: $${Number(r.cost_estimate).toFixed(2)}`}{" "}
          · {r.support_minutes || 0} support minutes
        </small>
      </div>
      <div className="admin-row-controls">
        <label className="field">
          Total allowance
          <input
            aria-label={`Allowance for ${r.name}`}
            type="number"
            min={0}
            value={allowance}
            onChange={(e) => setAllowance(Number(e.target.value))}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={paused}
            onChange={(e) => setPaused(e.target.checked)}
          />
          Pause images
        </label>
        <Button
          variant="outline"
          onClick={() =>
            act("Updating allowance", async () => {
              await api("admin/restaurant", { id: r.id, allowance, paused });
              await refresh();
            })
          }
        >
          Save
        </Button>
      </div>
      <div className="support-entry">
        <label className="field">
          Support minutes
          <input
            type="number"
            min={1}
            max={600}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <Button
          variant="outline"
          onClick={() =>
            act("Recording support time", async () => {
              await api("admin/support", { restaurantId: r.id, minutes });
              await refresh();
            })
          }
        >
          Log time
        </Button>
      </div>
    </div>
  );
}
