"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, type Row } from "@/lib/client";

export function PhotoCorrectionSheet({
  assetId,
  onClose,
  onOpenCorrection,
  refresh,
  onCloseAutoFocus,
}: {
  assetId: string;
  onClose: () => void;
  onOpenCorrection: (jobId: string, resultId?: string) => void;
  refresh: () => Promise<void>;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [report, setReport] = useState<Row | null>(null),
    [reason, setReason] = useState("ingredients"),
    [detail, setDetail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    api(`photo-corrections/${assetId}`)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [assetId]);
  useEffect(() => {
    if (report?.status !== "queued") return;
    let active = true,
      inFlight = false;
    const timer = setInterval(async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const data = await api(`photo-corrections/${assetId}`);
        if (active) setReport(data);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        inFlight = false;
      }
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [assetId, report?.status]);
  async function submit(create = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api(
        `photo-corrections/${assetId}${create ? "/create" : ""}`,
        create ? {} : { reason, detail },
      );
      setReport(result);
      if (create) void api("jobs/tick", {}).catch(() => {});
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const canReport =
    report &&
    report.canReport !== false &&
    (["eligible", "unavailable"].includes(report.status) ||
      (report.status === "ready" && report.isCorrection));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="cx-workspace-popover ps2-dialog ps2-correction"
        showCloseButton={false}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <header className="ps2-dialog-header">
          <div>
            <DialogTitle>Report a food change</DialogTitle>
            <DialogDescription>
              A food correction keeps your original dish and requested look. A
              new creative direction is a separate, paid edit.
            </DialogDescription>
          </div>
          <button
            className="ps2-icon-button"
            aria-label="Close food correction"
            disabled={busy}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        <div className="ps2-dialog-scroll">
          {error && (
            <p role="alert" className="cx-feedback error">
              {error}
            </p>
          )}
          {!report && !error && <p role="status">Checking this photo…</p>}
          {report && <p role="status">{report.message}</p>}
          {canReport && (
            <fieldset disabled={busy} className="ps2-correction-form">
              <legend>What changed?</legend>
              {[
                ["ingredients", "Ingredients"],
                ["portion", "Portion or quantity"],
                ["plating", "Plate or packaging"],
                ["branding", "Branding"],
                ["artificial", "Looks artificial"],
              ].map(([id, label]) => (
                <label key={id}>
                  <input
                    type="radio"
                    name="food-issue"
                    value={id}
                    checked={reason === id}
                    onChange={() => setReason(id)}
                  />
                  {label}
                </label>
              ))}
              <label className="field">
                Anything else? (optional)
                <textarea
                  value={detail}
                  maxLength={500}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="For example, there should be three tacos."
                />
              </label>
              <button
                className="cx-btn"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy
                  ? "Saving report…"
                  : report.isCorrection
                    ? "The food is still inaccurate"
                    : "Save food report"}
              </button>
            </fieldset>
          )}
          {report?.status === "reported" && (
            <button
              className="cx-btn"
              disabled={busy}
              onClick={() => void submit(true)}
            >
              {busy ? "Starting correction…" : "Correct my food · Free"}
            </button>
          )}
          {report?.jobId &&
            !report.isCorrection &&
            ["queued", "ready"].includes(report.status) && (
              <button
                className="cx-btn"
                disabled={busy}
                onClick={() => onOpenCorrection(report.jobId, report.resultId)}
              >
                {report.status === "ready"
                  ? "Review corrected photo"
                  : "View correction progress"}
              </button>
            )}
          {report?.policy && (
            <p className="ps2-control-help">{report.policy}</p>
          )}
          {report?.resolution && <p>{report.resolution}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
