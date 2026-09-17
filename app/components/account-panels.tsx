"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pick } from "./controls";
import { StudioReleasePanel } from "./studio-release-panel";
import { StudioProgressPanel } from "./studio-progress-panel";
import RestaurantStyle from "./restaurant-style";
import { api, normalizePhoto, type Row } from "@/lib/client";
export function SettingsPanel({ open, close, state, act, refresh, busy }: any) {
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
export function Admin({ act, refresh, busy }: any) {
  const [data, setData] = useState<Row | null>(null),
    [email, setEmail] = useState(""),
    [allowance, setAllowance] = useState(5),
    [link, setLink] = useState(""),
    [reset, setReset] = useState(false),
    [loadError, setLoadError] = useState("");
  const load = useCallback(async () => setData(await api("admin")), []);
  useEffect(() => {
    load().catch((e) => setLoadError(e.message));
  }, [load]);
  return (
    <section className="admin-panel">
      <div className="section-toolbar">
        <h2>Administration</h2>
        <Button
          variant="outline"
          onClick={() => act("Refreshing administration", load)}
        >
          Refresh
        </Button>
      </div>
      {loadError && <p role="alert">{loadError}</p>}
      {data && data.photoCorrections?.length > 0 && (
        <section className="cx-panel">
          <h3>Food reports awaiting review</h3>
          <p>
            Review the original and reported photo before resolving the report.
            Restoring an image affects allowance only.
          </p>
          {data.photoCorrections.map((report: Row) => (
            <FoodReportReview
              key={report.original_job_id}
              report={report}
              busy={busy}
              act={act}
              done={async () => {
                await load();
                await refresh();
              }}
            />
          ))}
        </section>
      )}
      {data && (
        <AiOperations
          key={JSON.stringify(data.controls)}
          data={data}
          act={act}
          busy={busy}
          load={load}
        />
      )}
      {data?.studioRelease && (
        <StudioReleasePanel
          key={data.studioRelease.revision}
          data={data}
          busy={busy}
          act={act}
          done={async () => {
            await load();
            await refresh();
          }}
        />
      )}
      {data && <StudioProgressPanel />}
      <div className="admin-invite">
        <label className="field">
          Invite email
          <input
            id="admin-invite-email"
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
function FoodReportReview({ report, busy, act, done }: any) {
  const [resolution, setResolution] = useState("");
  return (
    <div className="ps2-review-report">
      <b>
        {report.restaurant_name} · {report.reason}
      </b>
      <p>{report.detail || "No additional detail."}</p>
      <div className="ps2-review-images">
        {report.source_id && (
          <a
            href={`/api/admin/photo-correction/${report.original_job_id}/original`}
            target="_blank"
            rel="noreferrer"
          >
            Open original
          </a>
        )}
        <a
          href={`/api/admin/photo-correction/${report.original_job_id}/reported`}
          target="_blank"
          rel="noreferrer"
        >
          Open reported photo
        </a>
      </div>
      <label className="field">
        Reply visible to the owner
        <textarea
          value={resolution}
          maxLength={500}
          onChange={(e) => setResolution(e.target.value)}
        />
      </label>
      {["restore", "resolve"].map((action) => (
        <Button
          key={action}
          variant="outline"
          disabled={!!busy || resolution.trim().length < 5}
          onClick={() =>
            act("Resolving food report", async () => {
              await api("admin/photo-correction", {
                originalJobId: report.original_job_id,
                action,
                resolution,
              });
              await done();
            })
          }
        >
          {action === "restore"
            ? "Restore 1 image and resolve"
            : "Resolve with reply"}
        </Button>
      ))}
    </div>
  );
}
function AdminRestaurant({ restaurant: r, act, refresh }: any) {
  const [allowance, setAllowance] = useState(r.allowance),
    [paused, setPaused] = useState(!!r.paused),
    [budget, setBudget] = useState(r.daily_budget_cents / 100),
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
          Daily AI budget (USD)
          <input
            aria-label={`Daily AI budget for ${r.name}`}
            type="number"
            min={0}
            max={10000}
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
        </label>
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
          Pause all new AI work
        </label>
        <Button
          variant="outline"
          onClick={() =>
            act("Updating allowance", async () => {
              await api("admin/restaurant", {
                id: r.id,
                allowance,
                paused,
                dailyBudgetCents: Math.round(budget * 100),
              });
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

function AiOperations({ data, act, busy, load }: any) {
  const [paused, setPaused] = useState(!!data.controls.paused),
    [budget, setBudget] = useState(data.controls.dailyBudgetCents / 100);
  const total =
    data.spend.reduce((sum: number, row: Row) => sum + Number(row.cents), 0) /
    100;
  const fresh = data.worker.lastSeen > Date.now() - 120000;
  return (
    <section className="cx-panel pw-ai-controls">
      <h3>AI operations</h3>
      <p role="status">
        {fresh
          ? "Background runner checked in recently."
          : data.worker.configured
            ? "Background runner has not checked in recently. Check its service."
            : "Background runner is not configured. Open workspaces can still progress jobs."}
        {!!data.worker.lastSeen && (
          <> Last check: {new Date(data.worker.lastSeen).toLocaleString()}.</>
        )}
      </p>
      <p>
        <strong>${total.toFixed(2)}</strong> reserved against today’s estimated
        AI budget. Budgets reset at midnight UTC. Reservations include captions,
        image guidance, menu reading and images; uncertain requests remain
        counted.
      </p>
      <div className="admin-row-controls">
        <label className="field">
          Site-wide daily AI budget (USD)
          <input
            type="number"
            min={0}
            max={10000}
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={paused}
            onChange={(e) => setPaused(e.target.checked)}
          />
          Pause all new AI work
        </label>
        <Button
          disabled={!!busy}
          onClick={() =>
            act("Saving AI controls", async () => {
              await api("admin/ai-controls", {
                paused,
                dailyBudgetCents: Math.round(budget * 100),
              });
              await load();
            })
          }
        >
          Save AI controls
        </Button>
      </div>
      <p className="fine">
        These limits use configured cost estimates, not invoice totals.
        Completed and uncertain requests may still incur provider charges.
        Pausing stops new submissions; results already in progress are still
        recovered. Originals and image quality settings are unchanged.
      </p>
    </section>
  );
}
