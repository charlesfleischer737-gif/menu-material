"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioReleasePanel } from "./studio-release-panel";
import { StudioProgressPanel } from "./studio-progress-panel";
import { api, type Row } from "@/lib/client";
import CreativeHeader from "./creative-header";
import WorkspacePlaceholder from "./workspace-placeholder";
import {
  AdminOperationStatus,
  useAdminOperation,
  type AdminAction,
} from "./admin-operation";
export { default as SettingsPanel } from "./restaurant-settings";
type AdminProps = {
  act: AdminAction;
  refresh: () => Promise<void>;
  busy: string;
};
export function Admin({ act, refresh, busy }: AdminProps) {
  const [data, setData] = useState<Row | null>(null),
    [email, setEmail] = useState(""),
    [allowance, setAllowance] = useState(5),
    [link, setLink] = useState(""),
    [reset, setReset] = useState(false),
    [loadError, setLoadError] = useState(""),
    [loading, setLoading] = useState(true),
    [checkedAt, setCheckedAt] = useState(0);
  const loadRequest = useRef<Promise<void> | null>(null);
  const invite = useAdminOperation(act, busy);
  const aiOperation = useAdminOperation(act, busy);
  const availabilityOperation = useAdminOperation(act, busy);
  const load = useCallback(() => {
    if (loadRequest.current) return loadRequest.current;
    const request = api("admin")
      .then((next) => {
        setData(next);
        setCheckedAt(Date.now());
        setLoadError("");
      })
      .catch((error) => {
        setLoadError((error as Error).message);
        throw error;
      })
      .finally(() => {
        loadRequest.current = null;
        setLoading(false);
      });
    loadRequest.current = request;
    return request;
  }, []);
  useEffect(() => {
    void load().catch(() => {});
  }, [load]);
  function reload() {
    setLoading(true);
    void load().catch(() => {});
  }
  return (
    <section className="admin-panel">
      <CreativeHeader
        title="Administration"
        action={
          <Button
            variant="outline"
            className="admin-refresh"
            disabled={!!busy || loading}
            onClick={reload}
          >
            {loading ? "Refreshing…" : loadError ? "Retry" : "Refresh"}
          </Button>
        }
      />
      {!data && (
        <WorkspacePlaceholder
          title="Administration"
          contentOnly
          layout="operations"
          failed={!loading && !!loadError}
          message={loading ? "Loading restaurant operations…" : loadError}
          failureDetail="Your restaurant data is kept. Use Retry above to load it again."
        />
      )}
      {data && (
        <p
          className="admin-load-status"
          role={loadError && !loading ? "alert" : "status"}
        >
          {loading
            ? "Refreshing restaurant operations…"
            : loadError
              ? `Administration couldn’t refresh. ${loadError} Use Retry above.`
              : "Restaurant operations are up to date."}
        </p>
      )}
      {data && data.photoCorrections?.length > 0 && (
        <section className="cx-panel">
          <h2>Food reports awaiting review</h2>
          <p>
            Review the original and reported photo before resolving the report.
            Restoring an image affects allowance only.
          </p>
          {data.photoCorrections.map((report: Row) => (
            <FoodReportReview
              key={report.original_job_id}
              report={report}
              busy={busy || (loading ? "Refreshing administration" : "")}
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
          busy={busy || (loading ? "Refreshing administration" : "")}
          load={load}
          operation={aiOperation}
          checkedAt={checkedAt}
        />
      )}
      {data?.studioRelease && (
        <StudioReleasePanel
          key={data.studioRelease.revision}
          data={data}
          busy={busy || (loading ? "Refreshing administration" : "")}
          operation={availabilityOperation}
          done={async () => {
            await load();
            await refresh();
          }}
        />
      )}
      {data && <StudioProgressPanel />}
      {data && (
        <section className="admin-access-panel">
          <h2>Account access</h2>
          <p className="muted">
            Create an invitation or a secure reset link to share directly with a
            restaurant owner.
          </p>
          <div className="admin-invite">
            <label className="field">
              Invite email
              <input
                disabled={!!busy || loading}
                id="admin-invite-email"
                value={email}
                type="email"
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLink("");
                  invite.changed("");
                }}
                placeholder="owner@restaurant.com"
              />
            </label>
            <label className="field">
              Free images
              <input
                disabled={!!busy || loading}
                value={allowance}
                min={0}
                max={10000}
                type="number"
                onChange={(e) => {
                  setAllowance(Number(e.target.value));
                  setLink("");
                  invite.changed("");
                }}
              />
            </label>
            <Button
              disabled={!!busy || loading || !email.trim()}
              onClick={() =>
                invite.run(
                  reset ? "Creating reset link" : "Creating invitation",
                  reset
                    ? "Reset link created. Share it directly with the owner."
                    : "Invitation created. Share it directly with the owner.",
                  async () => {
                    const r = await api("admin/invite", {
                      email,
                      allowance,
                      reset,
                    });
                    setLink(location.origin + r.path);
                    await load();
                  },
                )
              }
            >
              {reset ? "Create password reset" : "Create invitation"}
            </Button>
          </div>
          <label className="check-label">
            <input
              disabled={!!busy || loading}
              type="checkbox"
              checked={reset}
              onChange={(e) => {
                setReset(e.target.checked);
                setLink("");
                invite.changed("");
              }}
            />
            Create a password reset for an existing account
          </label>
          <AdminOperationStatus feedback={invite.feedback} />
          {link && (
            <div className="invitation-result">
              <p>
                Share this {reset ? "reset link" : "invitation"} directly with
                the restaurant owner. It expires in 7 days.
              </p>
              <input
                aria-label={reset ? "Reset link" : "Invitation link"}
                readOnly
                value={link}
              />
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  invite.run("Copying link", "Link copied.", async () =>
                    navigator.clipboard.writeText(link),
                  )
                }
              >
                <Copy />
                {reset ? "Copy reset link" : "Copy invitation"}
              </Button>
            </div>
          )}
        </section>
      )}
      {data && (
        <OpenLinks
          invites={data.invites}
          busy={busy || (loading ? "Refreshing administration" : "")}
          act={act}
          done={load}
        />
      )}
      {data && (
        <LaunchRequests
          requests={data.requests}
          busy={busy || (loading ? "Refreshing administration" : "")}
          act={act}
          done={load}
        />
      )}
      {data && (
        <ReleaseAddress
          busy={busy || (loading ? "Refreshing administration" : "")}
          act={act}
          done={load}
        />
      )}
      {data && (
        <h2 className="admin-section-title">
          Restaurants <span>{data.restaurants.length}</span>
        </h2>
      )}
      {data && !data.restaurants.length && (
        <p className="cx-empty">
          No restaurants yet. Create an invitation to welcome the first owner.
        </p>
      )}
      <div className="admin-restaurants">
        {data?.restaurants.map((r: Row) => (
          <AdminRestaurant
            key={r.id}
            restaurant={r}
            busy={busy || (loading ? "Refreshing administration" : "")}
            act={act}
            refresh={async () => {
              await load();
              await refresh();
            }}
          />
        ))}
      </div>
      {data && (
        <p className="fine">
          Costs are estimates when a per-image estimate is configured. Provider
          usage records are retained for invoice reconciliation, including
          failures and retries.
        </p>
      )}
      {data && (
        <details className="admin-details">
          <summary>Recent quality and usage events</summary>
          {data.events.length ? (
            <div
              className="table-scroll"
              role="region"
              aria-label="Recent quality and usage events"
              tabIndex={0}
            >
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
          ) : (
            <p className="admin-empty-note">
              No quality or usage events have been recorded yet.
            </p>
          )}
        </details>
      )}
    </section>
  );
}
const linkKinds: Record<string, string> = {
  owner: "Invitation",
  reset: "Password reset",
  admin: "Administrator setup",
};
/** Links that still work, so a link shared by mistake can be stopped. */
function OpenLinks({
  invites,
  busy,
  act,
  done,
}: {
  invites: Row[];
  busy: string;
  act: AdminAction;
  done: () => Promise<void>;
}) {
  const operation = useAdminOperation(act, busy);
  return (
    <details className="admin-details">
      <summary>Open invitations and reset links ({invites.length})</summary>
      {invites.length ? (
        <div
          className="table-scroll"
          role="region"
          aria-label="Open invitations and reset links"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Link</th>
                <th>Expires</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.email}</td>
                  <td>
                    {linkKinds[invite.role] || invite.role}
                    {invite.role === "owner" &&
                      ` · ${invite.allowance} free images`}
                  </td>
                  <td>{new Date(invite.expires_at).toLocaleString()}</td>
                  <td>
                    <Button
                      variant="outline"
                      disabled={!!busy}
                      aria-label={`Revoke ${(linkKinds[invite.role] || "link").toLowerCase()} for ${invite.email}`}
                      onClick={() =>
                        operation.run(
                          "Revoking link",
                          "Link revoked. It no longer works.",
                          async () => {
                            await api("admin/invite-revoke", { id: invite.id });
                            await done();
                          },
                        )
                      }
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-empty-note">No open invitations or reset links.</p>
      )}
      <AdminOperationStatus feedback={operation.feedback} />
    </details>
  );
}
const requestKinds: Record<string, string> = {
  access: "Early access",
  pro: "Pro waitlist",
};
function LaunchRequests({
  requests,
  busy,
  act,
  done,
}: {
  requests: Row[];
  busy: string;
  act: AdminAction;
  done: () => Promise<void>;
}) {
  const operation = useAdminOperation(act, busy);
  const fresh = requests.filter((request) => request.status === "new").length;
  return (
    <details className="admin-details">
      <summary>
        Requests ({fresh} new of {requests.length})
      </summary>
      {requests.length ? (
        <div
          className="table-scroll"
          role="region"
          aria-label="Requests"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Received</th>
                <th>Request</th>
                <th>Email</th>
                <th>Restaurant</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{new Date(request.created_at).toLocaleString()}</td>
                  <td>{requestKinds[request.kind] || request.kind}</td>
                  <td>{request.email}</td>
                  <td>{request.restaurant}</td>
                  <td>{request.status === "new" ? "New" : "Reviewed"}</td>
                  <td>
                    <Button
                      variant="outline"
                      disabled={!!busy}
                      aria-label={`Mark the request from ${request.email} as ${request.status === "new" ? "reviewed" : "new"}`}
                      onClick={() =>
                        operation.run(
                          "Updating request",
                          "Request updated.",
                          async () => {
                            await api("admin/access-request", {
                              id: request.id,
                              status:
                                request.status === "new" ? "reviewed" : "new",
                            });
                            await done();
                          },
                        )
                      }
                    >
                      {request.status === "new" ? "Mark reviewed" : "Mark new"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-empty-note">No requests yet.</p>
      )}
      <AdminOperationStatus feedback={operation.feedback} />
    </details>
  );
}
/** Free a menu address someone is holding. */
function ReleaseAddress({
  busy,
  act,
  done,
}: {
  busy: string;
  act: AdminAction;
  done: () => Promise<void>;
}) {
  const [address, setAddress] = useState("");
  const operation = useAdminOperation(act, busy);
  return (
    <details className="admin-details">
      <summary>Menu addresses</summary>
      <p className="admin-empty-note">
        Release an address a restaurant is holding. An earlier address stops
        opening its menu. A restaurant using the address moves to an automatic
        one, and links to the released address stop working.
      </p>
      <div className="admin-row-controls">
        <label className="field" style={{ flex: "1 1 240px" }}>
          Menu address
          <input
            disabled={!!busy}
            value={address}
            placeholder="joes-pizza"
            onChange={(e) => {
              setAddress(e.target.value.trim().toLowerCase());
              operation.changed("");
            }}
          />
        </label>
        <Button
          variant="outline"
          disabled={!!busy || !address}
          onClick={() =>
            operation.run(
              "Releasing address",
              "Address released. It can be chosen again.",
              async () => {
                await api("admin/release-address", { address });
                setAddress("");
                await done();
              },
            )
          }
        >
          Release address
        </Button>
      </div>
      <AdminOperationStatus feedback={operation.feedback} />
    </details>
  );
}
function FoodReportReview({
  report,
  busy,
  act,
  done,
}: {
  report: Row;
  busy: string;
  act: AdminAction;
  done: () => Promise<void>;
}) {
  const [resolution, setResolution] = useState("");
  const operation = useAdminOperation(act, busy);
  return (
    <div className="ps2-review-report">
      <b>
        {report.restaurant_name} · {report.reason}
      </b>
      <p>{report.detail || "No additional detail."}</p>
      <div className="ps2-review-images">
        {report.source_id && (
          <Button asChild variant="outline">
            <a
              href={`/api/admin/photo-correction/${report.original_job_id}/original`}
              target="_blank"
              rel="noreferrer"
            >
              Open original
            </a>
          </Button>
        )}
        <Button asChild variant="outline">
          <a
            href={`/api/admin/photo-correction/${report.original_job_id}/reported`}
            target="_blank"
            rel="noreferrer"
          >
            Open reported photo
          </a>
        </Button>
      </div>
      <label className="field">
        Reply visible to the owner
        <textarea
          disabled={!!busy}
          value={resolution}
          maxLength={500}
          onChange={(e) => {
            setResolution(e.target.value);
            operation.changed("Reply not sent.");
          }}
        />
      </label>
      <div className="button-row">
        {["restore", "resolve"].map((action) => (
          <Button
            key={action}
            variant="outline"
            disabled={!!busy || resolution.trim().length < 5}
            onClick={() =>
              operation.run(
                "Resolving food report",
                "Food report resolved.",
                async () => {
                  await api("admin/photo-correction", {
                    originalJobId: report.original_job_id,
                    action,
                    resolution,
                  });
                  await done();
                },
              )
            }
          >
            {action === "restore"
              ? "Restore 1 image and resolve"
              : "Resolve with reply"}
          </Button>
        ))}
      </div>
      <AdminOperationStatus feedback={operation.feedback} />
    </div>
  );
}
// A comp's last day, in the administrator's own calendar.
function compDate(ms: number | null) {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function AdminRestaurant({
  restaurant: r,
  act,
  refresh,
  busy,
}: AdminProps & { restaurant: Row }) {
  const [allowance, setAllowance] = useState(r.allowance),
    [paused, setPaused] = useState(!!r.paused),
    [proUntil, setProUntil] = useState(compDate(r.pro_until)),
    [budget, setBudget] = useState(r.daily_budget_cents / 100),
    [minutes, setMinutes] = useState(15);
  const settings = useAdminOperation(act, busy);
  const support = useAdminOperation(act, busy);
  const takedown = useAdminOperation(act, busy);
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
            disabled={!!busy}
            aria-label={`Daily AI budget for ${r.name}`}
            type="number"
            min={0}
            max={10000}
            step="0.01"
            value={budget}
            onChange={(e) => {
              setBudget(Number(e.target.value));
              settings.changed();
            }}
          />
        </label>
        <label className="field">
          Free-plan images
          <small>Pro uses its plan’s allowance instead.</small>
          <input
            disabled={!!busy}
            aria-label={`Free-plan images for ${r.name}`}
            type="number"
            min={0}
            value={allowance}
            onChange={(e) => {
              setAllowance(Number(e.target.value));
              settings.changed();
            }}
          />
        </label>
        <label className="field">
          Pro features until
          <small>Leave empty for none. Doesn’t add images.</small>
          <input
            disabled={!!busy}
            aria-label={`Pro features until, for ${r.name}`}
            type="date"
            value={proUntil}
            onChange={(e) => {
              setProUntil(e.target.value);
              settings.changed();
            }}
          />
        </label>
        <label className="check-label">
          <input
            aria-label={`Pause new AI work for ${r.name}`}
            disabled={!!busy}
            type="checkbox"
            checked={paused}
            onChange={(e) => {
              setPaused(e.target.checked);
              settings.changed();
            }}
          />
          Pause all new AI work
        </label>
        <Button
          variant="outline"
          disabled={!!busy}
          aria-label={`Save controls for ${r.name}`}
          onClick={() =>
            settings.run(
              "Saving restaurant controls",
              "Restaurant controls saved.",
              async () => {
                await api("admin/restaurant", {
                  id: r.id,
                  allowance,
                  paused,
                  dailyBudgetCents: Math.round(budget * 100),
                  proUntil: proUntil
                    ? new Date(`${proUntil}T23:59:59`).getTime()
                    : null,
                });
                await refresh();
              },
            )
          }
        >
          Save controls
        </Button>
      </div>
      <AdminOperationStatus
        feedback={settings.feedback}
        dirty={
          budget !== r.daily_budget_cents / 100 ||
          allowance !== r.allowance ||
          paused !== !!r.paused ||
          proUntil !== compDate(r.pro_until)
        }
      />
      <div className="support-entry">
        <label className="field">
          Support minutes
          <input
            aria-label={`Support minutes for ${r.name}`}
            disabled={!!busy}
            type="number"
            min={1}
            max={600}
            value={minutes}
            onChange={(e) => {
              setMinutes(Number(e.target.value));
              support.changed("");
            }}
          />
        </label>
        <Button
          variant="outline"
          aria-label={`Log support time for ${r.name}`}
          disabled={!!busy}
          onClick={() =>
            support.run(
              "Recording support time",
              "Support time recorded.",
              async () => {
                await api("admin/support", { restaurantId: r.id, minutes });
                await refresh();
              },
            )
          }
        >
          Log time
        </Button>
      </div>
      <AdminOperationStatus feedback={support.feedback} />
      <div className="support-entry">
        <p>
          {r.public_suspended
            ? "Public menu pages and specials are offline. The owner can’t publish until you restore them."
            : `Public menu pages are at /m/${r.slug}.`}
        </p>
        <Button
          variant="outline"
          disabled={!!busy}
          aria-label={`${r.public_suspended ? "Restore" : "Take offline"} public menu pages for ${r.name}`}
          onClick={() => {
            if (
              !r.public_suspended &&
              !window.confirm(
                `Take ${r.name}’s public menu pages and specials offline? Guests will see “not found” until you restore them.`,
              )
            )
              return;
            takedown.run(
              r.public_suspended
                ? "Restoring public pages"
                : "Taking public pages offline",
              r.public_suspended
                ? "Public pages restored."
                : "Public pages are offline.",
              async () => {
                await api("admin/takedown", {
                  id: r.id,
                  offline: !r.public_suspended,
                });
                await refresh();
              },
            );
          }}
        >
          {r.public_suspended
            ? "Restore public pages"
            : "Take public pages offline"}
        </Button>
      </div>
      <AdminOperationStatus feedback={takedown.feedback} />
    </div>
  );
}

const readinessLabels: Record<string, string> = {
  database: "Database",
  storage: "File storage",
  worker: "Background worker",
  queue: "Job queue",
  aiBudget: "AI budget",
};
const ago = (seconds: number) =>
  seconds < 120 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
function readinessDetail(name: string, check: Row) {
  if (check.error) return check.error;
  if (name === "worker")
    return !check.configured
      ? "JOB_RUNNER_SECRET is not set"
      : check.ageSeconds === null
        ? "has never checked in"
        : `checked in ${ago(check.ageSeconds)} ago`;
  if (name === "queue")
    return `${check.queued} queued, ${check.inProgress} in progress${
      check.oldestQueuedSeconds !== null
        ? `; oldest waiting ${ago(check.oldestQueuedSeconds)}`
        : ""
    }`;
  if (name === "aiBudget")
    return `${check.percent}% of today’s budget used${
      check.status === "paused" ? "; AI work is paused" : ""
    }`;
  return `${check.latencyMs} ms`;
}
function ReadinessStatus({ readiness }: { readiness: Row }) {
  const failed = readiness.failed?.length || 0;
  return (
    <details className="admin-explanation" open={failed > 0}>
      <summary>
        {failed
          ? `Readiness: ${failed} ${failed === 1 ? "check needs" : "checks need"} attention.`
          : "Readiness: all checks passing."}
      </summary>
      {Object.entries(readiness.checks as Record<string, Row>).map(
        ([name, check]) => (
          <p key={name}>
            <strong>{readinessLabels[name] || name}:</strong>{" "}
            {check.ok ? "OK" : "Needs attention"} ·{" "}
            {readinessDetail(name, check)}
          </p>
        ),
      )}
      <p>
        Alerts:{" "}
        {readiness.monitoring?.alerting
          ? "sent to the alert webhook"
          : "not configured (set ALERT_WEBHOOK_URL)"}
        . Error reports:{" "}
        {readiness.monitoring?.errorReporting
          ? "logged and sent to the error webhook"
          : "server logs only (set ERROR_WEBHOOK_URL)"}
        . Point an uptime monitor at /api/health/ready.
      </p>
    </details>
  );
}

function AiOperations({
  data,
  busy,
  load,
  operation,
  checkedAt,
}: {
  data: Row;
  busy: string;
  load: () => Promise<void>;
  operation: ReturnType<typeof useAdminOperation>;
  checkedAt: number;
}) {
  const [paused, setPaused] = useState(!!data.controls.paused),
    [budget, setBudget] = useState(data.controls.dailyBudgetCents / 100);
  const total =
    data.spend.reduce((sum: number, row: Row) => sum + Number(row.cents), 0) /
    100;
  const fresh = data.worker.lastSeen > checkedAt - 120000;
  return (
    <section className="cx-panel pw-ai-controls">
      <h2>AI operations</h2>
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
      {data.readiness && <ReadinessStatus readiness={data.readiness} />}
      <p>
        <strong>${total.toFixed(2)}</strong> reserved against today’s estimated
        AI budget.
      </p>
      <div className="admin-row-controls">
        <label className="field">
          Site-wide daily AI budget (USD)
          <input
            disabled={!!busy}
            type="number"
            min={0}
            max={10000}
            step="0.01"
            value={budget}
            onChange={(e) => {
              setBudget(Number(e.target.value));
              operation.changed();
            }}
          />
        </label>
        <label className="check-label">
          <input
            disabled={!!busy}
            type="checkbox"
            checked={paused}
            onChange={(e) => {
              setPaused(e.target.checked);
              operation.changed();
            }}
          />
          Pause all new AI work
        </label>
        <Button
          disabled={!!busy}
          onClick={() =>
            operation.run(
              "Saving AI controls",
              "AI controls saved.",
              async () => {
                await api("admin/ai-controls", {
                  paused,
                  dailyBudgetCents: Math.round(budget * 100),
                });
                await load();
              },
            )
          }
        >
          Save AI controls
        </Button>
      </div>
      <AdminOperationStatus
        feedback={operation.feedback}
        dirty={
          budget !== data.controls.dailyBudgetCents / 100 ||
          paused !== !!data.controls.paused
        }
      />
      <details className="admin-explanation">
        <summary>How budgets and pausing work</summary>
        <p>
          Budgets reset at midnight UTC. Reservations include captions, image
          guidance, menu reading and images; uncertain requests remain counted.
        </p>
        <p>
          These limits use configured cost estimates, not invoice totals.
          Completed and uncertain requests may still incur provider charges.
          Pausing stops new submissions; results already in progress are still
          recovered. Originals and image quality settings are unchanged.
        </p>
      </details>
    </section>
  );
}
