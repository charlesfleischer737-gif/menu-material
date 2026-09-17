"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizePhoto } from "@/lib/client";
import type {
  InspirationPhoto,
  InspirationSelection,
} from "@/lib/studio-reference";

export function PhotoInspirationSheet({
  open,
  source,
  dishName,
  current,
  customChoices,
  onOpenChange,
  onApply,
  onCloseAutoFocus,
  onBusyChange,
}: {
  open: boolean;
  source: string;
  dishName: string;
  current: InspirationPhoto | null;
  customChoices: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (
    selection: InspirationSelection | null,
    signal: AbortSignal,
  ) => Promise<void>;
  onCloseAutoFocus: (event: Event) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [selection, setSelection] = useState<InspirationSelection | null>(
    current ? { kind: "existing", photo: current } : null,
  );
  const [preview, setPreview] = useState(current?.url || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [previewStatus, setPreviewStatus] = useState("loading");
  const [sourceFailed, setSourceFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const controller = useRef<AbortController | null>(null),
    fileSequence = useRef(0);
  const ownedUrl = useRef(""),
    locked = useRef(false);
  const initial = useRef(current);
  initial.current = current;
  function releasePreview() {
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    ownedUrl.current = "";
  }
  useLayoutEffect(() => {
    if (!open) {
      // Closing releases the temporary binary selection as well as its URL.
      // Guest drafts retain their own explicitly applied copy.
      setSelection(null);
      setPreview("");
      return;
    }
    const sessionController = new AbortController();
    controller.current = sessionController;
    locked.current = false;
    setBusy("");
    setError("");
    setSourceFailed(false);
    setSelection(
      initial.current ? { kind: "existing", photo: initial.current } : null,
    );
    setPreview(initial.current?.url || "");
    setPreviewStatus("loading");
    return () => {
      sessionController.abort();
      fileSequence.current++;
      releasePreview();
    };
  }, [open]);
  useEffect(() => {
    onBusyChange?.(!!busy && open);
    return () => onBusyChange?.(false);
  }, [busy, open, onBusyChange]);
  async function choose(file: File) {
    if (locked.current) return;
    const sequence = ++fileSequence.current,
      signal = controller.current?.signal;
    setBusy("Preparing inspiration…");
    setError("");
    try {
      const normalized = await normalizePhoto(file);
      if (signal?.aborted || sequence !== fileSequence.current) return;
      const url = URL.createObjectURL(normalized);
      releasePreview();
      ownedUrl.current = url;
      setSelection({
        kind: "file",
        file,
        normalized,
        requestKey: crypto.randomUUID(),
      });
      setPreviewStatus("loading");
      setPreview(url);
    } catch (failure) {
      if (!signal?.aborted && sequence === fileSequence.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "This photo couldn’t be opened. Try another photo.",
        );
    } finally {
      if (!signal?.aborted && sequence === fileSequence.current) setBusy("");
    }
  }
  async function apply(remove = false) {
    if (
      locked.current ||
      busy ||
      (!remove && (!selection || previewStatus !== "ready"))
    )
      return;
    const signal = controller.current?.signal;
    if (!signal || signal.aborted) return;
    locked.current = true;
    setBusy(remove ? "Removing inspiration…" : "Saving inspiration…");
    setError("");
    try {
      await onApply(remove ? null : selection, signal);
    } catch (failure) {
      if (!signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Your inspiration couldn’t be saved. Please try again.",
        );
    } finally {
      if (controller.current?.signal === signal) {
        locked.current = false;
        if (!signal.aborted) setBusy("");
      }
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!locked.current) onOpenChange(next);
      }}
    >
      <DialogContent
        className="cx-workspace-popover ps2-dialog ps2-inspiration"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          heading.current?.focus();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (locked.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (locked.current) event.preventDefault();
        }}
      >
        <header className="ps2-dialog-header">
          <div>
            <DialogTitle ref={heading} tabIndex={-1}>
              Use a photo as inspiration
            </DialogTitle>
            <DialogDescription>
              Bring a setting and a mood you love.
            </DialogDescription>
          </div>
          <button
            className="ps2-icon-button"
            aria-label="Cancel inspiration"
            disabled={locked.current}
            onClick={() => onOpenChange(false)}
          >
            <X size={20} />
          </button>
        </header>
        <div className="ps2-dialog-scroll ps2-inspiration-scroll">
          <div className="ps2-inspiration-pair">
            <figure>
              <figcaption>
                <b>Your dish</b>
                <span>Food, portion & branding</span>
              </figcaption>
              {source && !sourceFailed ? (
                <img
                  src={source}
                  alt="Your original dish photo"
                  onError={() => setSourceFailed(true)}
                />
              ) : (
                <div className="ps2-inspiration-description">
                  <b>
                    {source
                      ? "Your original photo is unavailable"
                      : dishName || "Your dish description"}
                  </b>
                  <p>
                    {source
                      ? "Close this sheet and check your original photo before creating."
                      : "An illustration from your description."}
                  </p>
                </div>
              )}
            </figure>
            <figure>
              <figcaption>
                <b>Inspiration</b>
                <span>Setting, light & color</span>
              </figcaption>
              {preview ? (
                <div
                  className="ps2-inspiration-preview"
                  data-preview-state={previewStatus}
                >
                  <img
                    key={preview}
                    src={preview}
                    alt="Your inspiration photo"
                    onLoad={() => setPreviewStatus("ready")}
                    onError={() => setPreviewStatus("error")}
                    style={{
                      visibility:
                        previewStatus === "ready" ? "visible" : "hidden",
                    }}
                  />
                  {previewStatus !== "ready" && (
                    <p role={previewStatus === "error" ? "alert" : "status"}>
                      {previewStatus === "error" ? (
                        <>
                          Photo unavailable.
                          <span className="sr-only">
                            {" "}
                            Choose another photo.
                          </span>
                        </>
                      ) : (
                        "Opening inspiration…"
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  className="ps2-inspiration-upload"
                  disabled={!!busy}
                  onClick={() => input.current?.click()}
                >
                  <ImagePlus size={28} />
                  <span>Choose inspiration</span>
                </button>
              )}
            </figure>
          </div>
          <p className="ps2-inspiration-guidance">
            Borrow the setting, light and color. Keep your own dish and portion.
            Food, text and logos from the inspiration aren’t copied.
          </p>
          <p className="ps2-inspiration-file-note">
            Your serving dish, camera angle and custom choices take priority
            over the inspiration.
          </p>
          {!source && (
            <p className="ps2-inline-note">
              Without a dish photo, the result is an illustration. Review it
              against the real dish before use.
            </p>
          )}
          <div className="ps2-inspiration-file-actions">
            {preview && (
              <button
                className="cx-link"
                disabled={!!busy}
                onClick={() => input.current?.click()}
              >
                Replace inspiration
              </button>
            )}
            {current && (
              <button
                className="cx-link"
                disabled={!!busy}
                onClick={() => void apply(true)}
              >
                Remove inspiration
              </button>
            )}
          </div>
          <p className="ps2-inspiration-file-note">
            JPG, PNG or HEIC · Up to 20 MB
          </p>
          {customChoices && (
            <p className="ps2-inline-note">
              Applying inspiration also keeps the customization choices you just
              made.
            </p>
          )}
          {busy && (
            <p role="status" className="ps2-inline-note">
              {busy}
            </p>
          )}
          {error && (
            <p className="ps2-inspiration-error" role="alert">
              {error}
            </p>
          )}
          <input
            ref={input}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void choose(file);
            }}
          />
        </div>
        <footer className="ps2-dialog-footer">
          <button
            className="cx-link"
            disabled={locked.current}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            className="cx-btn"
            disabled={!!busy || !selection || previewStatus !== "ready"}
            onClick={() => void apply()}
          >
            {busy === "Saving inspiration…"
              ? "Saving…"
              : "Use this inspiration"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
