"use client";
import { useState } from "react";
import { api } from "@/lib/client";

const reasons = [
  ["impersonation", "It pretends to be a business it isn’t"],
  ["misleading", "It’s misleading or a scam"],
  ["offensive", "It’s offensive or harmful"],
  ["copyright", "It uses my photos or content"],
  ["other", "Something else"],
] as const;

/**
 * A quiet link at the foot of guest menus. A guest can tell the Menu Material
 * team about a page; an administrator reviews it and can take it down.
 */
export default function ReportMenu({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [details, setDetails] = useState(""),
    [sending, setSending] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState("");
  if (sent)
    return (
      <p className="md-guest-report" role="status">
        Thanks. The Menu Material team will review this page.
      </p>
    );
  if (!open)
    return (
      <button
        type="button"
        className="md-guest-report-link"
        onClick={() => setOpen(true)}
      >
        Report this page
      </button>
    );
  return (
    <form
      className="md-guest-report"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reason) {
          setError("Choose what’s wrong with this page.");
          return;
        }
        setSending(true);
        setError("");
        try {
          await api(`public/${encodeURIComponent(slug)}/report`, {
            reason,
            details,
          });
          setSent(true);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setSending(false);
        }
      }}
    >
      <fieldset>
        <legend>What’s wrong with this page?</legend>
        {reasons.map(([id, label]) => (
          <label key={id}>
            <input
              type="radio"
              name="report-reason"
              value={id}
              checked={reason === id}
              onChange={() => setReason(id)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label>
        Anything else we should know? (optional)
        <textarea
          value={details}
          maxLength={1000}
          rows={3}
          onChange={(e) => setDetails(e.target.value)}
        />
      </label>
      <div className="md-guest-report-actions">
        <button type="submit" disabled={sending}>
          {sending ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && <small role="alert">{error}</small>}
    </form>
  );
}
