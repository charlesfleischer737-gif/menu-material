"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { canvasBlob, renderPost } from "@/lib/creation-export";
import { downloadBlob, type Row } from "@/lib/client";
import {
  postFormatDetail,
  postShareFormats,
  postVisualState,
} from "@/lib/sharing";
import { track } from "./creation-shared";
import { postSlideCount } from "@/lib/post-composition";

export default function PostSharing({
  draft,
  restaurant,
  busy,
  notice,
  draftId,
}: {
  draft: Row;
  restaurant: Row;
  busy: boolean;
  notice: (message: string) => void;
  draftId?: string;
}) {
  const [desiredFormat, setSelected] = useState(draft.channels[0] || "feed");
  const [prepared, setPrepared] = useState<{
    key: string;
    files: File[];
  } | null>(null);
  const [renderState, setRenderState] = useState({
    key: "",
    error: "",
    completed: 0,
  });
  const [actionError, setActionError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [handedOff, setHandedOff] = useState("");
  const cache = useRef(new Map<string, File[]>());
  const selected = draft.channels.includes(desiredFormat)
    ? desiredFormat
    : draft.channels[0] || "feed";
  const imageKey = JSON.stringify(postVisualState(draft, restaurant, selected));
  const renderError = renderState.key === imageKey ? renderState.error : "";
  const completed = renderState.key === imageKey ? renderState.completed : 0;
  const files =
    prepared?.key === imageKey && draft.reviewed ? prepared.files : [];
  const ready = draft.reviewed && files.length > 0 && !busy && !sharing;
  const caption = draft.caption || "";
  const copied = copiedCaption === caption && !!caption;
  const count = postSlideCount(draft, selected);
  // Shares count against the dish photo, so they reach the owner's report.
  const measure = (method: "share" | "download") =>
    track("export_complete", draft.items?.[0]?.photoId, {
      tool: "post",
      channel: selected,
      method,
      design: String(draft.template || "chef"),
      shape:
        selected === "story"
          ? "9:16"
          : selected === "feed" && draft.feedShape === "3:4"
            ? "3:4"
            : "4:5",
      count: files.length,
      ...(draftId ? { draftId } : {}),
    });
  useEffect(() => {
    let active = true;
    if (!draft.reviewed) return;
    const data = JSON.parse(imageKey);
    void (async () => {
      const hit = cache.current.get(imageKey);
      if (hit) {
        setPrepared({ key: imageKey, files: hit });
        return;
      }
      setRenderState({ key: imageKey, error: "", completed: 0 });
      const outputs: File[] = [];
      const length = postSlideCount(data.draft, data.channel);
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
        setRenderState({ key: imageKey, error: "", completed: i + 1 });
      }
      if (cache.current.size >= 6)
        cache.current.delete(cache.current.keys().next().value!);
      cache.current.set(imageKey, outputs);
      setPrepared({ key: imageKey, files: outputs });
    })().catch((e) => {
      if (active)
        setRenderState({
          key: imageKey,
          completed: 0,
          error: e.message || "Your image couldn’t be prepared. Try again.",
        });
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
        measure("share");
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
    measure("download");
    notice(
      "Download started. On a phone, save the image to Photos or your gallery before opening Instagram.",
    );
  }
  async function saveSelected() {
    if (!ready) return;
    if (files.length === 1) return save(files[0]);
    setSharing(true);
    setActionError("");
    try {
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
        ...Object.fromEntries(files.map((f) => [imageKey + f.name, true])),
      }));
      measure("download");
      notice(
        "Carousel download started. Unzip the numbered images before posting.",
      );
    } catch {
      setActionError(
        "Download could not be prepared. Save each slide individually below.",
      );
    } finally {
      setSharing(false);
    }
  }
  return (
    <section className="mm-share-completion">
      <div
        className="mm-segments"
        role="group"
        aria-label="Choose export format"
      >
        {draft.channels.map((c: string) => (
          <button
            key={c}
            disabled={busy || sharing}
            aria-pressed={selected === c}
            onClick={() => setSelected(c)}
          >
            {postShareFormats[c]?.label || c}
          </button>
        ))}
      </div>
      {draft.reviewed && !files.length && !renderError && (
        <p className="mm-muted" role="status">
          Preparing{" "}
          {count > 1
            ? `${completed} of ${count} slides`
            : "your full-size image"}
          …
        </p>
      )}
      {!!caption && (
        <button
          className="cx-btn cx-secondary"
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
              })
              .catch(() => setManualCopy(true));
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
          {copied ? "Caption copied" : "Copy caption"}
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
        </label>
      )}
      <button
        className="cx-btn"
        disabled={!ready}
        onClick={() => (canShare ? share() : void saveSelected())}
      >
        {canShare ? <Share2 size={17} /> : <Download size={17} />}{" "}
        {sharing
          ? "Preparing…"
          : canShare
            ? `Share ${selected === "carousel" ? "carousel" : selected === "story" ? "Story" : "post"}`
            : `Save ${selected === "carousel" ? "carousel ZIP" : selected === "story" ? "Story" : "post"}`}
      </button>
      {exported && (
        <p role="status" className="mm-muted">
          {handedOff === imageKey
            ? "Files handed to your share sheet."
            : "Download started."}{" "}
          Finish publishing in your social app.
        </p>
      )}
      {files.length > 0 && (
        <details>
          <summary>Download options & posting help</summary>
          <p className="mm-muted">
            {postFormatDetail(draft, selected)} · PNG. Your design is saved
            separately in Menu Material.
          </p>
          {files.map((file, index) => (
            <button
              className="cx-link"
              key={file.name}
              disabled={!ready}
              onClick={() => save(file)}
            >
              Download {files.length > 1 ? `slide ${index + 1}` : "image"}
            </button>
          ))}
          <p className="mm-muted">
            {selected === "story"
              ? "In Instagram, choose Story and add your image. Add any links or stickers there."
              : selected === "carousel"
                ? "In Instagram, choose Post, then Select multiple. Pick the numbered images in order and paste your caption."
                : "In Instagram, choose Post and select your image. Keep the portrait crop, then paste your caption."}
          </p>
        </details>
      )}
      {renderError && (
        <div className="cx-feedback cx-error" role="alert">
          {renderError}
          <button className="cx-link" onClick={() => setAttempt((v) => v + 1)}>
            Try preparing again
          </button>
        </div>
      )}
      {actionError && (
        <p className="cx-feedback cx-error" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}
