"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formats, type Adjustments, type PhotoFormat } from "@/lib/studio";
import { CropControls, Field, PhotoFrame } from "./creation-shared";

export type PhotoAdjustmentValues = {
  format: PhotoFormat;
  adjustments: Adjustments;
};
export type PhotoAdjustmentSession = PhotoAdjustmentValues & {
  id: string;
  assetId: string;
};

export function PhotoAdjustmentSheet({
  open,
  session,
  onOpenChange,
  onSave,
  onCloseAutoFocus,
}: {
  open: boolean;
  session: PhotoAdjustmentSession;
  onOpenChange: (open: boolean) => void;
  onSave: (values: PhotoAdjustmentValues, requestKey: string) => Promise<void>;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [values, setValues] = useState<PhotoAdjustmentValues>(() => ({
    format: session.format,
    adjustments: { ...session.adjustments },
  }));
  const [tab, setTab] = useState("crop");
  const [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  // Keep retry identity tied to the exact pixels/settings, including after an uncertain response.
  const attempts = useRef(new Map<string, string>());
  useEffect(() => {
    if (open && !lock.current) {
      setValues({
        format: session.format,
        adjustments: { ...session.adjustments },
      });
      setTab("crop");
      setReady(false);
      setError("");
    }
  }, [open, session]);
  const ratio = formats[values.format].ratio;
  function changeAdjustments(adjustments: Adjustments) {
    setValues((current) => ({ ...current, adjustments }));
    setError("");
  }
  async function save() {
    if (lock.current || !ready) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const captured = {
      format: values.format,
      adjustments: { ...values.adjustments },
    };
    const identity = JSON.stringify(captured);
    const requestKey = attempts.current.get(identity) || crypto.randomUUID();
    attempts.current.set(identity, requestKey);
    try {
      await onSave(captured, requestKey);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "This version couldn’t be saved. Your adjustments are still here. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent
        className="cx-workspace-popover ps2-dialog ps2-adjustment"
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          heading.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <header className="ps2-dialog-header">
          <div>
            <DialogTitle ref={heading} tabIndex={-1}>
              Quick adjustments
            </DialogTitle>
            <DialogDescription>No images used.</DialogDescription>
          </div>
          <button
            className="ps2-icon-button"
            aria-label="Cancel adjustments"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            <X size={20} />
          </button>
        </header>
        <div className="ps2-adjustment-body">
          <div
            className="ps2-adjustment-stage"
            style={{ "--photo-ratio": ratio } as CSSProperties}
          >
            <PhotoFrame
              src={`/api/assets/${session.assetId}`}
              ratio={ratio}
              edits={values.adjustments}
              onChange={!busy && tab === "crop" ? changeAdjustments : undefined}
              onReadyChange={setReady}
              label="Your adjusted photo"
            />
          </div>
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="ps2-adjustment-tools"
          >
            <TabsList aria-label="Adjustment tools">
              <TabsTrigger value="crop" disabled={busy}>
                Crop
              </TabsTrigger>
              <TabsTrigger value="light" disabled={busy}>
                Light & color
              </TabsTrigger>
            </TabsList>
            <div
              className="ps2-adjustment-scroll"
              tabIndex={0}
              aria-label="Photo adjustment controls"
            >
              <fieldset disabled={busy}>
                <legend className="sr-only">Adjust your photo</legend>
                <TabsContent value="crop">
                  <Field label="Photo size">
                    <select
                      value={values.format}
                      onChange={(event) => {
                        setValues((current) => ({
                          ...current,
                          format: event.target.value as PhotoFormat,
                        }));
                        setError("");
                      }}
                    >
                      {Object.entries(formats).map(([id, format]) => (
                        <option key={id} value={id}>
                          {format.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <CropControls
                    quick
                    section="crop"
                    showValues
                    value={values.adjustments}
                    onChange={changeAdjustments}
                  />
                </TabsContent>
                <TabsContent value="light">
                  <p className="ps2-adjustment-help">
                    Small changes keep your food looking natural.
                  </p>
                  <CropControls
                    quick
                    section="light"
                    showValues
                    value={values.adjustments}
                    onChange={changeAdjustments}
                  />
                </TabsContent>
                <button
                  className="cx-link"
                  onClick={() => {
                    setValues({
                      format: session.format,
                      adjustments: { ...session.adjustments },
                    });
                    setError("");
                  }}
                >
                  Reset adjustments
                </button>
              </fieldset>
            </div>
          </Tabs>
        </div>
        <footer className="ps2-adjustment-footer">
          {error && (
            <p role="alert" className="ps2-adjustment-error">
              {error}
            </p>
          )}
          <p role={busy ? "status" : undefined}>
            {busy
              ? "Saving a separate version…"
              : "Your original stays safe. Save a new version."}
          </p>
          <div>
            <button
              className="cx-link"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              className="cx-btn"
              disabled={busy || !ready}
              onClick={() => void save()}
            >
              {busy ? "Saving…" : "Save this version"}
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
