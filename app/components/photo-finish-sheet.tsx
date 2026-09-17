"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  ImagePlus,
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
import { downloadBlob, type Row } from "@/lib/client";
import { masterPhotoExport, photoExport } from "@/lib/photo-export";
import { photoExportEventKey } from "@/lib/photo-export-identity";
import {
  emptyAdjustments,
  formats,
  type PhotoFormat,
  type Adjustments,
} from "@/lib/studio";
import { isCatalogDestination, photoFilename } from "@/lib/photo-destinations";
import { readPreference, rememberPreference } from "@/lib/workspace-navigation";
import { CropControls, Field, PhotoFrame, track } from "./creation-shared";

type Destination = PhotoFormat | "master";
const validDestination = (value: string): Destination =>
  value === "master" || value in formats ? (value as Destination) : "menu";
export function PhotoFinishSheet({
  open,
  onOpenChange,
  assetId,
  dishId,
  name,
  fromPhoto,
  approved,
  initialFormat,
  preferenceKey,
  checks,
  rememberCheck,
  onApprove,
  onNew,
  onReuse,
  onBatch,
  onSaveLook,
  onDestination,
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
  initialFormat: string;
  preferenceKey: string;
  checks: Row;
  rememberCheck: (key: string) => void;
  onApprove: () => Promise<void>;
  onNew: () => void;
  onReuse: () => void;
  onBatch: () => void;
  onSaveLook: () => void;
  onDestination: (target: string) => void;
  onCloseAutoFocus: (event: Event) => void;
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
  const [confirmed, setConfirmed] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [finished, setFinished] = useState(false);
  const [canShare, setCanShare] = useState(false),
    [dimensions, setDimensions] = useState<{
      width: number;
      height: number;
    } | null>(null);
  const downloadLock = useRef(false);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  const preference = preferenceKey + ":photo-destination";
  useEffect(() => {
    const remembered = readPreference(preference);
    if (remembered) {
      const target = validDestination(remembered);
      setDestination(target);
      setEdits({ ...emptyAdjustments, fit: !isCatalogDestination(target) });
    }
    setCanShare(
      typeof navigator.share === "function" &&
        typeof navigator.canShare === "function",
    );
  }, [preference]);
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
  const checkKey = `${assetId}:${destination}:${JSON.stringify(edits)}`;
  const checked = confirmed ?? (!!approved && !!checks[checkKey]);
  const eligible = !catalog || fromPhoto;
  const outputName = fileName.trim() || "Dish photo";
  function changeDestination(value: string) {
    const target = validDestination(value);
    setDestination(target);
    setEdits({ ...emptyAdjustments, fit: !isCatalogDestination(target) });
    setConfirmed(null);
    setFinished(false);
    setError("");
    setNotice("");
    rememberPreference(preference, target);
  }
  async function finish(share = false) {
    if (downloadLock.current || busy || !eligible || !checked) return;
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
      destination,
      ...(exportKey ? { exportKey } : {}),
    };
    try {
      if (!approved) await onApprove();
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
      rememberCheck(checkKey);
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
            <span className="ps2-kicker">READY FOR YOUR RESTAURANT</span>
            <DialogTitle>Make it yours to use.</DialogTitle>
            <DialogDescription>
              One quick check. Then save the right size.
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
                ratio={formats[destination].ratio}
                edits={edits}
                label={`${formats[destination].label} · download preview`}
              />
            )}
          </div>
          <Field label="Save for">
            <select
              value={destination}
              disabled={busy}
              onChange={(e) => changeDestination(e.target.value)}
            >
              {Object.entries(formats).map(([id, format]) => (
                <option key={id} value={id}>
                  {format.label}
                </option>
              ))}
              <option value="master">Full-quality image · no crop</option>
            </select>
          </Field>
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
          {master ? (
            <p className="ps2-control-help">
              {dimensions
                ? `${dimensions.width} × ${dimensions.height} pixels. `
                : ""}
              The saved image, with no resizing or recompression.
            </p>
          ) : (
            <>
              <p className="ps2-control-help">
                Up to {formats[destination].width} ×{" "}
                {formats[destination].height} pixels · JPG · No image allowance
                used
              </p>
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
                        setConfirmed(null);
                        setFinished(false);
                      }}
                    />
                  </fieldset>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
          {destination === "print" && (
            <p className="ps2-control-help">
              {dimensions
                ? `The saved image supports about ${(dimensions.width / 300).toFixed(1)} × ${(dimensions.height / 300).toFixed(1)} inches at 300 pixels per inch before cropping. `
                : ""}
              Resizing doesn’t add original detail. Check a print proof before
              making a large print.
            </p>
          )}
          {!checked || !finished ? (
            <label className="cx-check ps2-finish-check">
              <input
                type="checkbox"
                checked={checked}
                disabled={busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {approved
                ? master
                  ? "I’ve checked this is the version I want to use."
                  : "The whole dish and its packaging are visible in this crop."
                : "The food, portion and branding match what I serve, and the whole dish is visible."}
            </label>
          ) : (
            <p className="ps2-finish-checked">
              <Check size={16} />
              This version is reviewed and saved.
            </p>
          )}
          {!eligible && (
            <p className="ps2-inline-note">
              Ordering platforms need a photo of your actual dish. Choose
              Website or menu, or start with a real dish photo.
            </p>
          )}
          {error && (
            <p className="ps2-inline-note" role="alert">
              {error} Your saved photo is still available. Try the download
              again.
            </p>
          )}
          {notice && (
            <p className="ps2-inline-note" role="status">
              {notice}
            </p>
          )}
          {approved && (
            <Collapsible className="ps2-finish-more">
              <CollapsibleTrigger className="cx-link">
                Use in a menu or post
                <ChevronDown size={14} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <button
                  className="cx-link"
                  disabled={busy}
                  onClick={() => onDestination("post")}
                >
                  Make a post
                  <ArrowRight size={14} />
                </button>
                <button
                  className="cx-link"
                  disabled={busy}
                  onClick={() => onDestination("menu")}
                >
                  Add to a menu
                  <ArrowRight size={14} />
                </button>
                <button
                  className="cx-link"
                  disabled={busy}
                  onClick={() => onDestination("print")}
                >
                  Create a print menu
                  <ArrowRight size={14} />
                </button>
              </CollapsibleContent>
            </Collapsible>
          )}
          {(finished || approved) && (
            <div className="ps2-finish-next">
              <button className="cx-link" disabled={busy} onClick={onNew}>
                <ImagePlus size={15} />
                Add another photo
              </button>
              <button className="cx-link" disabled={busy} onClick={onReuse}>
                Use this look again
                <ArrowRight size={15} />
              </button>
              <button className="cx-link" disabled={busy} onClick={onSaveLook}>
                Save this look
              </button>
              <button className="cx-link" disabled={busy} onClick={onBatch}>
                Apply to more dishes
              </button>
            </div>
          )}
        </div>
        <footer className="ps2-dialog-footer">
          {canShare ? (
            <button
              className="cx-link"
              disabled={busy || !checked || !eligible}
              onClick={() => void finish(true)}
            >
              <Share2 size={16} />
              Share
            </button>
          ) : (
            <span>Saved privately in My Dishes</span>
          )}
          <button
            className="cx-btn"
            disabled={busy || !checked || !eligible}
            onClick={() => void finish()}
          >
            <Download size={17} />
            {busy
              ? "Preparing…"
              : finished
                ? "Download again"
                : "Download photo"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
