"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  Download,
  Package,
  Share2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { photoReviewReminder, type PhotoUseAction } from "@/lib/photo-use";
import { downloadBlob } from "@/lib/client";
import {
  downloadFormats,
  eventDestination,
  masterPhotoExport,
  openOriginalPhoto,
  photoExport,
  type DownloadFormat,
} from "@/lib/photo-export";
import { photoExportEventKey } from "@/lib/photo-export-identity";
import { emptyAdjustments, type Adjustments } from "@/lib/studio";
import { isCatalogDestination, photoFilename } from "@/lib/photo-destinations";
import { destinationChannel, type StyleProfile } from "@/lib/channel-rules";
import { downloadWarnings } from "@/lib/photo-pack";
import { CropControls, Field, PhotoFrame, track } from "./creation-shared";
import { radioKeys, radioTab } from "./radio-keys";

type Destination = DownloadFormat | "master";
// Labeled by use. The photo's own format is the default; the rest are a
// secondary "Different size" choice.
export const sizeChoices: { id: Destination; label: string; hint: string }[] = [
  { id: "menu", label: "Menu & website", hint: "Square · 1:1" },
  { id: "feed", label: "Instagram post", hint: "Portrait · 4:5" },
  { id: "feed-3x4", label: "Instagram post", hint: "Portrait · 3:4" },
  { id: "story", label: "Story", hint: "Full screen · 9:16" },
  { id: "doordash", label: "DoorDash", hint: "Wide · 16:9" },
  { id: "uber", label: "Uber Eats", hint: "Item photo · 5:4" },
  { id: "toast", label: "Toast", hint: "Item photo · 5:3" },
  { id: "print", label: "Print", hint: "Square · high resolution" },
  { id: "master", label: "Full-quality image", hint: "Original size, no crop" },
];
const validDestination = (value: string): Destination =>
  value === "master" || value in downloadFormats
    ? (value as Destination)
    : "menu";
