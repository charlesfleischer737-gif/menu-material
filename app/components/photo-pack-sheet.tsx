"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, CircleMinus, Download, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadBlob } from "@/lib/client";
import { encodePhoto, openOriginalPhoto } from "@/lib/photo-export";
import { photoExportEventKey } from "@/lib/photo-export-identity";
import { emptyAdjustments } from "@/lib/studio";
import type { StyleProfile } from "@/lib/channel-rules";
import {
  packQualities,
  packReadme,
  packReady,
  packZipName,
  planPhotoPack,
  verifyPackFile,
  type PackItem,
} from "@/lib/photo-pack";
import { track } from "./creation-shared";

function itemStatus(item: PackItem) {
  return !item.included
    ? "skip"
    : item.checks.some((check) => check.status === "warn")
      ? "warn"
      : "pass";
}
/**
 * One tap, every channel: sized, cropped and checked JPEGs for delivery
 * apps, Google, Instagram and the website, zipped with upload notes.
 * Requires an approved photo.
 */
export function PhotoPackSheet({
  open,
  onOpenChange,
  assetId,
  name,
  fromPhoto,
  style,
  onCloseAutoFocus,
  measurementContext = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  name: string;
  fromPhoto: boolean;
  style: StyleProfile;
  onCloseAutoFocus?: (event: Event) => void;
  measurementContext?: { draftId?: string; sourceId?: string };
}) {
  const bitmap = useRef<ImageBitmap | null>(null);
  const [source, setSource] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [built, setBuilt] = useState<PackItem[] | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void openOriginalPhoto(assetId)
      .then((im) => {
        if (!live) return im.close();
        bitmap.current = im;
        setSource({ width: im.width, height: im.height });
      })
      .catch((e) => {
        if (live) setLoadError((e as Error).message);
      });
    return () => {
      live = false;
      bitmap.current?.close();
      bitmap.current = null;
      setSource(null);
      setBuilt(null);
      setLoadError("");
    };
  }, [open, assetId]);
  const plan = useMemo(
    () =>
      source
        ? planPhotoPack({
            name: name.trim() || "Dish photo",
            ...source,
            fromPhoto,
            style,
          })
        : null,
    [source, name, fromPhoto, style],
  );
  const shown = built || plan;
  const included = shown?.filter((item) => item.included) || [];
  const warned = included.filter((item) => itemStatus(item) === "warn");
  const left = (shown?.length || 0) - included.length;
  const summary = [
    `${included.length} ${included.length === 1 ? "photo" : "photos"} ready`,
    ...(warned.length ? [`${warned.length} to check before uploading`] : []),
    ...(left ? [`${left} left out`] : []),
    ...(!warned.length && !left ? ["all checks passed"] : []),
    ...(source ? [`from ${source.width} × ${source.height}`] : []),
  ].join(" · ");
  async function download() {
    const im = bitmap.current;
    if (!im || !plan || busy || !packReady(plan)) return;
    setBusy(true);
    setError("");
    setNotice("");
    const attemptId = crypto.randomUUID();
    try {
      const files: Record<string, Uint8Array> = {};
      const result: PackItem[] = [];
      const todo = plan.filter((item) => item.included).length;
      let done = 0;
      for (const item of plan) {
        if (!item.included) {
          result.push(item);
          continue;
        }
        done++;
        setProgress(`Preparing ${done} of ${todo}…`);
        try {
          const output = await encodePhoto(
            im,
            item.width,
            item.height,
            { ...emptyAdjustments, fit: item.fit },
            item.entry.channel?.maxBytes ?? Infinity,
            packQualities,
          );
          const verified = verifyPackFile(item, output.blob.size);
          if (verified.included)
            files[item.filename] = new Uint8Array(
              await output.blob.arrayBuffer(),
            );
          result.push(verified);
        } catch (e) {
          result.push({
            ...item,
            included: false,
            skipped: `Left out: ${(e as Error).message}`,
          });
        }
      }
      const count = Object.keys(files).length;
      if (!count) throw Error("None of these sizes could be prepared.");
      const { zipSync, strToU8 } = await import("fflate");
      files["README.txt"] = strToU8(packReadme(name, result));
      downloadBlob(
        new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], {
          type: "application/zip",
        }),
        packZipName(name),
      );
      setBuilt(result);
      const exportKey = await photoExportEventKey(assetId, "pack").catch(
        () => undefined,
      );
      const details = {
        ...measurementContext,
        destination: "pack",
        count,
        ...(exportKey ? { exportKey } : {}),
      };
      track("export_prepared", assetId, details, exportKey);
      track("export_download_started", assetId, details, attemptId);
      setNotice(
        `Download started: ${count} ${count === 1 ? "photo" : "photos"} and a README with where to upload each one.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress("");
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="cx-workspace-popover ps2-dialog ps2-finish ps2-pack"
        showCloseButton={false}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <header className="ps2-dialog-header">
          <div>
            <DialogTitle>Photo pack</DialogTitle>
            <DialogDescription>
              Every size in one download, cropped and checked for where it goes.
            </DialogDescription>
          </div>
          <button
            className="ps2-icon-button"
            disabled={busy}
            aria-label="Close photo pack"
            onClick={() => onOpenChange(false)}
          >
            <X size={21} />
          </button>
        </header>
        <div className="ps2-dialog-scroll ps2-finish-scroll">
          {loadError ? (
            <p className="ps2-inline-note" role="alert">
              {loadError}
            </p>
          ) : !shown ? (
            <p className="ps2-control-help" role="status">
              Checking your photo…
            </p>
          ) : (
            <>
              <p className="pk-summary" role="status">
                {summary}
              </p>
              <ul className="pk-list" aria-label="Pack contents and checks">
                {shown.map((item) => {
                  const status = itemStatus(item);
                  return (
                    <li
                      key={item.entry.id}
                      className="pk-item"
                      data-status={status}
                    >
                      <span className="pk-icon" aria-hidden="true">
                        {status === "pass" ? (
                          <Check size={16} />
                        ) : status === "warn" ? (
                          <CircleAlert size={16} />
                        ) : (
                          <CircleMinus size={16} />
                        )}
                      </span>
                      <div className="pk-body">
                        <div className="pk-head">
                          <b>{item.entry.label}</b>
                          <span>
                            {item.included
                              ? `${item.width} × ${item.height}`
                              : "Not included"}
                          </span>
                        </div>
                        <small>
                          {item.entry.use}
                          {item.included && item.fit
                            ? " · whole dish kept, frame padded"
                            : ""}
                        </small>
                        {!item.included ? (
                          <p className="pk-note">
                            {item.skipped?.replace(/^Left out: /, "")}
                          </p>
                        ) : (
                          <>
                            {item.checks.length > 0 && (
                              <ul className="pk-checks">
                                {item.checks.map((check) => (
                                  <li
                                    key={check.id}
                                    data-status={check.status}
                                    title={check.detail}
                                  >
                                    {check.status === "pass" ? (
                                      <Check size={13} aria-hidden="true" />
                                    ) : (
                                      <CircleAlert
                                        size={13}
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span className="sr-only">
                                      {check.status === "pass"
                                        ? "Passed: "
                                        : "Check: "}
                                    </span>
                                    {check.label}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {item.checks
                              .filter((check) => check.status === "warn")
                              .map((check) => (
                                <p className="pk-note" key={check.id}>
                                  {check.detail}
                                </p>
                              ))}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        <footer className="ps2-dialog-footer">
          <p className="ps2-download-hint" role="status">
            {busy
              ? progress
              : "JPG files and a README with upload steps · No image used"}
          </p>
          {error && (
            <p className="ps2-inline-note" role="alert">
              {error} Your photo is saved. Try again.
            </p>
          )}
          {notice && (
            <p className="ps2-inline-note" role="status">
              {notice}
            </p>
          )}
          <div className="ps2-finish-actions">
            <span />
            <button
              className="cx-btn"
              disabled={busy || !plan || !packReady(plan)}
              onClick={() => void download()}
            >
              <Download size={17} />
              {busy
                ? "Preparing…"
                : built
                  ? "Download again"
                  : "Download photo pack"}
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
