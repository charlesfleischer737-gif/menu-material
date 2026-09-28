"use client";
import { useEffect, useState } from "react";
import { api, type Row } from "@/lib/client";
import { proFeatures, isProFeature } from "@/lib/plans";
import { Button } from "@/components/ui/button";

const stepLabels: Record<string, string> = {
  home: "Opened the homepage",
  photo: "Added a photo",
  create: "Pressed Create",
  signup: "Signed up",
  export: "First download or export",
  publish: "First menu published",
};
const featureColumns = [
  ["shown", "Plans shown"],
  ["seePro", "See Pro"],
  ["getPro", "Get Pro"],
  ["waitlist", "Waitlist"],
] as const;

function sourceLabel(source: Row) {
  if (source.via === "direct") return "Direct or unknown";
  const tags = [source.medium, source.campaign].filter(Boolean).join(" · ");
  const name =
    source.via === "ref"
      ? source.name === "menu"
        ? "“Made with Menu Material” on a guest menu"
        : `ref=${source.name}`
      : source.name;
  return tags ? `${name} · ${tags}` : name;
}

/**
 * Administration's launch funnel: counts per step, signups by source and
 * what owners did when they met a Pro feature, for 7 and 30 days.
 */
export function LaunchFunnelPanel() {
  const [open, setOpen] = useState(false),
    [report, setReport] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!open) return;
    let current = true;
    void api("admin/funnel")
      .then((data) => {
        if (current) setReport(data);
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
  }, [open, refresh]);
  return (
    <details
      className="admin-details launch-funnel"
      onToggle={(event) => {
        const next = event.currentTarget.open;
        if (next && !open) {
          setLoading(true);
          setError("");
        }
        setOpen(next);
      }}
    >
      <summary>Launch funnel</summary>
      <div className="launch-funnel-controls">
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
          {error ? "Retry funnel" : "Refresh funnel"}
        </Button>
      </div>
      <p
        className="admin-operation-status"
        role={error ? "alert" : "status"}
        data-state={error ? "error" : "idle"}
      >
        {loading
          ? "Loading the launch funnel…"
          : error
            ? `${error} Use Retry funnel to try again.`
            : report
              ? `Up to date as of ${new Date(report.asOf).toLocaleString()}.`
              : "The launch funnel is up to date."}
      </p>
      {report && (
        <>
          <h3>Steps</h3>
          <div
            className="table-scroll"
            role="region"
            aria-label="Launch funnel steps"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Step</th>
                  <th scope="col">Counted as</th>
                  <th scope="col">Last 7 days</th>
                  <th scope="col">Last 30 days</th>
                </tr>
              </thead>
              <tbody>
                {report.steps.map((step: Row) => (
                  <tr key={step.id}>
                    <th scope="row">{stepLabels[step.id] || step.id}</th>
                    <td>
                      {step.unit === "visitors" ? "Visitors" : "Restaurants"}
                    </td>
                    <td>{step.week}</td>
                    <td>{step.month}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Signups by source</h3>
          {report.sources.length ? (
            <div
              className="table-scroll"
              role="region"
              aria-label="Signups by source"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Source</th>
                    <th scope="col">Last 7 days</th>
                    <th scope="col">Last 30 days</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sources.map((source: Row) => (
                    <tr
                      key={JSON.stringify([
                        source.via,
                        source.name,
                        source.medium,
                        source.campaign,
                      ])}
                    >
                      <th scope="row">{sourceLabel(source)}</th>
                      <td>{source.week}</td>
                      <td>{source.month}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-empty-note">No signups in the last 30 days.</p>
          )}
          <h3>Pro features</h3>
          {report.features.length ? (
            <div
              className="table-scroll"
              role="region"
              aria-label="Upgrade prompts and waitlist signups by Pro feature"
              tabIndex={0}
            >
              <table className="launch-funnel-features">
                <colgroup>
                  <col />
                </colgroup>
                {featureColumns.map(([key]) => (
                  <colgroup key={key} span={2} />
                ))}
                <thead>
                  <tr>
                    <th scope="col" rowSpan={2}>
                      Feature
                    </th>
                    {featureColumns.map(([key, label]) => (
                      <th key={key} scope="colgroup" colSpan={2}>
                        {label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {featureColumns.map(([key]) => [
                      <th key={`${key}-week`} scope="col">
                        7 days
                      </th>,
                      <th key={`${key}-month`} scope="col">
                        30 days
                      </th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {report.features.map((row: Row) => (
                    <tr key={row.feature || "none"}>
                      <th scope="row">
                        {isProFeature(row.feature)
                          ? proFeatures[row.feature].title
                          : "No feature (Plans opened directly)"}
                      </th>
                      {featureColumns.map(([key]) => [
                        <td key={`${key}-week`}>{row[key].week}</td>,
                        <td key={`${key}-month`}>{row[key].month}</td>,
                      ])}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-empty-note">
              No Pro prompts or waitlist signups in the last 30 days.
            </p>
          )}
          <details className="admin-explanation">
            <summary>How the funnel is counted</summary>
            <p>
              The first three steps count browsers, each once: the homepage
              opened while signed out, a photo added in Photo Studio (not the
              sample) and Create pressed, before or after signup. They aren’t
              linked to each other or to accounts, so they are counts, not one
              visitor’s path. Signups, first downloads or exports (a photo,
              post, campaign or menu PDF, table card or QR code) and first
              published menus count restaurants, in the window where each first
              happened. Deleted accounts aren’t counted.
            </p>
            <p>
              A signup’s source is the campaign tags (utm_source, utm_medium,
              utm_campaign or ref) or referring site of the first page the owner
              opened, kept in their browser for up to 30 days and sent with
              signup.
            </p>
            <p>
              For each Pro feature, restaurants are counted once. Plans shown:
              Plans opened for the feature, by a click or after a save Pro
              refused. See Pro: the owner clicked See Pro or a Pro button there.
              Get Pro: checkout started from it. Waitlist: joined the Pro
              waitlist from it.
            </p>
          </details>
        </>
      )}
    </details>
  );
}
