"use client";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Images,
  LoaderCircle,
  Share2,
  Smartphone,
} from "lucide-react";
import { canvasBlob, renderPost } from "@/lib/creation-export";
import { downloadBlob, type Row } from "@/lib/client";
import { postShareFormats, postVisualState } from "@/lib/sharing";
import { track } from "./creation-shared";

function FileThumbnail({ file, index }: { file: File; index: number }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return url ? (
    <img src={url} alt={`Finished image ${index + 1}`} />
  ) : (
    <span className="cx-share-thumb-loading" />
  );
}

export default function PostSharing({
  draft,
  restaurant,
  busy,
  notice,
}: {
  draft: Row;
  restaurant: Row;
  busy: boolean;
  notice: (message: string) => void;
}) {
  const [selected, setSelected] = useState(draft.channels[0] || "feed");
  const [prepared, setPrepared] = useState<{
    key: string;
    files: File[];
  } | null>(null);
  const [renderError, setRenderError] = useState("");
  const [actionError, setActionError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [handedOff, setHandedOff] = useState("");
  const cache = useRef(new Map<string, File[]>());
  const imageKey = JSON.stringify(postVisualState(draft, restaurant, selected));
  const contentKey = JSON.stringify({
    ...postVisualState(draft, restaurant),
    layouts: draft.layouts,
  });
  const files =
    prepared?.key === imageKey && draft.reviewed ? prepared.files : [];
  const ready = draft.reviewed && files.length > 0 && !busy && !sharing;
  const caption = draft.caption || "";
  const copied = copiedCaption === caption && !!caption;
  const count = selected === "carousel" ? draft.items.length : 1;
  useEffect(() => {
    cache.current.clear();
    setSaved({});
    setHandedOff("");
  }, [contentKey]);
  useEffect(() => {
    if (!draft.channels.includes(selected))
      setSelected(draft.channels[0] || "feed");
  }, [draft.channels, selected]);
  useEffect(() => {
    let active = true;
    setRenderError("");
    setActionError("");
    setCompleted(0);
    setPrepared(null);
    if (!draft.reviewed) return;
    const hit = cache.current.get(imageKey);
    if (hit) {
      setPrepared({ key: imageKey, files: hit });
      return;
    }
    const data = JSON.parse(imageKey);
    void (async () => {
      const outputs: File[] = [];
      const length = data.channel === "carousel" ? data.draft.items.length : 1;
      for (let i = 0; i < length; i++) {
        const canvas = document.createElement("canvas");
        await renderPost(canvas, data.draft, data.restaurant, data.channel, i);
        outputs.push(
          new File(
            [await canvasBlob(canvas, "image/png")],
            `${data.restaurant.slug}-${data.channel}${length > 1 ? "-" + (i + 1) : ""}.png`,
            { type: "image/png" },
          ),
        );
        if (!active) return;
        setCompleted(i + 1);
      }
      cache.current.set(imageKey, outputs);
      setPrepared({ key: imageKey, files: outputs });
    })().catch((e) => {
      if (active)
        setRenderError(
          e.message || "Your image couldn’t be prepared. Try again.",
        );
    });
    return () => {
      active = false;
    };
  }, [imageKey, draft.reviewed, attempt]);
  let canShare = false;
  try {
    canShare =
      typeof navigator !== "undefined" &&
      !!navigator.share &&
      !!files.length &&
      !!navigator.canShare?.({ files });
  } catch {}
  const exported =
    !!files.length &&
    (handedOff === imageKey || files.every((f) => saved[imageKey + f.name]));
  function share() {
    if (!ready || !canShare) return;
    setSharing(true);
    setActionError("");
    // Do not await rendering or clipboard access here: the tap must open the share sheet directly.
    void navigator
      .share({ files })
      .then(() => {
        setHandedOff(imageKey);
        track("export_complete", undefined, {
          tool: "post",
          channel: selected,
          method: "share",
        });
        notice(
          "Files handed to your share sheet. Finish your post in Instagram.",
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setActionError(
            "Sharing couldn’t open. Save the image below, then choose it from your photo library in Instagram.",
          );
      })
      .finally(() => setSharing(false));
  }
  function save(file: File) {
    downloadBlob(file, file.name);
    setSaved((current) => ({ ...current, [imageKey + file.name]: true }));
    track("export_complete", undefined, {
      tool: "post",
      channel: selected,
      method: "download",
    });
    notice(
      "Download started. On a phone, save the image to Photos or your gallery before opening Instagram.",
    );
  }
  return (
    <section className="cx-post-sharing cx-post-handoff">
      <div className="cx-sharing-heading">
        <Smartphone size={22} />
        <div>
          <h3>Your next post, ready to go.</h3>
          <p>Choose a format. Take your image and caption with you.</p>
        </div>
      </div>
      <div
        className="cx-share-formats"
        role="group"
        aria-label="Choose an Instagram export format"
      >
        {draft.channels.map((channel: string) => (
          <button
            key={channel}
            type="button"
            disabled={busy || sharing}
            aria-pressed={selected === channel}
            onClick={() => setSelected(channel)}
          >
            <span
              className={`cx-format-outline is-${channel}`}
              aria-hidden="true"
            />
            <strong>{postShareFormats[channel]?.label || channel}</strong>
            <small>
              {channel === "carousel"
                ? `${draft.items.length} slides`
                : postShareFormats[channel]?.detail}
            </small>
          </button>
        ))}
      </div>
      {!draft.reviewed && (
        <p className="cx-share-review-note">
          Check the images and details above to prepare your files.
        </p>
      )}
      {draft.reviewed && !files.length && !renderError && (
        <p className="cx-share-preparing" role="status">
          <LoaderCircle size={16} className="cx-spin" />
          {count > 1
            ? `Preparing slide ${Math.min(completed + 1, count)} of ${count}…`
            : "Preparing your full-size image…"}
        </p>
      )}
      {files.length > 0 && (
        <div className="cx-share-file-preview">
          <div
            className={`cx-share-thumbnails ${selected === "story" ? "is-story" : ""}`}
          >
            {files.map((file, i) => (
              <FileThumbnail key={file.name + imageKey} file={file} index={i} />
            ))}
          </div>
          <div>
            <strong>
              {selected === "story"
                ? "Your Story"
                : count > 1
                  ? `${count} finished slides`
                  : "Your post"}
            </strong>
            <span>{postShareFormats[selected]?.detail} · PNG</span>
            <small>
              {(
                files.reduce((total, f) => total + f.size, 0) /
                1024 /
                1024
              ).toFixed(1)}{" "}
              MB · Ready to save
            </small>
          </div>
          <Check size={17} />
        </div>
      )}
      <div className={`cx-share-step ${copied ? "is-done" : ""}`}>
        <span className="cx-share-step-number">
          {copied ? <Check size={16} /> : "1"}
        </span>
        <div>
          <h4>Take your caption</h4>
          <p>
            {copied
              ? "Copied. Paste it into your Instagram post."
              : caption
                ? "Copy it now, then paste it when you post."
                : "Your image can be shared without a caption."}
          </p>
        </div>
      </div>
      {!!caption && (
        <button
          className="cx-btn cx-secondary cx-full"
          disabled={!draft.reviewed || busy || sharing}
          onClick={() => {
            if (!navigator.clipboard?.writeText) {
              setManualCopy(true);
              return;
            }
            void navigator.clipboard
              .writeText(caption)
              .then(() => {
                setCopiedCaption(caption);
                setManualCopy(false);
                setActionError("");
              })
              .catch(() => setManualCopy(true));
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Caption copied · copy again" : "Copy caption"}
        </button>
      )}
      {manualCopy && (
        <label className="cx-manual-caption">
          Select and copy your caption
          <textarea
            readOnly
            value={caption}
            onFocus={(e) => e.target.select()}
          />
          <small>Press and hold the text on a phone, then choose Copy.</small>
        </label>
      )}
      <div className={`cx-share-step ${exported ? "is-done" : ""}`}>
        <span className="cx-share-step-number">
          {exported ? <Check size={16} /> : "2"}
        </span>
        <div>
          <h4>
            {canShare ? "Send your image to Instagram" : "Save your image"}
          </h4>
          <p>
            {exported
              ? "Finish in Instagram whenever you’re ready."
              : canShare
                ? "Choose Instagram if it appears, or save to your photo library."
                : "Download, then choose it from your photo library in Instagram."}
          </p>
        </div>
      </div>
      {canShare && (
        <button className="cx-btn cx-full" disabled={!ready} onClick={share}>
          <Share2 size={17} />
          {sharing
            ? "Sharing…"
            : files.length > 1
              ? `Share ${files.length} slides`
              : selected === "story"
                ? "Share Story image"
                : "Share post image"}
        </button>
      )}
      {files.map((file, index) => (
        <button
          className={`cx-btn ${canShare || files.length > 1 ? "cx-secondary" : ""} cx-full`}
          key={file.name}
          disabled={!ready}
          onClick={() => save(file)}
        >
          {saved[imageKey + file.name] ? (
            <Check size={16} />
          ) : (
            <Download size={16} />
          )}
          {files.length > 1
            ? `Save slide ${index + 1}`
            : "Save image to device"}
        </button>
      ))}
      {files.length > 1 && (
        <button
          className="cx-link"
          disabled={!ready}
          onClick={() => {
            setSharing(true);
            setActionError("");
            void (async () => {
              const { zipSync, strToU8 } = await import("fflate");
              const entries: Record<string, Uint8Array> = {
                "caption.txt": strToU8(caption),
              };
              for (const file of files)
                entries[file.name] = new Uint8Array(await file.arrayBuffer());
              downloadBlob(
                new Blob([new Uint8Array(zipSync(entries, { level: 0 }))], {
                  type: "application/zip",
                }),
                `${restaurant.slug}-carousel.zip`,
              );
              setSaved((current) => ({
                ...current,
                ...Object.fromEntries(
                  files.map((file) => [imageKey + file.name, true]),
                ),
              }));
              notice(
                "Carousel saved as a ZIP. Unzip it, then select the numbered images in Instagram.",
              );
            })()
              .catch(() =>
                setActionError(
                  "The ZIP couldn’t be prepared. Save each slide individually.",
                ),
              )
              .finally(() => setSharing(false));
          }}
        >
          <Images size={16} /> Download all slides & caption
        </button>
      )}
      {renderError && (
        <div className="cx-feedback cx-error" role="alert">
          {renderError}
          <button
            className="cx-link"
            disabled={busy}
            onClick={() => setAttempt((v) => v + 1)}
          >
            Prepare image again
          </button>
        </div>
      )}
      {actionError && (
        <p className="cx-feedback cx-error" role="alert">
          {actionError}
        </p>
      )}
      <div className="cx-instagram-tip">
        <strong>When you’re in Instagram</strong>
        <p>
          {selected === "story"
            ? "Choose Story, add this image and adjust it to fill the screen. Add any links or stickers in Instagram."
            : selected === "carousel"
              ? "Choose Post → Select multiple. Pick the numbered images in order, then paste your caption."
              : "Choose Post, select your image and keep the portrait crop. Paste your caption before publishing."}
        </p>
      </div>
      <small>Sharing hands off your files. You choose when to publish.</small>
    </section>
  );
}