export function PhotoFinishSheet({
  open,
  onOpenChange,
  assetId,
  dishId,
  name,
  fromPhoto,
  approved,
  initialFormat,
  style,
  onUse,
  onPack,
  onCloseAutoFocus,
  onBusyChange,
  measurementContext = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  dishId: string;
  name: string;
  fromPhoto: boolean;
  approved: boolean;
  /** The format the photo was made for; the download opens on it. */
  initialFormat: string;
  /** The photo's look, for delivery-app backdrop warnings. */
  style: StyleProfile;
  onUse: (action: PhotoUseAction) => Promise<void>;
  /** Opens the photo pack (every channel in one download). */
  onPack?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  onBusyChange?: (busy: boolean) => void;
  measurementContext?: { draftId?: string; sourceId?: string };
}) {
  const [destination, setDestination] = useState<Destination>(
    validDestination(initialFormat),
  );
  const [fileName, setFileName] = useState(name);
  const [edits, setEdits] = useState<Adjustments>({
    ...emptyAdjustments,
    fit: !isCatalogDestination(initialFormat),
  });
  const [sizesOpen, setSizesOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [finished, setFinished] = useState(false);
  const [canShare, setCanShare] = useState(false),
    [dimensions, setDimensions] = useState<{
      width: number;
      height: number;
    } | null>(null),
    [originalSize, setOriginalSize] = useState<{
      width: number;
      height: number;
    } | null>(null);
  const downloadLock = useRef(false);
  const downloadHintId = useId();
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    setCanShare(
      typeof navigator.share === "function" &&
        typeof navigator.canShare === "function",
    );
  }, []);
  useEffect(() => {
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active)
        setDimensions({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
    };
    image.src = `/api/assets/${assetId}`;
    return () => {
      active = false;
    };
  }, [assetId]);
  const master = destination === "master",
    catalog = isCatalogDestination(destination);
  // Delivery minimums are measured on the saved original (the working copy
  // is capped at 2048 pixels). Originals of unapproved photos stay private.
  useEffect(() => {
    if (!open || !approved || !catalog || originalSize) return;
    let active = true;
    void openOriginalPhoto(assetId)
      .then((im) => {
        if (active) setOriginalSize({ width: im.width, height: im.height });
        im.close();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, approved, catalog, assetId, originalSize]);
  const eligible = !catalog || fromPhoto;
  const outputName = fileName.trim() || "Dish photo";
  const choice = sizeChoices.find((entry) => entry.id === destination)!;
  const rule = destinationChannel(destination);
  const warnings = eligible
    ? downloadWarnings(destination, {
        style,
        source: originalSize || dimensions,
        edits,
      })
    : [];
  function changeDestination(value: string) {
    const target = validDestination(value);
    setDestination(target);
    setEdits({ ...emptyAdjustments, fit: !isCatalogDestination(target) });
    setFinished(false);
    setError("");
    setNotice("");
  }
  async function finish(share = false) {
    if (downloadLock.current || busy || !eligible) return;
    downloadLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const attemptId = crypto.randomUUID();
    const exportKey = await photoExportEventKey(
      assetId,
      destination,
      edits,
    ).catch(() => undefined);
    const eventDetails = {
      ...measurementContext,
      destination: eventDestination(destination),
      ...(exportKey ? { exportKey } : {}),
    };
    try {
      await onUse(share ? "share" : "download");
      const output = master
        ? await masterPhotoExport(assetId)
        : await photoExport(assetId, destination, edits);
      const filename = photoFilename(
        { assetId, dishId, name: outputName, fromPhoto },
        destination,
        "extension" in output ? output.extension : "jpg",
      );
      const file = new File([output.blob], filename, {
        type: output.blob.type,
      });
      track("export_prepared", assetId, eventDetails, exportKey);
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: outputName });
        track("native_share_complete", assetId, eventDetails, attemptId);
        setNotice(
          "Shared with the app you selected. Your photo is also saved in My Dishes.",
        );
      } else {
        downloadBlob(output.blob, filename);
        track("export_download_started", assetId, eventDetails, attemptId);
        setNotice(
          `Download started. ${"width" in output ? `${output.width} × ${output.height} pixels. ` : "Full-quality original file. "}Your photo is also saved in My Dishes.`,
        );
      }
      setFinished(true);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setNotice("Sharing cancelled. Your photo is still saved.");
        track("native_share_cancelled", assetId, eventDetails, attemptId);
      } else setError((e as Error).message);
    } finally {
      downloadLock.current = false;
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
        className="cx-workspace-popover ps2-dialog ps2-finish"
        showCloseButton={false}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <header className="ps2-dialog-header">
          <div>
            <DialogTitle>Download photo</DialogTitle>
            <DialogDescription>
              {master
                ? "Your saved image at its original size."
                : `Sized for ${choice.label} · ${choice.hint}`}
            </DialogDescription>
          </div>
          <button
            className="ps2-icon-button"
            disabled={busy}
            aria-label="Close download"
            onClick={() => onOpenChange(false)}
          >
            <X size={21} />
          </button>
        </header>
        <div className="ps2-dialog-scroll ps2-finish-scroll">
          <div className="ps2-finish-preview">
            {master ? (
              <img src={`/api/assets/${assetId}`} alt={outputName} />
            ) : (
              <PhotoFrame
                src={`/api/assets/${assetId}`}
                ratio={downloadFormats[destination].ratio}
                edits={edits}
                label={`${downloadFormats[destination].label} · download preview`}
              />
            )}
          </div>
          <p className="ps2-control-help ps2-finish-size">
            {master
              ? `${dimensions ? `${dimensions.width} × ${dimensions.height} pixels · ` : ""}No resizing or recompression`
              : `Up to ${downloadFormats[destination].width} × ${downloadFormats[destination].height} pixels · JPG · No image used`}
          </p>
          {warnings.length > 0 && (
            <div className="ps2-finish-warning" role="note">
              <CircleAlert size={18} aria-hidden="true" />
              <div>
                {warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
                {rule && (
                  <a
                    className="cx-link"
                    href={rule.sources[0]}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {rule.label} photo rules
                  </a>
                )}
              </div>
            </div>
          )}
          <Collapsible
            open={sizesOpen}
            onOpenChange={setSizesOpen}
            className="ps2-finish-more-sizes"
          >
            <CollapsibleTrigger className="cx-link" disabled={busy}>
              Different size <ChevronDown size={14} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div
                className="ps2-size-choices"
                role="radiogroup"
                aria-label="Size"
                onKeyDown={radioKeys}
              >
                {sizeChoices.map((entry, index) => (
                  <button
                    key={entry.id}
                    role="radio"
                    aria-checked={destination === entry.id}
                    tabIndex={radioTab(
                      index,
                      sizeChoices.findIndex((c) => c.id === destination),
                    )}
                    disabled={busy}
                    onClick={() => changeDestination(entry.id)}
                  >
                    <b>{entry.label}</b>
                    <span>{entry.hint}</span>
                    {destination === entry.id && (
                      <Check size={15} aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
          {!master && (
            <Collapsible className="ps2-finish-crop">
              <CollapsibleTrigger className="cx-link" disabled={busy}>
                <SlidersHorizontal size={15} />
                Adjust crop
                <ChevronDown size={14} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <fieldset
                  disabled={busy}
                  style={{ border: 0, padding: 0, margin: 0 }}
                >
                  <CropControls
                    value={edits}
                    allowFit={!catalog}
                    onChange={(next) => {
                      setEdits(next);
                      setFinished(false);
                      setError("");
                      setNotice("");
                    }}
                  />
                </fieldset>
              </CollapsibleContent>
            </Collapsible>
          )}
          <Collapsible>
            <CollapsibleTrigger className="cx-link" disabled={busy}>
              File name <ChevronDown size={14} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Field label="File name (optional)">
                <input
                  value={fileName}
                  maxLength={100}
                  disabled={busy}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Dish photo"
                />
              </Field>
            </CollapsibleContent>
          </Collapsible>
          {destination === "print" && (
            <p className="ps2-control-help">
              {dimensions
                ? `The saved image supports about ${(dimensions.width / 300).toFixed(1)} × ${(dimensions.height / 300).toFixed(1)} inches at 300 pixels per inch before cropping. `
                : ""}
              Resizing doesn’t add original detail. Check a print proof before
              making a large print.
            </p>
          )}
        </div>
        <footer className="ps2-dialog-footer">
          <p className="ps2-download-hint">{photoReviewReminder}</p>
          <p className="ps2-download-hint" id={downloadHintId} role="status">
            {!eligible
              ? "Choose Menu & website. Ordering platforms need a photo of your actual dish."
              : "Saved privately in My Dishes."}
          </p>
          {error && (
            <p className="ps2-inline-note" role="alert">
              {error} Your photo is saved. Try downloading again.
            </p>
          )}
          {notice && (
            <p className="ps2-inline-note" role="status">
              {notice}
            </p>
          )}
          <div className="ps2-finish-actions">
            {canShare ? (
              <button
                className="cx-btn cx-secondary"
                aria-describedby={downloadHintId}
                disabled={busy || !eligible}
                onClick={() => void finish(true)}
              >
                <Share2 size={16} />
                Share
              </button>
            ) : (
              <span />
            )}
            <button
              className="cx-btn"
              aria-describedby={downloadHintId}
              disabled={busy || !eligible}
              onClick={() => void finish()}
            >
              <Download size={17} />
              {busy ? "Preparing…" : finished ? "Download again" : "Download"}
            </button>
          </div>
          {onPack && approved && (
            <button
              className="cx-link ps2-finish-more"
              disabled={busy}
              onClick={onPack}
            >
              <Package size={16} aria-hidden="true" />
              Photo pack · every size in one download
            </button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
