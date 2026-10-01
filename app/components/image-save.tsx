"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, ImageDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadBlob } from "@/lib/client";
import {
  canShareImages,
  isIPhone,
  type ImageSaveResult,
} from "@/lib/image-save";

const subscribeToDevice = () => () => {};
const iphoneSnapshot = () => isIPhone(navigator.userAgent);
const serverSnapshot = () => false;
export function useIPhone() {
  return useSyncExternalStore(
    subscribeToDevice,
    iphoneSnapshot,
    serverSnapshot,
  );
}

type SaveRequest = {
  files: File[];
  onResult?: (result: ImageSaveResult) => void;
};

/** Files are prepared before opening, so the next tap can share synchronously. */
export function useImageSave() {
  const iphone = useIPhone();
  const [request, setRequest] = useState<SaveRequest | null>(null);
  return {
    iphone,
    open: (files: File[], onResult?: SaveRequest["onResult"]) =>
      setRequest({ files, onResult }),
    dialog: request ? (
      <ImageSaveDialog {...request} onClose={() => setRequest(null)} />
    ) : null,
  };
}

export default function ImageSaveDialog({
  files,
  onResult,
  onClose,
}: SaveRequest & { onClose: () => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const shareable = canShareImages(files) && !shareFailed;
  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file));
    // Object URLs are external resources with a lifetime owned by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  async function save() {
    if (lock.current || !shareable) return;
    lock.current = true;
    setSharing(true);
    setNotice("");
    try {
      // No fetch, rendering, or clipboard work before this call: Safari needs the tap.
      await navigator.share({ files });
      setNotice(
        "Share sheet closed. If you chose Save Image, find it in Photos.",
      );
      onResult?.("shared");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setNotice("Saving cancelled. You can try again.");
        onResult?.("cancelled");
      } else {
        setShareFailed(true);
        setNotice(
          "The share sheet couldn’t open. Touch and hold the image below to save it.",
        );
      }
    } finally {
      lock.current = false;
      setSharing(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !lock.current) onClose();
      }}
    >
      <DialogContent
        className="cx-workspace-popover image-save-dialog"
        closeDisabled={sharing}
      >
        <DialogTitle>Save to Photos</DialogTitle>
        <DialogDescription>
          {shareable
            ? `Tap ${files.length > 1 ? "Save images" : "Save image"}, then choose “Save Image” in the share sheet. You may need to scroll down to find it.`
            : "Touch and hold each image, then choose “Save to Photos” or “Save Image”."}
        </DialogDescription>
        {shareable && (
          <button
            className="cx-btn cx-full"
            disabled={sharing}
            onClick={() => void save()}
          >
            <ImageDown size={18} aria-hidden="true" />
            {sharing
              ? "Opening…"
              : files.length > 1
                ? "Save images"
                : "Save image"}
          </button>
        )}
        {notice && (
          <p className="cx-hint" role="status">
            {notice}
          </p>
        )}
        <div className="image-save-previews">
          {files.map((file, index) => (
            <figure key={`${index}-${file.name}`}>
              {urls[index] && (
                <img
                  src={urls[index]}
                  alt={
                    files.length > 1
                      ? `Image ${index + 1} of ${files.length}`
                      : "Your image, ready to save"
                  }
                />
              )}
              <button
                className="cx-btn cx-secondary cx-full"
                disabled={sharing}
                onClick={() => {
                  downloadBlob(file, file.name);
                  setNotice(
                    "Download started. Check Downloads in the Files app.",
                  );
                  onResult?.("downloaded");
                }}
              >
                <Download size={16} aria-hidden="true" />
                Download{files.length > 1 ? ` image ${index + 1}` : ""}
              </button>
            </figure>
          ))}
        </div>
        {shareable && (
          <p className="cx-hint">
            You can also touch and hold the image to save it to Photos.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
