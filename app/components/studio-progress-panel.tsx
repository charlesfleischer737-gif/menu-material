"use client";
import { useEffect, useState } from "react";
import { api, type Row } from "@/lib/client";
import { Button } from "@/components/ui/button";

export function StudioProgressPanel() {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("production");
  const [result, setResult] = useState<{ mode: string; data: Row } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const report = result?.mode === mode ? result.data : null;
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!open) return;
    let current = true;
    void api(`admin/studio-report?mode=${mode}&days=30`)
      .then((data) => {
        if (current) setResult({ mode, data });
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [open, mode, refresh]);
  const mature = report?.rows.filter((row: Row) => row.mature) || [];
  const sourceCount = mature.reduce(
    (sum: number, row: Row) => sum + row.sources,
    0,
  );
  const proxyCount = mature.reduce(
    (sum: number, row: Row) => sum + row.useful_proxy,
    0,
  );
  const pendingCount = (report?.rows || []).reduce(
    (sum: number, row: Row) => sum + (row.mature ? 0 : row.sources),
    0,
  );
  return (
    <details
      className="admin-details studio-progress"
      onToggle={(event) => {
        const next = event.currentTarget.open;
        if (next && !open) {
          setLoading(true);
          setError("");
        }
        setOpen(next);
      }}
    >
      <summary>Photo Studio progress</summary>
      <div className="studio-progress-controls">
        <label className="field">
          Activity included
          <select
            value={mode}
            disabled={loading}
            onChange={(event) => {
              setMode(event.target.value);
              setLoading(true);
              setError("");
            }}
          >
            <option value="production">Production activity</option>
            <option value="internal">Internal QA only</option>
          </select>
        </label>
        <Button
          variant="outline"
          disabled={loading}
          className="admin-progress-refresh"
          onClick={() => {
            if (loading) return;
            setLoading(true);
            setError("");
            setRefresh((value) => value + 1);
          }}
        >
          {error ? "Retry progress" : "Refresh progress"}
        </Button>
      </div>
      <p
        className="admin-operation-status"
        role={error ? "alert" : "status"}
        data-state={error ? "error" : "idle"}
      >
        {loading
          ? "Loading photo progress…"
          : error
            ? `${error} Use Retry progress to try again.`
            : "Photo progress is up to date."}
      </p>
      {!report && loading && (
        <div className="admin-progress-placeholder" aria-hidden="true">
          <span />
          <span />
        </div>
      )}
      {report && (
        <>
          <p>
            Source drafts started {new Date(report.since).toLocaleDateString()}–
            {new Date(report.asOf).toLocaleDateString()} · Seven-day follow-up ·{" "}
            {mode === "internal" ? "Internal QA only" : "Production only"}
          </p>
          <div className="studio-progress-outcome">
            <strong>
              {sourceCount
                ? `${Math.round((100 * proxyCount) / sourceCount)}%`
                : pendingCount
                  ? "Awaiting follow-up"
                  : "No activity yet"}
            </strong>
            <span>
              {sourceCount
                ? `${proxyCount} of ${sourceCount} source drafts with a complete seven-day window reached the photo-use proxy.`
                : pendingCount
                  ? `${pendingCount} source ${pendingCount === 1 ? "draft is" : "drafts are"} still within the seven-day follow-up window.`
                  : "Eligible Photo Studio activity will appear here."}
            </span>
          </div>
          {report.rows.length > 0 && (
            <p>
              Distinct source drafts at each stage. Free edits and reused
              results can skip generation; columns are not a strictly descending
              funnel.
            </p>
          )}
          {report.rows.length > 0 ? (
            <div
              className="table-scroll"
              role="region"
              aria-label="Photo progress by source cohort"
              tabIndex={0}
            >
              <table>
                <caption className="sr-only">
                  Photo progress by source cohort
                </caption>
                <thead>
                  <tr>
                    <th>Source cohort</th>
                    <th>Follow-up</th>
                    <th>Source drafts</th>
                    <th>Look in place</th>
                    <th>New creation</th>
                    <th>Result reused</th>
                    <th>Generated result</th>
                    <th>Photo reviewed</th>
                    <th>File prepared</th>
                    <th>Photo-use proxy</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row: Row) => (
                    <tr key={`${row.guest}:${row.mature}`}>
                      <th scope="row">
                        {row.guest ? "Guest → account" : "Signed in"}
                      </th>
                      <td>{row.mature ? "Complete" : "Still open"}</td>
                      {[
                        "sources",
                        "selected",
                        "requested",
                        "reused",
                        "result",
                        "approved",
                        "prepared",
                        "useful_proxy",
                      ].map((key) => (
                        <td key={key}>{row[key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No eligible source drafts in this window.</p>
          )}
          <details className="admin-explanation">
            <summary>How progress is measured</summary>
            <p>{report.outcome}</p>
            <p>{report.scope}</p>
            <p className="studio-progress-note">{report.exclusions}</p>
          </details>
        </>
      )}
    </details>
  );
}
